import { readExecutive, mutateExecutive } from '@/lib/executive/repository';
import { parseCsvImport, parseExcelImport, type ParsedImport } from '@/lib/executive/import';
import { mergeRows, publishImport, sumAmounts, validDay, validateProduct } from '@/lib/executive/model';
import { requireBusinessWriteAccess } from '@/lib/auth/access';
import { workspacePresentation } from '@/lib/workspace/context';
import type { BusinessUnit } from '@/lib/executive/types';
import { revalidatePath } from 'next/cache';
import { assertPerformanceApproval } from '@/lib/executive/access';
import { createHash } from 'node:crypto';
import { stagedFiles, closeUpload } from '@/lib/executive/uploads';
import { isLocalAuth } from '@/lib/auth/service';

export const maxDuration = 300;
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error:'Origin not allowed.' }, {status:403});
  try {
    const ctx = await requireBusinessWriteAccess();
    assertPerformanceApproval(ctx);
    if ((await workspacePresentation(ctx)).isDemo) throw Error('Real business files cannot be imported into the shared synthetic demo. Switch to your organization.');
    if (Number(request.headers.get('content-length')) > 26_000_000) throw Error('Upload a file smaller than 25 MB.');
    const form = await request.formData();
    if (form.get('workspaceId') !== ctx.workspaceId) throw Error('Your workspace changed. Reload before importing.');
    const uploadId = String(form.get('uploadId') ?? '');
    if (!isLocalAuth() && !uploadId) throw Error('Prepare a private upload before importing.');
    const files = uploadId ? await stagedFiles(ctx,uploadId) : form.getAll('file');
    if (!files.length || files.length > 12 || files.some(file => !(file instanceof File) || !file.size)) throw Error('Select 1 to 12 non-empty source files.');
    const uploads = files as File[];
    if (uploads.reduce((sum,file)=>sum+file.size,0) > 25_000_000) throw Error('Selected files must total less than 25 MB.');
    const product = validateProduct(form.get('product'));
    const unit = String(form.get('businessUnit') ?? 'UNASSIGNED') as BusinessUnit;
    if (!['BP','FS','UNASSIGNED'].includes(unit)) throw Error('Select a valid business unit.');
    if (form.get('sourceConfirmed') !== 'true') throw Error('Confirm that the export is in EGP and the source conditions match.');
    const batch: {file:File;parsed:ParsedImport}[] = [];
    for (const file of uploads) {
      const extension = file.name.toLowerCase().split('.').pop();
      if (!['csv','xlsx'].includes(extension ?? '')) throw Error('Upload CSV exports or PGW XLSX reports.');
      try {
        const parsed = extension === 'xlsx'
          ? await parseExcelImport(new Uint8Array(await file.arrayBuffer()), product, unit)
          : parseCsvImport(await file.text(), product, unit);
        batch.push({file,parsed});
      } catch(e) { throw Error(`${file.name}: ${e instanceof Error?e.message:'Could not read file.'}`); }
    }
    const rows = batch.flatMap(item=>item.parsed.rows);
    const dates = batch.flatMap(item=>[item.parsed.firstDate,item.parsed.lastDate]).sort();
    const digest = createHash('sha256').update(JSON.stringify(batch.map(item=>item.parsed.digest))).digest('hex');
    const parsed = {rows,firstDate:dates[0]!,lastDate:dates.at(-1)!,digest,source:batch[0]!.parsed.source,excluded:batch.reduce((sum,item)=>sum+item.parsed.excluded,0)};
    const start = String(form.get('periodStart') ?? ''), end = String(form.get('periodEnd') ?? '');
    const coverage = form.get('coverage') === 'COMPLETE' ? 'COMPLETE' : 'PARTIAL';
    if (!validDay(start) || !validDay(end) || start > parsed.firstDate || end < parsed.lastDate || start > end) throw Error(`Reporting coverage must include all rows (${parsed.firstDate} to ${parsed.lastDate}).`);
    const { state } = await readExecutive();
    const merged = mergeRows(state.rows,parsed.rows);
    const unique = mergeRows([],rows).added;
    const seen = new Set(state.imports.map(item=>item.digest));
    const fileSummaries = batch.map(({file,parsed:item})=>{
      const alreadyImported=seen.has(item.digest);seen.add(item.digest);
      return {name:file.name,rows:item.rows.length,firstDate:item.firstDate,lastDate:item.lastDate,alreadyImported};
    });
    const summary = { source:parsed.source, rows:unique.length, excluded:parsed.excluded, added:merged.added.length, duplicates:merged.duplicates,
      gross:sumAmounts(unique.filter(r=>r.kind!=='REFUND'))/100, refunds:sumAmounts(unique.filter(r=>r.kind==='REFUND'))/100,
      firstDate:parsed.firstDate,lastDate:parsed.lastDate,digest:parsed.digest, alreadyImported:fileSummaries.every(item=>item.alreadyImported),files:fileSummaries };
    if (form.get('mode') !== 'publish') return Response.json(summary);
    if (form.get('digest') !== parsed.digest) throw Error('The file changed after preview. Preview it again.');
    await mutateExecutive(ctx.workspaceId, (current,fresh) => {
      assertPerformanceApproval(fresh);
      let next=current;
      for(const {file,parsed:item} of batch){
        if(next.imports.some(record=>record.digest===item.digest))continue;
        next=publishImport(next,item.rows,{fileName:file.name.slice(0,200),digest:item.digest,product,source:item.source,
          periodStart:item.firstDate,periodEnd:item.lastDate,coverage:'PARTIAL',recordedAt:new Date().toISOString(),recordedBy:fresh.actor.label,
          rowCount:item.rows.length,excluded:item.excluded,note:String(form.get('note')??'').slice(0,2000)});
      }
      if(next===current)throw Error('All selected files are already imported.');
      // The declared coverage belongs to the whole atomically approved batch, not each monthly file.
      if(batch.length===1){
        next={...next,imports:next.imports.map(item=>item.digest===batch[0]!.parsed.digest?{...item,periodStart:start,periodEnd:end,coverage}:item)};
      } else {
        next={...next,imports:[...next.imports,{...next.imports.at(-1)!,id:crypto.randomUUID(),fileName:`Batch / ${batch.length} source files`,digest:`batch:${digest}`,periodStart:start,periodEnd:end,coverage,rowCount:unique.length,added:0,duplicates:0,excluded:0,note:`Batch coverage approval. ${String(form.get('note')??'').slice(0,1800)}`} ]};
      }
      return next;
    });
    if(uploadId) await closeUpload(ctx,uploadId).catch(()=>undefined);
    revalidatePath('/analysis/business'); return Response.json({ ...summary,published:true });
  } catch (e) { return Response.json({ error:e instanceof Error ? e.message : 'Import failed. Nothing was published.' }, {status:400}); }
}
