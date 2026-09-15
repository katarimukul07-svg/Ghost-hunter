import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of ["index.html", "gameplay-fixes.js"]) {
  await cp(path.join(root, file), path.join(dist, file));
}

console.log("Built deployable game in dist/.");
