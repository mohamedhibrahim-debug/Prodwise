import { autoSyncAvailable, runAutoSync, syncWorkerSecret } from '@/lib/connectors/auto-sync';
import { validWorkerSecret } from '@/lib/connectors/worker-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!validWorkerSecret(request.headers.get('authorization'), syncWorkerSecret())) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (!autoSyncAvailable()) return Response.json({ error: 'Runner disabled' }, { status: 503, headers });
  try { return Response.json(await runAutoSync(), { headers }); }
  catch { return Response.json({ error: 'Runner unavailable' }, { status: 503, headers }); }
}
// Vercel cron invokes GET; POST remains available to the local runner.
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!validWorkerSecret(request.headers.get('authorization'), syncWorkerSecret())) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (!autoSyncAvailable()) return Response.json({ error: 'Runner disabled' }, { status: 503, headers });
  const counts: Record<string, number> = {}, started = Date.now();
  try {
    // Bounded drain: avoid a one-source-per-minute bottleneck without unbounded concurrency.
    for (let n = 0; n < 10 && Date.now() - started < 30_000; n++) {
      const result = await runAutoSync();
      counts[result.outcome] = (counts[result.outcome] ?? 0) + 1;
      if (result.outcome === 'IDLE') break;
    }
    return Response.json({ counts }, { headers });
  } catch { return Response.json({ error: 'Runner unavailable', counts }, { status: 503, headers }); }
}
