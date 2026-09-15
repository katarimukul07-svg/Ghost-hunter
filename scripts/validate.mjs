import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const fixes = await readFile(new URL("../gameplay-fixes.js", import.meta.url), "utf8");

assert.match(index, /<!doctype html>/i, "index.html must declare HTML5");
assert.match(index, /<meta[^>]+name="viewport"/i, "mobile viewport metadata is required");
assert.match(index, /<canvas\s+id="c"/i, "the gameplay canvas is missing");

for (const id of [
  "startScreen",
  "shopScreen",
  "coinStoreScreen",
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

const fixLoader = '<script src="gameplay-fixes.js"></script>';
assert.equal(index.split(fixLoader).length - 1, 1, "gameplay fixes must be loaded exactly once");
assert.ok(
  index.indexOf(fixLoader) > index.lastIndexOf("</script>", index.indexOf(fixLoader) - 1),
  "gameplay fixes must load after the main inline game script",
);

const remoteAssets = [...index.matchAll(/<(?:script|link)[^>]+(?:src|href)=["'](https?:\/\/[^"']+)/gi)];
assert.equal(remoteAssets.length, 0, "the game must remain playable offline without remote assets");

assert.match(
  fixes,
  /purchaseCoins\s*=\s*function\s+disabledFakePurchase/,
  "fake paid coin purchases must stay disabled",
);

console.log("Echo Steps validation passed: HTML shell, UI contract, JavaScript syntax, offline assets, and commerce guard.");
