import { mutateExecutive } from '@/lib/executive/repository';
import { readPlanDate, savePlan } from '@/lib/executive/model';
import type { RoadmapPlan } from '@/lib/executive/types';
import { revalidatePath } from 'next/cache';
import { readDeliveryFresh } from '@/lib/delivery/repository';
import { factFor } from '@/lib/delivery/model';
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Origin not allowed.' }, { status: 403 });
  try {
    if (Number(request.headers.get('content-length')) > 30_000) throw Error('Plan is too large.');
    const input = await request.json();
    const text = (key: string) => typeof input[key] === 'string' ? input[key].trim() : '';
    const plan: RoadmapPlan = { id: text('id'), initiativeId:text('initiativeId')||null, name: text('name'), squad: text('squad'), workstream: text('workstream'), owner: text('owner'), outcome: text('outcome'),
      start: readPlanDate(text('start'), text('startPrecision')), target: readPlanDate(text('target'), text('targetPrecision')), originalTarget: null,
      actual: text('actual') || null, forecast: text('forecast') || null, status: text('status') as RoadmapPlan['status'], carryover: input.carryover === 'on',
      delayReason: text('delayReason'), nextAction: text('nextAction'), nextActionOwner: text('nextActionOwner'), source: text('source'), revision: Number(input.revision), updatedAt: '', updatedBy: '' };
    if(plan.initiativeId){
      const delivery=await readDeliveryFresh();
      const initiative=delivery.source.snapshots.find(s=>s.initiative.id===plan.initiativeId)?.initiative;
      if(!initiative||initiative.archivedAt||delivery.ctx.workspaceId!==text('workspaceId'))throw Error('Linked initiative is unavailable.');
      const facts=delivery.state.facts.filter(f=>f.workspaceId===delivery.ctx.workspaceId&&f.state==='SET');
      const target=factFor(facts,initiative.id,'TARGET_LIVE'),actual=factFor(facts,initiative.id,'ACTUAL_LIVE'),owner=factFor(facts,initiative.id,'OWNER');
      plan.name=initiative.name;plan.target=target?.value.date?{value:target.value.date,precision:'DAY'}:null;plan.actual=actual?.value.date??null;
      plan.owner=delivery.source.members.find(m=>m.id===owner?.value.memberId)?.displayName??'';
      // Linked plans are annotations; commitment truth remains in the delivery record.
      plan.status=plan.target?'COMMITTED':'PROPOSED';
    }
    await mutateExecutive(text('workspaceId'), (state, ctx) => savePlan(state, plan, ctx.actor.label, new Date().toISOString()));
    revalidatePath('/roadmap'); return Response.json({ ok: true });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : 'Could not save the plan.' }, { status: 400 }); }
}
