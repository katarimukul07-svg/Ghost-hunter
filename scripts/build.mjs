import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of [
  "index.html",
  "manifest.webmanifest",
  "service-worker.js",
  "privacy.html",
  "support.html",
]) {
  await cp(path.join(root, file), path.join(dist, file));
}

await cp(path.join(root, "assets"), path.join(dist, "assets"), { recursive: true });
await cp(path.join(root, "src"), path.join(dist, "src"), { recursive: true });
await cp(path.join(root, "styles"), path.join(dist, "styles"), { recursive: true });

await writeFile(path.join(dist, "build-info.json"), JSON.stringify({
  revision: process.env.GITHUB_SHA || "local",
}) + "\n");

console.log("Built deployable game in dist/.");
