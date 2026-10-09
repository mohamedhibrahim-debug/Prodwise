import Link from 'next/link';
import { readExecutiveView } from '@/lib/executive/repository';
import { readDelivery } from '@/lib/delivery/repository';
import { factFor } from '@/lib/delivery/model';
import { canBusinessWrite } from '@/lib/auth/roles';
import { isDemoWriteEnabled } from '@/lib/env';
import { PageHeader } from '@/components/workspace/PageHeader';
import { AnnualRoadmap } from '@/components/executive/AnnualRoadmap';
import type { TimelineItem } from '@/lib/executive/roadmap-view';
import styles from '@/components/executive/Executive.module.css';

export const metadata = { title: 'Roadmap' };
export default async function Roadmap() {
  const [{ ctx, state, available }, delivery] = await Promise.all([readExecutiveView(), readDelivery()]);
  const legacy: TimelineItem[] = delivery.source.snapshots.filter(s => !s.initiative.archivedAt).map(({ initiative: i }) => {
    const facts = delivery.state.facts.filter(f => f.workspaceId === ctx.workspaceId && f.state === 'SET');
    const target = factFor(facts, i.id, 'TARGET_LIVE'), actual = factFor(facts, i.id, 'ACTUAL_LIVE'), owner = factFor(facts, i.id, 'OWNER');
    const events = delivery.state.events.filter(e => e.workspaceId === ctx.workspaceId && e.initiativeId === i.id && e.after.kind === 'TARGET_LIVE').sort((a,b) => a.occurredAt.localeCompare(b.occurredAt));
    const original = events.flatMap(e => [e.before, e.after]).find(f => f?.state === 'SET' && f.value.date)?.value.date;
    const annotation=state.plans.find(p=>p.initiativeId===i.id);
    return { id:annotation?.id??`initiative:${i.id}`, initiativeId:i.id, name:i.name, squad:annotation?.squad??'', workstream:annotation?.workstream??'', owner:delivery.source.members.find(m => m.id === owner?.value.memberId)?.displayName ?? '', outcome:annotation?.outcome||factFor(facts,i.id,'SCOPE')?.value.text||'',
      // Solution defined is a completion milestone, not the start of solution work.
      start:annotation?.start??null, target:target?.value.date ? {value:target.value.date,precision:'DAY'} : null, originalTarget:original ? {value:original,precision:'DAY'} : null,
      actual:actual?.value.date ?? null, actualPartial:actual?.value.extent === 'PARTIAL', forecast:annotation?.forecast??null, status:target?.value.date ? 'COMMITTED' : 'PROPOSED', carryover:annotation?.carryover??false,
      delayReason:annotation?.delayReason||factFor(facts,i.id,'BLOCKER')?.value.text||'', nextAction:annotation?.nextAction||factFor(facts,i.id,'NEXT_STEP')?.value.text||'', nextActionOwner:annotation?.nextActionOwner??'', source:annotation?.source??'Confirmed initiative delivery records',
      revision:annotation?.revision??0, updatedAt:annotation?.updatedAt??i.updatedAt, updatedBy:annotation?.updatedBy??'', deliveryHref:`/initiatives/${i.slug}/delivery` };
  });
  return <main className={styles.page}>
    <PageHeader title="Roadmap" meta={<>{delivery.presentation.organizationName} / Annual planning{delivery.presentation.isDemo ? ' / Synthetic demo records' : ''}</>} />
    <nav className={styles.tabs} aria-label="Roadmap views"><Link href="/roadmap" aria-current="page">Annual plan</Link><Link href="/roadmap/delivery">Delivery detail</Link></nav>
    {!available && <p className={styles.notice}>Planning storage is awaiting the database update. Existing delivery records remain available.</p>}
    <AnnualRoadmap items={[...state.plans.filter(p=>!p.initiativeId), ...legacy]} workspaceId={ctx.workspaceId} canWrite={available && canBusinessWrite(ctx) && isDemoWriteEnabled} today={(delivery.presentation.scenarioAt ?? new Date().toISOString()).slice(0,10)} events={state.planEvents} />
  </main>;
}
