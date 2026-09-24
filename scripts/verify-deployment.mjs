// Verify the live Pages deployment, including the exact commit being released.
const { SITE_URL, EXPECTED_REVISION } = process.env;
if (!SITE_URL || !/^[a-f0-9]{40}$/.test(EXPECTED_REVISION || "")) {
  throw new Error("SITE_URL and a full EXPECTED_REVISION are required");
}

const base = new URL(SITE_URL.endsWith("/") ? SITE_URL : `${SITE_URL}/`);
if (base.protocol !== "https:") throw new Error("The deployed site must use HTTPS");

async function read(relativePath) {
  const url = new URL(relativePath, base);
  url.searchParams.set("revision", EXPECTED_REVISION);
  const response = await fetch(url, {signal:AbortSignal.timeout(10_000), cache:"no-store"});
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

let lastError;
for (let attempt = 1; attempt <= 12; attempt++) {
  try {
    const info = JSON.parse(await read("build-info.json"));
    if (info.revision !== EXPECTED_REVISION) {
      throw new Error(`Live revision ${info.revision} does not match ${EXPECTED_REVISION}`);
    }
    for (const [asset, expected] of [
      ["", 'id="c"'],
      ["src/game/config.js", "const CFG ="],
      ["src/game/state.js", "const STATE ="],
      ["src/game/gameplay.js", "function update(dt)"],
      ["src/game/bootstrap.js", "requestAnimationFrame(loop)"],
      ["styles/game.css", "--player"],
      ["service-worker.js", "OFFLINE_ASSETS"],
    ]) {
      if (!(await read(asset)).includes(expected)) {
        throw new Error(`${asset || "index.html"} is missing expected game content`);
      }
    }
    console.log(`Live Pages deployment verified at ${base} (${EXPECTED_REVISION})`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.warn(`Deployment check ${attempt}/12: ${error.message}`);
    if (attempt < 12) await new Promise(resolve => setTimeout(resolve, 5_000));
  }
}
throw lastError;
