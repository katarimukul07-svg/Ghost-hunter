import Foundation
import Capacitor
import GameKit
import StoreKit
import UIKit

/// Game Center leaderboard and StoreKit 2 coin packs for Echo Steps.
///
/// Coins are credited by the web layer only after StoreKit has verified a
/// transaction. A transaction stays unfinished until the web layer confirms it
/// has credited the coins, so a crash between payment and credit is recovered
/// on the next launch through `pendingTransactions`.
@objc(EchoNativePlugin)
public class EchoNativePlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "EchoNativePlugin"
    public let jsName = "EchoNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "gameCenterSignIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendingTransactions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishTransaction", returnType: CAPPluginReturnPromise),
    ]

    private var products: [String: Product] = [:]
    private var unfinished: [String: Transaction] = [:]
    private var updatesTask: Task<Void, Never>?
    private var signInCalls: [CAPPluginCall] = []
    private var authHandlerInstalled = false

    override public func load() {
        // Purchases that finish outside the purchase sheet (Ask to Buy, interrupted
        // payments, purchases made on another device) arrive here.
        updatesTask = Task { @MainActor [weak self] in
            for await result in Transaction.updates {
                guard let self, case .verified(let transaction) = result else { continue }
                let payload = self.remember(transaction)
                self.notifyListeners("transaction", data: payload)
            }
        }
    }

    deinit { updatesTask?.cancel() }

    // MARK: - Game Center

    @objc func gameCenterSignIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let player = GKLocalPlayer.local
            if player.isAuthenticated {
                call.resolve(self.playerPayload(player))
                return
            }
            self.signInCalls.append(call)
            guard !self.authHandlerInstalled else { return }
            self.authHandlerInstalled = true
            player.authenticateHandler = { [weak self] controller, error in
                guard let self else { return }
                if let controller {
                    self.bridge?.viewController?.present(controller, animated: true)
                    return
                }
                let calls = self.signInCalls
                self.signInCalls.removeAll()
                if player.isAuthenticated {
                    calls.forEach { $0.resolve(self.playerPayload(player)) }
                } else {
                    let message = error?.localizedDescription ?? "Game Center is not available."
                    calls.forEach { $0.resolve(["authenticated": false, "message": message]) }
                }
            }
        }
    }

    private func playerPayload(_ player: GKLocalPlayer) -> [String: Any] {
        ["authenticated": player.isAuthenticated, "displayName": player.displayName]
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let leaderboardId = call.getString("leaderboardId"), let score = call.getInt("score"), score >= 0 else {
            call.reject("leaderboardId and a non-negative score are required")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["submitted": false])
            return
        }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local,
                                  leaderboardIDs: [leaderboardId]) { error in
            if let error { call.reject(error.localizedDescription) } else { call.resolve(["submitted": true]) }
        }
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        let leaderboardId = call.getString("leaderboardId") ?? ""
        DispatchQueue.main.async {
            let controller = GKGameCenterViewController(leaderboardID: leaderboardId,
                                                        playerScope: .global, timeScope: .allTime)
            controller.gameCenterDelegate = self
            self.bridge?.viewController?.present(controller, animated: true)
            call.resolve()
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }

    // MARK: - Coin packs (StoreKit 2 consumables)

    @objc func getProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? []
        Task { @MainActor in
            do {
                let found = try await Product.products(for: ids)
                found.forEach { self.products[$0.id] = $0 }
                let list = found.map { ["id": $0.id, "displayName": $0.displayName, "displayPrice": $0.displayPrice] }
                call.resolve(["products": list, "canPay": AppStore.canMakePayments])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId"), let product = products[id] else {
            call.reject("Unknown product. Load products first.")
            return
        }
        Task { @MainActor in
            do {
                let result = try await product.purchase()
                switch result {
                case .success(.verified(let transaction)):
                    call.resolve(["status": "purchased", "transaction": self.remember(transaction)])
                case .success(.unverified(_, let error)):
                    call.resolve(["status": "failed", "message": error.localizedDescription])
                case .pending:
                    call.resolve(["status": "pending"])
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                @unknown default:
                    call.resolve(["status": "failed", "message": "Unknown purchase result."])
                }
            } catch {
                call.resolve(["status": "failed", "message": error.localizedDescription])
            }
        }
    }

    @objc func pendingTransactions(_ call: CAPPluginCall) {
        Task { @MainActor in
            var list: [[String: Any]] = []
            for await result in Transaction.unfinished {
                if case .verified(let transaction) = result, transaction.productType == .consumable {
                    list.append(self.remember(transaction))
                }
            }
            call.resolve(["transactions": list])
        }
    }

    @objc func finishTransaction(_ call: CAPPluginCall) {
        guard let id = call.getString("transactionId") else {
            call.reject("transactionId is required")
            return
        }
        Task { @MainActor in
            if let transaction = self.unfinished.removeValue(forKey: id) {
                await transaction.finish()
            }
            call.resolve()
        }
    }

    @discardableResult
    private func remember(_ transaction: Transaction) -> [String: Any] {
        let id = String(transaction.id)
        unfinished[id] = transaction
        return ["transactionId": id, "productId": transaction.productID,
                "quantity": transaction.purchasedQuantity,
                "revoked": transaction.revocationDate != nil]
    }
}
