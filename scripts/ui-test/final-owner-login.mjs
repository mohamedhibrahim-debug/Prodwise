import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// Read-only UI gate. Only sign-in and sign-out may send mutations.
// Passwords, page bodies, traces, screenshots and raw browser errors are never emitted.
const base = 'http://127.0.0.1:3200';
const emails = ['mohamed.hibrahim@aman.eg', 'mohamedhassanpe@outlook.com'];
const credentialPath = '.data/local-access.json';
const checks = [];
const failures = [];
let browser;
let phase = 'private credential preflight';
let activeEmail = 'preflight';
function check(condition, label) {
  assert.ok(condition, 'Controlled owner-login assertion failed');
  checks.push({ email: activeEmail, label });
  console.log(`PASS: ${activeEmail} — ${label}`);
}
try {
  const ignored = spawnSync('git', ['check-ignore', '-q', credentialPath], { encoding: 'utf8' });
  const tracked = spawnSync('git', ['ls-files', '--', credentialPath], { encoding: 'utf8' });
  assert.ok(ignored.status === 0 && tracked.status === 0 && !tracked.stdout.trim());
  const credentials = JSON.parse(readFileSync(resolve(credentialPath), 'utf8'));
  for (const email of emails) {
    const matches = credentials.filter(item => item.email === email);
    assert.ok(matches.length === 1 && typeof matches[0].password === 'string' && matches[0].password.length > 0);
  }
  phase = 'isolated browser startup';
  const { chromium } = await import(pathToFileURL('C:/Users/mohamed.hibrahim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
  browser = await chromium.launch({
    executablePath: 'C:/Users/mohamed.hibrahim/.cache/puppeteer/chrome-headless-shell/win64-152.0.7977.54/chrome-headless-shell-win64/chrome-headless-shell.exe',
    headless: true,
  });
  for (const email of emails) {
    activeEmail = email;
    let context;
    try {
      context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      let prohibitedMutation = false;
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== base) return route.abort();
        if (!['GET', 'HEAD'].includes(request.method()) && !['sign-in', 'sign-out'].includes(phase)) {
          prohibitedMutation = true;
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(25_000);
      phase = 'sign-in';
      const loginResponse = await page.goto(base + '/login');
      assert.ok(loginResponse?.ok());
      await page.locator('[name=email]').fill(email);
      await page.locator('[name=password]').fill(credentials.find(item => item.email === email).password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL(url => url.origin === base && url.pathname === '/');
      const accountMenu = page.locator('details').filter({ has: page.locator('a[href="/account"]') });
      assert.equal(await accountMenu.count(), 1);
      const organizationName = await accountMenu.locator('..').locator('strong').first().innerText();
      check(organizationName === 'AMAN', 'Sign-in succeeds in AMAN');

      phase = 'account role display';
      await accountMenu.locator('summary').click();
      check(await accountMenu.getByText('Organization role: ORG_OWNER', { exact: false }).isVisible()
        && await accountMenu.getByText('Platform role: PLATFORM_OWNER', { exact: true }).isVisible()
        && await accountMenu.getByRole('link', { name: 'Users', exact: true }).isVisible()
        && await accountMenu.getByRole('link', { name: 'Platform administration', exact: true }).isVisible(),
      'Account menu shows ORG_OWNER and PLATFORM_OWNER with access links');

      phase = 'Users read-only inspection';
      await accountMenu.getByRole('link', { name: 'Users', exact: true }).click();
      await page.waitForURL(url => url.pathname === '/users');
      assert.ok(await page.getByRole('heading', { name: 'Users', exact: true }).isVisible());
      const member = page.getByText(email, { exact: true }).first().locator('..');
      const roleText = await member.innerText();
      check(roleText.includes('ORG_OWNER · Active')
        && await page.locator('select[name=role] option[value=ORG_OWNER]').count() === 0
        && await page.locator('select[name=role] option[value=PLATFORM_OWNER]').count() === 0,
      'Users is accessible; own membership is active ORG_OWNER; protected roles are not normally assignable');

      phase = 'Platform read-only inspection';
      const platformResponse = await page.goto(base + '/platform');
      check(platformResponse?.ok()
        && await page.getByRole('heading', { name: 'Platform administration', exact: true }).isVisible()
        && await page.locator('summary').getByText('Create organization', { exact: true }).isVisible()
        && await page.locator('summary').getByText('Access policy for AMAN', { exact: true }).isVisible()
        && await page.locator('summary').getByText('Grant organization access for AMAN', { exact: true }).isVisible(),
      'Platform page and organization management controls are accessible');

      phase = 'sign-out';
      const logoutMenu = page.locator('details').filter({ has: page.locator('a[href="/account"]') });
      await logoutMenu.locator('summary').click();
      await logoutMenu.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.waitForURL(url => url.pathname === '/login');
      await page.goto(base + '/users');
      await page.waitForURL(url => url.pathname === '/login');
      check(!prohibitedMutation, 'Sign-out revokes access; no business or administration mutations attempted');
    } catch {
      failures.push({ email, phase });
      console.log(`FAIL: ${email} — ${phase} (raw error suppressed to protect private data)`);
    } finally {
      await context?.close();
    }
  }
} catch {
  failures.push({ email: activeEmail, phase });
  console.log(`FAIL: ${phase} (raw error suppressed to protect private data)`);
} finally {
  await browser?.close();
}

const now = new Date().toISOString();
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
const sha = revision.status === 0 ? revision.stdout.trim() : 'unavailable';
const rows = emails.map(email => `| ${email} | ${checks.filter(item => item.email === email).length}/5 | ${failures.some(item => item.email === email) ? 'FAIL' : checks.filter(item => item.email === email).length === 5 ? 'PASS' : 'NOT RUN'} |`).join('\n');
writeFileSync(resolve('docs/OWNER-LOGIN-REGRESSION.md'), `# Local owner login regression\n\nTested ${now} against ${base}. Checkout HEAD: \`${sha}\`; includes uncommitted final MVP integration changes.\n\n**Result: ${failures.length === 0 && checks.length === 10 ? 'PASS' : 'FAIL'} — ${checks.length}/10 checks passed, ${failures.length} failed phases.**\n\n| Account | Checks passed | Result |\n| --- | --- | --- |\n${rows}\n\nEach account used a separate, fresh browser context with existing private credentials. The credential file was verified ignored and untracked; no credential values were printed.\n\nThe five checks per account were:\n\n1. Successful sign-in and visible AMAN organization context.\n2. Account menu displays organization role ORG_OWNER and independent platform role PLATFORM_OWNER, with Users and Platform links.\n3. Users page is accessible, the account has active ORG_OWNER membership, and normal role selectors do not offer ORG_OWNER or PLATFORM_OWNER.\n4. Platform administration loads with Create organization, AMAN access policy, and AMAN access granting controls. These forms were not submitted.\n5. Sign-out returns to login and a subsequent Users visit remains denied. A request guard blocks business or administration mutations during inspection.\n\nNo screenshots, traces, page-body dumps, business edits, resets, production requests, or user-browser interactions were performed. Only normal local sign-in/sign-out session writes occurred. These checks establish current UI access and authentication; they do not claim fresh mutation-path authorization coverage.\n\n${failures.length ? 'Failed phases: ' + failures.map(item => item.email + ' — ' + item.phase).join('; ') + '.\n' : 'Blockers: none.\n'}\nRe-run from the integration root: \`node scripts/ui-test/final-owner-login.mjs\`.\n`, 'utf8');
console.log(`Owner login regression: ${checks.length}/10 passed; failed phases: ${failures.length}.`);
if (failures.length || checks.length !== 10) process.exitCode = 1;
