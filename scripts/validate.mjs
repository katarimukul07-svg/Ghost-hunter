import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const scriptPaths = [
  "src/platform/native-bridge.js",
  "src/game/config.js",
  "src/game/audio.js",
  "src/game/arena.js",
  "src/game/state.js",
  "src/game/gameplay.js",
  "src/game/rendering.js",
  "src/game/controls.js",
  "src/game/bootstrap.js",
  "src/game/systems/fairness.js",
  "src/game/systems/bonuses.js",
  "src/rendering/backgrounds.js",
  "src/ui/tutorial.js",
];
const scriptEntries = await Promise.all(scriptPaths.map(async (relativePath) => [
  relativePath,
  await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8"),
]));
const scripts = new Map(scriptEntries);
const config = scripts.get("src/game/config.js");
const fairness = scripts.get("src/game/systems/fairness.js");
const bonuses = scripts.get("src/game/systems/bonuses.js");
const backgrounds = scripts.get("src/rendering/backgrounds.js");
const tutorial = scripts.get("src/ui/tutorial.js");
const sourceBundle = [index, ...scripts.values()].join("\n");
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

assert.equal(inlineScripts.length, 0, "game logic must not be embedded in index.html");
for (const [relativePath, source] of scripts) {
  new vm.Script(source, { filename: relativePath });
  const loader = `<script src="${relativePath}"></script>`;
  assert.equal(index.split(loader).length - 1, 1, `${relativePath} must be loaded exactly once`);
}
for (let indexPosition = 1; indexPosition < scriptPaths.length; indexPosition++) {
  assert.ok(
    index.indexOf(scriptPaths[indexPosition]) > index.indexOf(scriptPaths[indexPosition - 1]),
    `${scriptPaths[indexPosition]} must load after ${scriptPaths[indexPosition - 1]}`,
  );
}
assert.equal(index.split('<link rel="stylesheet" href="styles/game.css">').length - 1, 1,
  "the game stylesheet must be loaded exactly once");

const remoteAssets = [...index.matchAll(/<(?:script|link)[^>]+(?:src|href)=["'](https?:\/\/[^"']+)/gi)];
assert.equal(remoteAssets.length, 0, "the game must remain playable offline without remote assets");

assert.doesNotMatch(sourceBundle, /COIN_PACKS|purchaseCoins|Demo build|BUY COINS|WATCH REWARDED AD/i,
  "prototype commerce and ad UI must not ship");
assert.match(sourceBundle, /GC IN/, "garbage collector countdown must use a clear label");
assert.match(config, /BONUS_LIFETIME\s*:\s*4\.5/, "timed bonus window must remain intentionally short");
assert.match(bonuses, /CFG\.BONUS_LIFETIME/, "bonus lifetime must read central configuration");
assert.match(bonuses, /DOUBLE BONUS/, "double bonus decision event is missing");
assert.match(bonuses, /round\s*<\s*2/, "bonuses must not interrupt the teaching round");
assert.match(fairness, /shapeAwareResolve/, "shape-aware collision handling is missing");

assert.equal(packageJson.engines.node, ">=22", "Capacitor 8 requires Node 22+");
assert.equal(capacitorConfig.webDir, "dist", "native builds must bundle the tested dist directory");
assert.match(capacitorConfig.appId, /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/i, "invalid app ID");
assert.equal(webManifest.orientation, "portrait", "installed web app must stay portrait");
assert.match(serviceWorker, /index\.html/);
for (const relativePath of [...scriptPaths, "styles/game.css"]) {
  assert.ok(serviceWorker.includes(relativePath), `${relativePath} must be available offline`);
}
assert.match(tutorial, /echoSteps\.tutorial\.v1/, "tutorial completion must be versioned and persistent");
assert.match(tutorial, /SKIP/, "first-run tutorial must remain skippable");
assert.match(tutorial, /tutorialBtn/, "main menu tutorial replay control is missing");
for (const label of ["CLASSIC GRID", "CIRCUIT FOUNDRY", "ORBITAL STATION", "ABYSSAL NETWORK"]) {
  assert.ok(config.includes(label), `${label} must be defined in central configuration`);
}
assert.match(backgrounds, /echoSteps\.background/, "selected background must persist locally");

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
