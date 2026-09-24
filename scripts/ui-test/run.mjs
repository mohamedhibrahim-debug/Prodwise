import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "prodwise-ui-"));
const chrome = process.env.PRODWISE_CHROME || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
assert.ok(chrome, "Set PRODWISE_CHROME to an installed Chromium browser; no dependency installation needed.");
const env = { ...process.env, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", DEMO_WRITE_ENABLED: "true", VERCEL_ENV: "development" };
const screenshots = join(root, "docs/ui-review/stage2-2");
mkdirSync(screenshots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label) {
  const end = Date.now() + 25000;
  while (Date.now() < end) { const value = await fn(); if (value) return value; await sleep(100); }
  throw new Error(`Timed out: ${label}`);
}
function child(args, cwd, overrides = {}) {
  return spawn(process.execPath, args, { cwd, env: { ...env, ...overrides }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
}
async function stop(p) {
  if (p && p.exitCode === null) { p.kill(); await new Promise((r) => p.once("exit", r)); }
}
let server, browser, socket;
try {
  browser = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=0",
    `--user-data-dir=${join(temp, "chrome")}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  const portFile = join(temp, "chrome", "DevToolsActivePort");
  await until(() => existsSync(portFile), "browser startup");
  const port = readFileSync(portFile, "utf8").split(/\r?\n/)[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => socket.addEventListener("open", r, { once: true }));
  let serial = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { const item = pending.get(message.id); pending.delete(message.id);
      if (message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result); }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const text = () => evaluate("document.body.innerText");
  const click = (label) => evaluate(`(() => { const e=[...document.querySelectorAll('button,summary,label')].find(e=>e.textContent.trim()===${JSON.stringify(label)}); if(!e) throw Error('Missing control: '+${JSON.stringify(label)}); e.click(); })()`);
  const fill = async (name, value) => {
    await until(() => evaluate(`(() => { const e=document.querySelector('[name="${name}"]'); return e && Object.keys(e).some(k=>k.startsWith('__reactProps') && typeof e[k].onChange === 'function'); })()`), `hydrated ${name}`);
    await evaluate(`(() => { const e=document.querySelector('[name="${name}"]'); const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  };
  const waitText = async (value) => {
    try { await until(async () => (await text()).toLowerCase().includes(value.toLowerCase()), value); }
    catch (error) { console.error(await text()); console.error(await evaluate("[...document.querySelectorAll('input,textarea,select')].map(e=>({name:e.name,value:e.value,valid:e.validity.valid}))")); throw error; }
  };
  const shot = async (name) => {
    const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    writeFileSync(join(screenshots, name + ".png"), Buffer.from(data, "base64"));
  };
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  let base, dataDir;
  const load = async (path = "/decisions") => {
    await cdp("Page.navigate", { url: base + "/initiatives/merchant-flex-finance" + path });
    await until(async () => await evaluate("document.readyState === 'complete' && !!document.querySelector('main')"), "page load");
    await sleep(500); // Hydration before interactions; every result below is explicitly awaited.
  };
  const start = async (scenario, writable = true) => {
    await stop(server);
    dataDir = join(temp, scenario); mkdirSync(dataDir);
    const seed = child(["--conditions=react-server", "--import", pathToFileURL(join(root, "scripts/db-test/test-alias.mjs")).href, join(root, "scripts/ui-test/seed.mjs"), scenario], dataDir);
    let seedLog = ""; seed.stderr.on("data", (b) => seedLog += b);
    assert.equal(await new Promise((r) => seed.on("exit", r)), 0, seedLog);
    server = child([join(root, "scripts/ui-test/server.mjs")], dataDir, { DEMO_WRITE_ENABLED: writable ? "true" : "false" });
    let log = ""; server.stdout.on("data", (b) => log += b); server.stderr.on("data", (b) => log += b);
    const match = await until(() => { if (server.exitCode !== null) throw Error(log); return log.match(/UI_TEST_PORT=(\d+)/); }, "app startup");
    base = `http://127.0.0.1:${match[1]}`; await load();
  };
  const persisted = () => JSON.parse(readFileSync(join(dataDir, ".data/prodwise.json"), "utf8"));

  await start("existing");
  await click("Make a decision");
  assert.deepEqual(await evaluate("[...document.querySelector('[name=chosenClaimId]').options].map(o=>o.text)"), ["Select a value", "27", "30"]);
  await click("Assign confirmer"); await fill("label", "Finance owner"); await click("Save confirmer");
  await waitText("Confirm with: Finance owner");
  await shot("01-actionable-desktop");
  await fill("chosenClaimId", await evaluate("[...document.querySelector('[name=chosenClaimId]').options].find(o=>o.text==='27').value"));
  await fill("rationale", "Keep this rationale on stale");
  // Simulate an old render token; the real action must refuse it without resetting controlled fields.
  await evaluate("document.querySelector('[name=choice]').form.querySelector('[name=contentDigest]').value='old-render'");
  await click("Save decision");
  await waitText("This changed while you were reviewing it. Reload and review the latest values.");
  assert.equal(await evaluate("document.querySelector('[name=rationale]').value"), "Keep this rationale on stale");
  assert.equal(persisted().findingStates[0].outcome, null);
  await shot("02-stale-input-preserved");
  await load(); await click("Make a decision"); await click("Enter corrected value");
  await fill("correctedValue", " ２７. "); await fill("rationale", "Finance confirmed 27");
  await waitText("This matches an existing value.");
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Save decision').disabled"), true);
  await click("Choose existing value instead"); await click("Save decision");
  await waitText("Decision record · Confirmed");
  assert.ok(!(await text()).includes("Assign confirmer"));
  const chosenStore = persisted();
  assert.equal(chosenStore.findingStates[0].decidedValue, "27");
  assert.equal(chosenStore.claims.find((c) => c.subject === "Daily Repayment" && c.value === "30").status, "SUPERSEDED");
  assert.equal(await evaluate("document.querySelector('#lane-needs-decision').textContent.includes('Make a decision')"), false);
  await load(); await waitText("Decision record · Confirmed");
  await shot("03-standing-decision");
  await load("/memory?view=claims"); await waitText("Chosen in a decision");
  await shot("04-chosen-knowledge");
  console.log("B1/B2/B3/B5/B7/B10/B12 passed (browser + persisted store)");

  await start("corrected"); await click("Make a decision"); await click("Enter corrected value");
  await fill("correctedValue", "28"); await fill("rationale", "Corrected after Finance review");
  await shot("05-corrected-form"); await click("Save decision"); await waitText("Decision record · Confirmed");
  const correctedStore = persisted();
  assert.equal(correctedStore.findingStates[0].outcome, "CORRECTED_VALUE");
  assert.equal(correctedStore.claims.filter((c) => c.origin === "HUMAN_DECISION" && c.value === "28").length, 1);
  await load("/memory?view=claims"); await waitText("Confirmed Decision entry"); await shot("06-corrected-knowledge");
  console.log("B6 passed (browser + persisted corrected entry)");

  await start("reemerged"); await waitText("Confirm with: New owner"); await click("Decided before");
  await waitText("Confirmed with: First owner"); await waitText("Prior decision rationale");
  assert.ok(!(await text()).includes("Review with a note only"));
  await shot("07-reemerged-decision");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  await shot("08-reemerged-mobile");
  console.log("B4/B8 passed; mobile has no horizontal overflow");

  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await start("legacy"); await waitText("Reviewed — note only"); await waitText("Knowledge was not changed.");
  assert.ok(!(await text()).includes("Hidden legacy owner")); await shot("09-legacy-note");
  console.log("B9 passed");
  await start("readonly", false);
  assert.equal(await evaluate("document.querySelectorAll('form').length"), 0);
  assert.ok(!(await text()).includes("Make a decision")); await shot("10-write-disabled");
  assert.equal(persisted().findingStates.length, 0);
  console.log("B11 passed; all Stage 2.2 browser checks passed");
} finally {
  socket?.close(); await stop(server); await stop(browser);
  // Delete only the exact disposable directory created by this invocation.
  assert.ok(resolve(temp).startsWith(resolve(tmpdir()) + "\\prodwise-ui-") || resolve(temp).startsWith(resolve(tmpdir()) + "/prodwise-ui-"));
  rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
