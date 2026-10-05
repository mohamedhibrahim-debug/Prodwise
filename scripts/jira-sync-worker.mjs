// Local development runner. Reads .env.local via Node --env-file; never logs its secret.
const origin = new URL(process.env.PRODWISE_LOCAL_SYNC_URL || 'http://localhost:3217');
if (process.env.AUTH_MODE !== 'local' || process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV || !['localhost', '127.0.0.1'].includes(origin.hostname) || origin.protocol !== 'http:' || origin.username || origin.password) throw new Error('This runner is restricted to local development.');
if (process.env.JIRA_AUTO_SYNC_ENABLED !== 'true' || (process.env.JIRA_SYNC_SECRET?.length ?? 0) < 32) throw new Error('Configure local background sync before starting the runner.');
let stopped = false;
process.on('SIGTERM', () => { stopped = true; });
process.on('SIGINT', () => { stopped = true; });
do {
  try {
    const response = await fetch(new URL('/api/internal/jira-sync', origin), { method: 'POST', redirect: 'error', headers: { authorization: `Bearer ${process.env.JIRA_SYNC_SECRET}` }, signal: AbortSignal.timeout(270_000) });
    if (!response.ok) console.error(`${new Date().toISOString()} runner HTTP ${response.status}`);
    else { const result = await response.json(); if (result.outcome !== 'IDLE') console.log(`${new Date().toISOString()} ${result.outcome}`); }
  } catch { console.error(`${new Date().toISOString()} runner unavailable`); }
  if (process.argv.includes('--once')) break;
  if (!stopped) await new Promise(resolve => setTimeout(resolve, 15_000));
} while (!stopped);
