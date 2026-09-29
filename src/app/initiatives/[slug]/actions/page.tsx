import {notFound} from 'next/navigation';
import {readDelivery} from '@/lib/delivery/repository';
import {readCommitments} from '@/lib/data/commitments';
import {ownerFor,cairoDay} from '@/lib/delivery/model';
import {isDemoWriteEnabled} from '@/lib/env';
import {CommitmentWorkbench} from '@/components/initiative/CommitmentWorkbench';
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Actions" };
export const dynamic='force-dynamic';
export default async function InitiativeActions({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{action?:string}>}){
 const [{slug},q,d,c]=await Promise.all([params,searchParams,readDelivery(),readCommitments()]);const snap=d.source.snapshots.find(s=>s.initiative.slug===slug);if(!snap)notFound();
 return <CommitmentWorkbench slug={slug} initiativeId={snap.initiative.id} archived={Boolean(snap.initiative.archivedAt)} actions={c.actions.filter(a=>a.initiativeId===snap.initiative.id)} events={c.events.filter(e=>e.initiativeId===snap.initiative.id)} members={d.source.members} evidence={snap.evidence.map(e=>({id:e.id,title:e.title}))} ctx={d.ctx} ownerId={ownerFor(d.state.facts,snap.initiative.id)} writesEnabled={isDemoWriteEnabled} today={cairoDay(d.presentation.scenarioAt??new Date().toISOString())} selectedId={q.action}/>;
}
