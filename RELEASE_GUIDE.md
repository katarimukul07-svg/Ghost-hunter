# Echo Steps 1.0 release handoff

## What the repository verifies

Every pull request runs static checks, browser gameplay tests, an Android debug APK build, an unsigned Android release App Bundle build, and an unsigned iOS simulator build. The required **Static and browser tests** check succeeds only if every job succeeds. The Android release artifact is a build verification artifact: it cannot be uploaded to Play until the owner signs a release bundle. A simulator build is not an iOS App Store archive.

Use the [release checklist](RELEASE_CHECKLIST.md) for device acceptance and store decisions. CI cannot establish how the game feels on physical devices, certify a store listing, or guarantee there are no bugs.

## Android owner handoff

1. Confirm `com.mukulkatari.echosteps` as the permanent application ID before creating the first Play app. Confirm the name, privacy policy, support contact, age rating, screenshots, price, and availability in the store listing.
2. Enroll in Play Console. Complete its current account and testing requirements. For a new personal developer account subject to Google's production-access requirement, arrange at least 12 opted-in closed testers for 14 continuous days; internal testing alone does not satisfy that requirement.
3. Generate and safely back up a private upload key on your own computer. Set up Play App Signing and sign a release App Bundle through Android Studio or a local signing configuration. Never add the key, passwords, or service-account credentials to Git or CI artifacts. The CI `echo-steps-android-release-unsigned` artifact is for build inspection only.
4. Upload the signed `.aab` to internal testing, install the store-delivered build on physical devices, and work through real-device acceptance. Move through any required closed test before requesting production access. Review the final data safety and content declarations against that exact binary.

## iOS owner handoff

1. Confirm the same permanent bundle ID and enroll in the Apple Developer Program. Configure signing and capabilities in Xcode with your own account and trusted machine.
2. After `npm ci` and `npm run cap:sync`, archive the Release configuration for a generic iOS device in Xcode. Validate and upload it with Xcode Organizer to App Store Connect; the CI simulator build cannot be submitted.
3. Distribute through TestFlight, test the store-delivered app on physical iPhones, and finish App Privacy, screenshots, age rating, support, and review information. Submit for App Review after acceptance.

## Release decision

After the owner approves the PR and it merges into `main`, verify the required CI check and Pages deployment on the merged commit. Close the real-device and store-owner items in the release checklist. The owner then approves a version tag and each store submission. Increase Android `versionCode` and iOS `CURRENT_PROJECT_VERSION` for each later upload; keep the package, Android, iOS, and listing versions in sync.
