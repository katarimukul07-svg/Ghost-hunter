import { build as bundle } from "esbuild";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

// Accounts and non-economic saves may be reviewed independently. There is no
// approved ranked validator in this build, so an activation request must fail
// rather than reconnecting the forgeable checkpoint protocol.
if (process.env.ECHO_RANKED_ACTIVATE === "1") {
  throw new Error("Ranked activation is blocked pending server replay validation");
}

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
// Retain the protocol source for research tests only; it must not be bundled.
await rm(path.join(dist, "src/cloud/ranked-protocol.js"), { force: true });

// Bundle only the native adapter; the provider's web path never imports it.
await bundle({entryPoints:[path.join(root,"src/cloud/secure-storage-native.js")],
 outfile:path.join(dist,"src/cloud/secure-storage-native.js"),bundle:true,
 format:"esm",platform:"browser",target:"es2022",minify:true,legalComments:"none"});

await bundle({entryPoints:[path.join(root,"src/cloud/ranked-session.js")],
 outfile:path.join(dist,"src/cloud/ranked-session.js"),bundle:true,
 format:"esm",platform:"browser",target:"es2022",minify:true,legalComments:"none"});

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
const projectOrigin=cloudUrl || "https://aimdnoixhrfwmwozlkee.supabase.co";
const parsedProject=new URL(projectOrigin);
if (parsedProject.origin!==projectOrigin || parsedProject.username || parsedProject.password
    || !/^[a-z0-9-]+\.supabase\.co$/.test(parsedProject.hostname)) throw new Error("Invalid project origin");
const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' "+projectOrigin+"; media-src 'self' blob:; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
const {readFile}=await import('node:fs/promises');
const html=await readFile(path.join(dist,'index.html'),'utf8');
await writeFile(path.join(dist,'index.html'),html.replace('<meta charset="UTF-8" />','<meta charset="UTF-8" />\n<meta http-equiv="Content-Security-Policy" content="'+csp+'" />'));

await writeFile(path.join(dist, "cloud-config.json"), JSON.stringify({
  enabled: cloudEnabled,
  rankedEnabled: false,
  url: cloudEnabled ? cloudUrl : "",
  publishableKey: cloudEnabled ? cloudKey : "",
}) + "\n");

await writeFile(path.join(dist, "build-info.json"), JSON.stringify({
  revision: process.env.GITHUB_SHA || "local",
}) + "\n");

console.log("Built deployable game in dist/.");
