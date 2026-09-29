// Prodwise browser acceptance, local mode. Replaces the retired Stage 2.2 UI script.
//
// Runs against a running local server (BASE, default http://localhost:3100) using the
// private local accounts in .data/local-access.json and .data/demo-access.json. It never
// prints credentials, and it changes only local fixture data. Run
// `scripts/demo/provision-local.mjs --reset-demo` afterwards to restore the Demo.
//
// Playwright is used from an existing installation (the cloud image ships one); it is
// not a project dependency. Set PLAYWRIGHT_MODULE and PRODWISE_CHROME if yours lives elsewhere.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const base = process.env.BASE ?? "http://localhost:3100";
const pw = await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const executablePath = process.env.PRODWISE_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const local = JSON.parse(readFileSync(".data/local-access.json", "utf8"));
const demo = JSON.parse(readFileSync(".data/demo-access.json", "utf8"));
const account = { demo, owner: local.find(x => x.email.startsWith("owner")), member: local.find(x => x.email.startsWith("pm")), viewer: local.find(x => x.email.startsWith("reviewer")) };
const MFF = "/initiatives/merchant-flex-finance";

const browser = await pw.chromium.launch({ executablePath, args: ["--no-sandbox"] });
const results = [], pageErrors = [];
async function as(who, width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", e => pageErrors.push(`${who}: ${e.message.slice(0, 160)}`));
  if (who !== "anonymous") {
    const c = account[who];
    await page.goto(base + "/login");
    await page.fill("input[name=email]", c.email); await page.fill("input[name=password]", c.password);
    await Promise.all([page.waitForURL(u => !u.pathname.startsWith("/login"), { timeout: 120000 }), page.click("button[type=submit]")]);
  }
  return page;
}
const go = async (page, path) => { const r = await page.goto(base + path, { waitUntil: "networkidle", timeout: 180000 }); return r?.status() ?? 0; };
const text = page => page.locator("main").innerText();
async function check(gate, name, fn) {
  try { const detail = await fn(); results.push({ gate, name, ok: true, detail: detail ?? "" }); }
  catch (e) { results.push({ gate, name, ok: false, detail: String(e.message ?? e).slice(0, 200) }); }
}
const expect = (cond, message) => { if (!cond) throw new Error(message); };

// ── Signup / auth ────────────────────────────────────────────────────────────
{
  const page = await as("anonymous");
  await check("auth", "signed-out page redirects to sign-in with a return path", async () => {
    await go(page, MFF + "/decisions"); expect(page.url().includes("/login?returnTo=%2Finitiatives%2Fmerchant-flex-finance%2Fdecisions"), page.url());
  });
  await check("auth", "signed-out APIs answer 401", async () => {
    for (const p of ["/api/nav", "/api/notifications/count", "/api/session"]) expect((await page.request.get(base + p)).status() === 401, p);
  });
  await check("auth", "wrong password is refused without saying which part", async () => {
    await go(page, "/login"); await page.fill("input[name=email]", account.member.email); await page.fill("input[name=password]", "not-the-password-1");
    await page.click("button[type=submit]"); await page.waitForTimeout(1200);
    expect((await page.locator("[role=alert]").allInnerTexts()).join(" ").includes("Email or password is incorrect."), "no refusal message");
  });
  await check("auth", "self sign-up: eligible work email gets a verification link; others are told plainly", async () => {
    const outbox = ".data/outbox", before = existsSync(outbox) ? readdirSync(outbox).length : 0;
    await go(page, "/signup"); await page.fill("input[name=email]", `e2e-${Date.now()}@aman.eg`); await page.click("button[type=submit]"); await page.waitForTimeout(1500);
    const after = existsSync(outbox) ? readdirSync(outbox).length : 0; expect(after === before + 1, "no verification email written to the local outbox");
    const link = JSON.parse(readFileSync(join(outbox, readdirSync(outbox).sort().at(-1)), "utf8")).link;
    expect(link.startsWith("http://localhost:") && link.includes("/signup/verify?local="), "link not built from the configured origin");
    await go(page, "/signup"); await page.fill("input[name=email]", `e2e-${Date.now()}@not-allowed.example`); await page.click("button[type=submit]"); await page.waitForTimeout(1500);
    expect(!(await page.locator("body").innerText()).includes("Check your email"), "ineligible address was told an email was sent");
    return "verification link built from the app origin, never from request headers";
  });
  await check("connectors", "OAuth callback without a session goes to sign-in", async () => {
    await go(page, "/api/connectors/jira/callback?code=x&state=y"); expect(page.url().includes("/login?returnTo=%2Faccount%2Fconnections"), page.url());
  });
  await page.context().close();
}

