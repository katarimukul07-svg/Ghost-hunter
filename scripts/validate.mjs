import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const fixes = await readFile(new URL("../gameplay-fixes.js", import.meta.url), "utf8");
const tutorial = await readFile(new URL("../tutorial.js", import.meta.url), "utf8");
const nativeBridge = await readFile(new URL("../native-bridge.js", import.meta.url), "utf8");
const webManifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
const serviceWorker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
const capacitorConfig = JSON.parse(await readFile(new URL("../capacitor.config.json", import.meta.url), "utf8"));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const androidVariables = await readFile(new URL("../android/variables.gradle", import.meta.url), "utf8");
const androidManifest = await readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
const iosInfo = await readFile(new URL("../ios/App/App/Info.plist", import.meta.url), "utf8");
const iosPrivacy = await readFile(new URL("../ios/App/App/PrivacyInfo.xcprivacy", import.meta.url), "utf8");

assert.match(index, /<!doctype html>/i, "index.html must declare HTML5");
assert.match(index, /<meta[^>]+name="viewport"/i, "mobile viewport metadata is required");
assert.match(index, /<canvas\s+id="c"/i, "the gameplay canvas is missing");

for (const id of [
  "startScreen",
  "shopScreen",
  "pauseScreen",
  "overScreen",
  "startBtn",
  "pauseBtn",
  "retryBtn",
]) {
  assert.match(index, new RegExp(`id=["']${id}["']`), `required UI element #${id} is missing`);
}

const inlineScripts = [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((source) => source.trim());

assert.equal(inlineScripts.length, 1, "expected one inline game script");
new vm.Script(inlineScripts[0], { filename: "index.inline.js" });
new vm.Script(fixes, { filename: "gameplay-fixes.js" });
new vm.Script(tutorial, { filename: "tutorial.js" });
new vm.Script(nativeBridge, { filename: "native-bridge.js" });

const nativeLoader = '<script src="native-bridge.js"></script>';
const fixLoader = '<script src="gameplay-fixes.js"></script>';
const tutorialLoader = '<script src="tutorial.js"></script>';
assert.equal(index.split(nativeLoader).length - 1, 1, "native bridge must be loaded exactly once");
assert.equal(index.split(fixLoader).length - 1, 1, "gameplay fixes must be loaded exactly once");
assert.equal(index.split(tutorialLoader).length - 1, 1, "tutorial must be loaded exactly once");
assert.ok(
  index.indexOf(fixLoader) > index.lastIndexOf("</script>", index.indexOf(fixLoader) - 1),
  "gameplay fixes must load after the main inline game script",
);
assert.ok(index.indexOf(tutorialLoader) > index.indexOf(fixLoader), "tutorial must load after gameplay fixes");
assert.ok(index.indexOf(nativeLoader) < index.indexOf("<script>"), "native bridge must load before the game");

const remoteAssets = [...index.matchAll(/<(?:script|link)[^>]+(?:src|href)=["'](https?:\/\/[^"']+)/gi)];
assert.equal(remoteAssets.length, 0, "the game must remain playable offline without remote assets");

assert.doesNotMatch(index + fixes, /COIN_PACKS|purchaseCoins|Demo build|BUY COINS|WATCH REWARDED AD/i,
  "prototype commerce and ad UI must not ship");
assert.match(index, /GC IN/, "garbage collector countdown must use a clear label");
assert.match(fixes, /BONUS_LIFETIME\s*=\s*4\.5/, "timed bonus window must remain intentionally short");
assert.match(fixes, /DOUBLE BONUS/, "double bonus decision event is missing");
assert.match(fixes, /round\s*<\s*2/, "bonuses must not interrupt the teaching round");

assert.equal(packageJson.engines.node, ">=22", "Capacitor 8 requires Node 22+");
assert.equal(capacitorConfig.webDir, "dist", "native builds must bundle the tested dist directory");
assert.match(capacitorConfig.appId, /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/i, "invalid app ID");
assert.equal(webManifest.orientation, "portrait", "installed web app must stay portrait");
assert.match(serviceWorker, /index\.html/);
assert.match(serviceWorker, /gameplay-fixes\.js/);
assert.match(serviceWorker, /tutorial\.js/, "tutorial must be available offline");
assert.match(tutorial, /echoSteps\.tutorial\.v1/, "tutorial completion must be versioned and persistent");
assert.match(tutorial, /SKIP/, "first-run tutorial must remain skippable");
assert.match(tutorial, /tutorialBtn/, "main menu tutorial replay control is missing");

assert.match(androidVariables, /compileSdkVersion\s*=\s*36/, "Android must compile against API 36");
assert.match(androidVariables, /targetSdkVersion\s*=\s*36/, "Android must target API 36");
assert.match(androidManifest, /android:screenOrientation="portrait"/, "Android must lock portrait orientation");
assert.match(androidManifest, /android:allowBackup="false"/, "local progress must not be cloud-backed up");
assert.doesNotMatch(androidManifest, /android\.permission\.INTERNET/, "ad-free offline release must not request internet");

assert.match(iosInfo, /UIInterfaceOrientationPortrait/, "iOS must support portrait");
assert.doesNotMatch(iosInfo, /UIInterfaceOrientationLandscape/, "iOS launch build must stay portrait");
assert.match(iosPrivacy, /<key>NSPrivacyTracking<\/key>\s*<false\/>/, "iOS privacy manifest must disable tracking");
assert.match(iosPrivacy, /NSPrivacyAccessedAPICategoryUserDefaults/, "local preferences reason must be declared");

console.log("Echo Steps validation passed: web shell, offline assets, native targets, privacy, and commerce guard.");
