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
const screenshots = join(root, "docs/ui-review/ia-consolidation");
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
  const vocabularyGate = async (label) => {
    const visible = await text();
    assert.doesNotMatch(visible, /\b(?:Product Memory|claims?|evidence|Readiness|fingerprint|contentDigest|finding_state)\b/i, label);
    assert.doesNotMatch(visible, /\b(?:CONFLICT|ACTIVE)\b/, label);
  };
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
  const loadAbsolute = async (path) => {
    await cdp("Page.navigate", { url: base + path });
    await until(async () => await evaluate("document.readyState === 'complete' && !!document.querySelector('main')"), "page load");
    await sleep(500);
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
  const laneText = (id) => evaluate(`document.querySelector('#lane-${id}').innerText`);
  const inputs = () => evaluate(`(() => {
    const form=document.querySelector('[name=choice]').form;
    const value=(name)=>form.querySelector('[name="'+name+'"]')?.value ?? null;
    return { choice: form.querySelector('[name=choice]:checked').value,
      chosen: value('chosenClaimId'), corrected: value('correctedValue'),
      domain: value('decisionDomain'), rationale: value('rationale') };
  })()`);
  const mobileShot = async (name) => {
    await cdp("Emulation.setDeviceMetricsOverride", { width: 375, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
    await shot(name);
    await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  };

  await start("existing");
  for (const [oldPath, newPath] of [
    ["/memory", "/knowledge"], ["/memory/new", "/knowledge/new"],
    ["/memory/sample/edit", "/knowledge/sample/edit"], ["/memory/sample/verify", "/knowledge/sample/confirm"],
    ["/sources", "/knowledge/sources"], ["/sources/new", "/knowledge/sources/new"],
    ["/sources/sample/edit", "/knowledge/sources/sample/edit"], ["/readiness", ""],
  ]) {
    const response = await fetch(base + "/initiatives/merchant-flex-finance" + oldPath, { redirect: "manual" });
    assert.equal(response.status, 308, oldPath);
    assert.equal(new URL(response.headers.get("location"), base).pathname, "/initiatives/merchant-flex-finance" + newPath, oldPath);
  }
  await loadAbsolute("/"); await waitText("What needs attention now?"); await vocabularyGate("Home"); await shot("home-desktop-1440"); await mobileShot("home-mobile-375");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "k", code: "KeyK", modifiers: 2 });
  await until(() => evaluate("!!document.querySelector('[role=dialog][aria-label=\"Command palette\"]')"), "Ctrl+K opens search");
  assert.equal(await evaluate("document.activeElement?.getAttribute('aria-label')"), "Search commands");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
  await until(() => evaluate("!document.querySelector('[role=dialog][aria-label=\"Command palette\"]')"), "Escape closes search");
  await loadAbsolute("/initiatives"); await vocabularyGate("Initiatives");
  await loadAbsolute("/initiatives/new"); await vocabularyGate("Create Initiative");
  await loadAbsolute("/initiatives/merchant-flex-finance"); await waitText("Delivery facts"); await vocabularyGate("Brief"); await shot("brief-desktop-1440"); await mobileShot("brief-mobile-375");
  assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"Initiative sections\"] a').length"), 3);
  await loadAbsolute("/initiatives/merchant-flex-finance/knowledge"); await waitText("Knowledge"); await vocabularyGate("Knowledge"); await shot("knowledge-desktop-1440"); await mobileShot("knowledge-mobile-375");
  await loadAbsolute("/initiatives/merchant-flex-finance/knowledge/sources"); await waitText("Sources"); await vocabularyGate("Sources"); await shot("sources-desktop-1440"); await mobileShot("sources-mobile-375");
  await loadAbsolute("/initiatives/merchant-kyc-refresh"); await waitText("Set up this initiative"); await vocabularyGate("Setup"); await shot("setup-desktop-1440"); await mobileShot("setup-mobile-375");
  await loadAbsolute("/initiatives/merchant-flex-finance/knowledge/new"); await vocabularyGate("New Knowledge entry");
  await loadAbsolute("/initiatives/merchant-flex-finance/knowledge/sources/new"); await vocabularyGate("New Source");
  const entryId = persisted().claims.find((entry) => entry.status === "UNVERIFIED").id;
  const sourceId = persisted().evidence[0].id;
  await loadAbsolute(`/initiatives/merchant-flex-finance/knowledge/${entryId}/edit`); await vocabularyGate("Edit Knowledge entry");
  await loadAbsolute(`/initiatives/merchant-flex-finance/knowledge/${entryId}/confirm`); await vocabularyGate("Confirm Knowledge");
  await loadAbsolute(`/initiatives/merchant-flex-finance/knowledge/sources/${sourceId}/edit`); await vocabularyGate("Edit Source");
  await load(); await vocabularyGate("Decisions");
  const itemId = await evaluate("document.querySelector('#lane-needs-decision li[id^=item-]').id");
  await load(`/decisions?item=${encodeURIComponent(itemId.slice(5))}`);
  await until(() => evaluate(`document.activeElement?.id === ${JSON.stringify(itemId)}`), "decision deep link focus");
  await load();
  await click("Make a decision");
  assert.deepEqual(await evaluate("[...document.querySelector('[name=chosenClaimId]').options].map(o=>o.text)"), ["Select a value", "27", "30"]);
  await click("Assign confirmer"); await fill("label", "Finance owner"); await click("Save confirmer");
  await waitText("Confirm with: Finance owner");
  await shot("01-actionable-desktop");
  await fill("chosenClaimId", await evaluate("[...document.querySelector('[name=chosenClaimId]').options].find(o=>o.text==='27').value"));
  await fill("rationale", "Keep this rationale on stale");
  const existingInputs = await inputs();
  const beforeStale = persisted();
  // Simulate an old render token; the real action must refuse it without resetting controlled fields.
  await evaluate("document.querySelector('[name=choice]').form.querySelector('[name=contentDigest]').value='old-render'");
  await click("Save decision");
  await waitText("This changed while you were reviewing it. Reload and review the latest values.");
  assert.deepEqual(await inputs(), existingInputs);
  assert.deepEqual(persisted(), beforeStale);
  await shot("02-stale-input-preserved");
  await mobileShot("11-stale-existing-mobile");
  await load(); await click("Make a decision"); await click("Enter corrected value");
  await fill("correctedValue", " ２７. "); await fill("rationale", "Finance confirmed 27");
  await waitText("This matches an existing value.");
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Save decision').disabled"), true);
  await click("Choose existing value instead"); await click("Save decision");
  await waitText("Decision record · Confirmed");
  assert.match(await laneText("resolved"), /Decision record · Confirmed/i);
  assert.doesNotMatch(await laneText("reviewed"), /Decision record · Confirmed/i);
  assert.ok(!(await text()).includes("Assign confirmer"));
  const chosenStore = persisted();
  assert.equal(chosenStore.findingStates[0].decidedValue, "27");
  assert.equal(chosenStore.claims.find((c) => c.subject === "Daily Repayment" && c.value === "30").status, "SUPERSEDED");
  assert.equal(await evaluate("document.querySelector('#lane-needs-decision').textContent.includes('Make a decision')"), false);
  await load(); await waitText("Decision record · Confirmed");
  await shot("03-standing-decision");
  await mobileShot("12-resolved-mobile");
  await load("/knowledge"); await waitText("Confirmed");
  await shot("04-chosen-knowledge");
  console.log("B1/B2/B3/B5/B7/B10/B12 passed (browser + persisted store)");

  await start("corrected"); await click("Make a decision"); await click("Enter corrected value");
  await fill("correctedValue", "28"); await fill("rationale", "Corrected after Finance review");
  await shot("05-corrected-form"); await click("Save decision"); await waitText("Decision record · Confirmed");
  assert.match(await laneText("resolved"), /Decision record · Confirmed/i);
  assert.doesNotMatch(await laneText("reviewed"), /Decision record · Confirmed/i);
  const correctedStore = persisted();
  assert.equal(correctedStore.findingStates[0].outcome, "CORRECTED_VALUE");
  assert.equal(correctedStore.claims.filter((c) => c.origin === "HUMAN_DECISION" && c.value === "28").length, 1);
  await load("/knowledge"); await waitText("28"); await shot("06-corrected-knowledge");
  console.log("B6 passed (browser + persisted corrected entry)");

  await start("refusals"); await click("Make a decision");
  const keptId = await evaluate("[...document.querySelector('[name=chosenClaimId]').options].find(o=>o.text==='27').value");
  await fill("chosenClaimId", keptId);
  await click("Enter corrected value"); await fill("correctedValue", "28");
  await fill("decisionDomain", "TECHNICAL"); await fill("rationale", "Keep every corrected input on refusal");
  const correctedInputs = await inputs();
  const beforeRefusals = persisted();
  const currentDigest = await evaluate("document.querySelector('[name=choice]').form.querySelector('[name=contentDigest]').value");
  await evaluate("document.querySelector('[name=choice]').form.querySelector('[name=contentDigest]').value='old-render'");
  await click("Save decision");
  await waitText("This changed while you were reviewing it. Reload and review the latest values.");
  assert.deepEqual(await inputs(), correctedInputs);
  assert.deepEqual(persisted(), beforeRefusals);
  await shot("13-stale-corrected-desktop");
  await mobileShot("14-stale-corrected-mobile");
  // Mode changes must also retain the temporarily hidden input values.
  await click("Choose existing value"); assert.equal((await inputs()).chosen, keptId);
  await click("Enter corrected value"); assert.deepEqual(await inputs(), correctedInputs);
  // Whitespace satisfies native required validation but is refused by the
  // actual server/domain as RATIONALE_REQUIRED, not by client duplicate checks.
  await fill("rationale", "   ");
  await evaluate(`document.querySelector('[name=choice]').form.querySelector('[name=contentDigest]').value=${JSON.stringify(currentDigest)}`);
  const refusedCorrectedInputs = await inputs();
  await click("Save decision"); await waitText("Explain why you are making this decision.");
  assert.deepEqual(await inputs(), refusedCorrectedInputs);
  assert.deepEqual(persisted(), beforeRefusals);
  await shot("15-server-refusal-desktop");
  await mobileShot("16-server-refusal-mobile");
  await click("Choose existing value");
  const refusedExistingInputs = await inputs();
  assert.equal(refusedExistingInputs.chosen, keptId);
  await click("Save decision");
  await until(() => evaluate("!document.querySelector('[name=choice]').matches(':disabled')"), "refusal settled");
  await waitText("Explain why you are making this decision.");
  assert.deepEqual(await inputs(), refusedExistingInputs);
  assert.deepEqual(persisted(), beforeRefusals);
  console.log("B10 hardened: both modes, selected value, corrected value, domain, rationale preserved; stale and server/domain refusals write nothing");

  await start("reemerged"); await waitText("Confirm with: New owner"); await click("Decided before");
  await waitText("Confirmed with: First owner"); await waitText("Prior decision rationale");
  const previous = persisted().findingStates.find((s) => s.outcome);
  const previousTimestamp = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }).format(new Date(previous.resolvedAt));
  const previousText = await laneText("needs-decision");
  assert.ok(previousText.includes(`Chosen value: ${previous.decidedValue}`));
  assert.ok(previousText.includes(previous.resolution));
  assert.ok(previousText.includes(`Confirmed with: ${previous.confirmedWith}`));
  assert.ok(previousText.includes(`${previousTimestamp} UTC`));
  assert.ok(previousText.includes("Values differ again"));
  assert.ok(previousText.includes("Make a decision"));
  assert.doesNotMatch(await laneText("resolved"), /Daily Repayment|Decision record · Confirmed/i);
  assert.ok(!(await text()).includes("Review with a note only"));
  await shot("07-reemerged-decision");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 375, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  await shot("08-reemerged-mobile");
  console.log("B4/B8 passed; mobile has no horizontal overflow");

  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await start("legacy"); await waitText("Reviewed — note only"); await waitText("Knowledge was not changed.");
  assert.match(await laneText("reviewed"), /Reviewed — note only/i);
  assert.match(await laneText("reviewed"), /Legacy review note/);
  assert.match(await laneText("reviewed"), /Knowledge was not changed/);
  assert.doesNotMatch(await laneText("resolved"), /Legacy review note|Reviewed — note only|Daily Repayment/i);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('section[id^=lane-]')].map(e=>e.id)"),
    ["lane-needs-decision", "lane-reviewed", "lane-resolved", "lane-history", "lane-not-checked"]);
  assert.ok(!(await text()).includes("Hidden legacy owner")); await shot("09-legacy-note");
  await mobileShot("17-reviewed-mobile");
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