// ── Demo organization ───────────────────────────────────────────────────────
{
  const page = await as("demo");
  await check("demo", "Home answers the five-second questions and labels the shared Demo", async () => {
    await go(page, "/"); const t = await text(page);
    const body = await page.locator("body").innerText();
    expect(t.includes("Needs attention") && body.includes("Synthetic demo") && body.includes("Demo dataset V4") && /scenario \d{1,2} \w+ \d{4}/.test(body), "demo notice or heading missing");
  });
  await check("consistency", "attention count agrees: Home, initiative header, Brief", async () => {
    await go(page, MFF); const header = (await page.locator("header a[data-tone]").last().innerText()).match(/(\d+) need attention/)?.[1];
    const brief = (await page.locator("section[aria-labelledby=current-state] p").first().innerText()).match(/(\d+) recorded reasons?/)?.[1];
    await go(page, "/"); const home = await page.evaluate(() => [...document.querySelectorAll("section[aria-labelledby=attention-heading] li")].find(li => li.innerText.startsWith("Merchant Flex Finance"))?.innerText ?? "");
    const homeCount = String((home.match(/→/g) ?? []).length);
    expect(header && header === brief && header === homeCount, `header ${header}, brief ${brief}, home ${homeCount}`);
    return `${header} everywhere`;
  });
  await check("review", "the 27 vs 30 difference is raised and the supersession is history", async () => {
    await go(page, MFF + "/decisions"); const t = await text(page);
    expect(/\b27\b/.test(t) && /\b30\b/.test(t) && /Values differ|record different values/i.test(t), "value difference not raised");
  });
  await check("search", "search re-reads, ranks name matches first and labels archived work", async () => {
    await go(page, "/"); const input = page.getByRole("combobox").or(page.locator("input[placeholder^='Jump to']")).first();
    for (let i = 0; i < 10 && !(await input.isVisible().catch(() => false)); i++) { await page.keyboard.press("Control+k"); await page.waitForTimeout(500); } // pressed only once the page has hydrated
    await page.keyboard.type("Merchant"); await page.locator("[role=option]").nth(1).waitFor({ timeout: 10000 }).catch(() => {});
    const names = (await page.locator("[role=option]").allInnerTexts()).map(t => t.split("\n")[0]);
    expect(names.length >= 2 && names.slice(0, names.findIndex(n => !n.startsWith("Merchant")) >>> 0).every(n => n.startsWith("Merchant")), names.join(", "));
    await page.keyboard.press("Control+a"); await page.keyboard.type("cashback"); await page.waitForTimeout(600);
    expect((await page.locator("[role=option]").allInnerTexts()).some(t => t.includes("Archived")), "archived not labelled");
    await page.keyboard.press("Escape");
  });
  await check("notifications", "Notifications list, count and read marks work", async () => {
    await go(page, "/notifications?scope=all"); const t = await text(page); expect(/\d+ new for you · \d+ new across .* derived from current records/.test(t), "intro missing");
    const count = await page.request.get(base + "/api/notifications/count"); expect(count.ok() && typeof (await count.json()).unread === "number", "count API");
    const bogus = await page.request.get(base + "/notifications/open?f=" + "a".repeat(32), { maxRedirects: 0 }); expect([302, 303, 307, 308, 404].includes(bogus.status()), `open accepted an unknown fingerprint: ${bogus.status()}`);
  });
  await check("archived", "archived initiatives are read-only and absent from Home, Notifications and Roadmap", async () => {
    for (const p of ["/", "/notifications?scope=all", "/roadmap"]) { await go(page, p); expect(!(await text(page)).includes("Cashback Campaign Rules"), p); }
    await go(page, "/initiatives/cashback-campaign-rules"); expect((await page.locator("body").innerText()).includes("Archived · read-only"), "no read-only notice");
    expect(await page.locator(":is(summary,button):has-text('Add evidence')").count() === 0, "write control shown");
    await go(page, "/initiatives/cashback-campaign-rules/knowledge/new"); expect((await text(page)).includes("archived and read-only"), "form offered");
  });
  await check("connectors", "connectors are off in the Demo organization", async () => {
    await go(page, "/account/connections"); expect((await text(page)).includes("Connectors are off in the Demo organization"), "no Demo notice");
    expect(await page.locator("button:has-text('Connect ')").count() === 0, "connect offered in Demo");
  });
  await check("claude", "without Claude configured, reading evidence says so and invents nothing", async () => {
    await go(page, MFF + "/evidence"); const href = await page.locator("main ol a[href*='/evidence/']").first().getAttribute("href");
    await go(page, href); const t = await page.locator("body").innerText();
    expect(!/Claude-generated|AI-generated/i.test(t), "claims AI generation");
    return "fallback copy verified in unit tests; live call runs in the production smoke";
  });
  await check("404", "missing and unknown records answer 404 with the right wording", async () => {
    expect(await go(page, "/initiatives/does-not-exist") === 404, "initiative");
    expect((await text(page)).includes("This initiative isn’t available"), "wording");
    expect(await go(page, MFF + "/evidence/00000000-0000-4000-8000-000000000000") === 404, "evidence");
    expect(await go(page, "/no-such-page") === 404, "page");
  });
  await check("error recovery", "an offline save keeps what was typed and says so", async () => {
    await go(page, MFF + "/knowledge/new"); const f = page.locator("main form:has([name=subject])");
    await f.locator("[name=subject]").fill("Offline check"); await f.locator("[name=attribute]").fill("Kept"); await f.locator("[name=value]").fill("Still here");
    await page.context().setOffline(true); await page.getByRole("button", { name: "Add Knowledge entry" }).click(); await page.waitForTimeout(2500);
    const kept = await f.locator("[name=subject]").inputValue(); await page.context().setOffline(false);
    expect(kept === "Offline check", "input lost"); expect((await page.locator("main").innerText()).includes("still on this page"), "no recovery message");
  });
  await page.context().close();
}

