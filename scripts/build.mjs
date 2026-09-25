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

const cloudUrl = process.env.ECHO_SUPABASE_URL || "";
const cloudKey = process.env.ECHO_SUPABASE_PUBLISHABLE_KEY || "";
const cloudEnabled = process.env.ECHO_CLOUD_ACTIVATE === "1";
if (Boolean(cloudUrl) !== Boolean(cloudKey)) {
  throw new Error("Cloud save requires both ECHO_SUPABASE_URL and ECHO_SUPABASE_PUBLISHABLE_KEY");
}
if (cloudUrl && !/^https:\/\/[^/?#]+\.supabase\.co$/.test(cloudUrl)) {
  throw new Error("Cloud save URL must be an HTTPS Supabase project origin");
}
if (cloudKey && !cloudKey.startsWith("sb_publishable_")) {
  throw new Error("Only a Supabase publishable key can be bundled in the client");
}
if (cloudEnabled && (!cloudUrl || !cloudKey)) {
  throw new Error("Cloud activation requires a Supabase URL and publishable key");
}
await writeFile(path.join(dist, "cloud-config.json"), JSON.stringify({
  enabled: cloudEnabled,
  url: cloudEnabled ? cloudUrl : "",
  publishableKey: cloudEnabled ? cloudKey : "",
}) + "\n");

await writeFile(path.join(dist, "build-info.json"), JSON.stringify({
  revision: process.env.GITHUB_SHA || "local",
}) + "\n");

console.log("Built deployable game in dist/.");
