import { requireBusinessWriteAccess } from '@/lib/auth/access';
import { workspacePresentation } from '@/lib/workspace/context';
import { assertPerformanceApproval } from '@/lib/executive/access';
import { prepareUploads, closeUpload } from '@/lib/executive/uploads';
export const maxDuration = 60;
async function handle(request:Request,close:boolean) {
  if(request.headers.get('origin')!==new URL(request.url).origin) return Response.json({error:'Origin not allowed.'},{status:403});
  try {
    const ctx=await requireBusinessWriteAccess(); assertPerformanceApproval(ctx);
    if((await workspacePresentation(ctx)).isDemo) throw Error('Switch to your organization before importing real files.');
    const text=await request.text();if(text.length>10_000)throw Error('Upload request is too large.');
    const body=JSON.parse(text);
    if(body.workspaceId!==ctx.workspaceId)throw Error('Your workspace changed. Reload before importing.');
    if(close){await closeUpload(ctx,String(body.id));return Response.json({closed:true});}
    return Response.json(await prepareUploads(ctx,body.files),{headers:{'Cache-Control':'no-store'}});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Upload unavailable.'},{status:400});}
}
export async function POST(request:Request){return handle(request,false);}
export async function DELETE(request:Request){return handle(request,true);}