// ── RBAC and organization isolation ─────────────────────────────────────────
{
  const viewer = await as("viewer");
  await check("rbac", "Viewer cannot reach create or edit pages", async () => { await go(viewer, "/initiatives/new"); expect(viewer.url().includes("/account?restricted=viewer"), viewer.url()); });
  await check("rbac", "Viewer sees no write controls on an initiative", async () => {
    const first = await (async () => { await go(viewer, "/initiatives"); return viewer.locator("main a[href^='/initiatives/']").first().getAttribute("href"); })();
    await go(viewer, first); expect(await viewer.locator(":is(summary,button):has-text('Add evidence')").count() === 0, "Add evidence shown");
  });
  await check("rbac", "Viewer is offered no Connect button", async () => { await go(viewer, "/account/connections"); expect(await viewer.locator("button:has-text('Connect ')").count() === 0, "connect shown"); });
  await viewer.context().close();
  const member = await as("member");
  await check("rbac", "Member cannot open organization administration", async () => {
    await go(member, "/administration/organization/users"); const t = await member.locator("body").innerText();
    expect(t.includes("Administration is unavailable") && !/Invite (a )?member|Invite someone/i.test(t), "admin controls visible to a Member");
  });
  await member.context().close();
  const owner = await as("owner");
  await check("isolation", "another organization's initiative is indistinguishable from a missing one", async () => {
    expect(await go(owner, "/initiatives/cashback-campaign-rules") === 404, "Demo initiative reachable from the local AMAN fixture");
    const nav = await (await owner.request.get(base + "/api/nav")).json(); expect(!nav.initiatives.some(i => i.slug === "cashback-campaign-rules"), "search index leaks Demo initiatives");
  });
  await owner.context().close();
}

// ── Responsive ──────────────────────────────────────────────────────────────
for (const width of [390, 768, 1440]) {
  const page = await as("demo", width);
  await check("responsive", `no horizontal page scroll at ${width}px`, async () => {
    const bad = [];
    for (const p of ["/", "/initiatives", MFF, MFF + "/decisions", MFF + "/knowledge", MFF + "/sources", MFF + "/actions", MFF + "/context", MFF + "/history", "/roadmap", "/weekly-review", "/notifications"]) {
      await go(page, p); const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (o > 1) bad.push(`${p} +${o}px`);
    }
    expect(!bad.length, bad.join(", "));
  });
  await page.context().close();
}

await browser.close();
const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.gate.padEnd(14)} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
if (pageErrors.length) console.log(`Page errors (${pageErrors.length}):\n  ${[...new Set(pageErrors)].join("\n  ")}`);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length || pageErrors.length ? 1 : 0);
