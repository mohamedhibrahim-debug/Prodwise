import { validWorkerSecret } from '@/lib/connectors/worker-auth';
import { cleanupUploads } from '@/lib/executive/uploads';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export async function GET(request:Request) {
  if(!validWorkerSecret(request.headers.get('authorization'),process.env.CRON_SECRET))return Response.json({error:'Unauthorized'},{status:401});
  try {return Response.json(await cleanupUploads(),{headers:{'Cache-Control':'no-store'}});}
  catch {return Response.json({error:'Cleanup unavailable'},{status:503});}
}
