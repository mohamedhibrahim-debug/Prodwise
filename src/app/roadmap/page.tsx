import type { Metadata } from "next";
import {readManagement} from '@/lib/data/management-read';
import {factDate} from '@/lib/delivery/display';
import {readDelivery} from '@/lib/delivery/repository';
import {dateValid,factFor} from '@/lib/delivery/model';
import {displayDate} from '@/lib/delivery/roadmap';
import {buildPortfolioProjection} from '@/lib/workspace/portfolio';
import {BUSINESS_LINE_LABEL,businessLineText,STAGE_LABEL} from '@/lib/domain/labels';
import {WriteNotice} from '@/components/delivery/WriteNotice';
import {readRelationships} from '@/lib/data/relationships';
import {relationshipsFor} from '@/lib/workspace/relationship-view';
import {parseFilters,type RoadmapItem} from '@/lib/workspace/roadmap-layout';
import {RoadmapView} from '@/components/roadmap/RoadmapView';
import {PageHeader} from '@/components/workspace/PageHeader';
import {ButtonLink} from '@/components/primitives/Button';
import {formatDate} from '@/lib/domain/labels';
import styles from './roadmap.module.css';
export const metadata: Metadata = { title: "Roadmap" };

export default async function Roadmap({searchParams}:{searchParams:Promise<{businessLine?:string;owner?:string;cutoff?:string;view?:string;group?:string}>}){
 const[d,f,rel]=await Promise.all([readDelivery(),searchParams,readRelationships()]);
 const scenario=d.presentation.scenarioAt??new Date().toISOString();
 const explicitCutoff=f.cutoff&&dateValid(f.cutoff)?f.cutoff:null;
 const cutoff=explicitCutoff??scenario.slice(0,10);
 const p=buildPortfolioProjection({source:d.source,state:d.state,workspaceId:d.ctx.workspaceId,management:await readManagement(),relationships:rel.relationships,asOf:`${cutoff}T12:00:00Z`});
 const ends=d.source.snapshots.map(x=>({id:x.initiative.id,name:x.initiative.name,slug:x.initiative.slug,archived:Boolean(x.initiative.archivedAt)}));
 const facts=d.state.facts.filter(x=>x.workspaceId===d.ctx.workspaceId);
 // Every value below is a recorded fact or a projection the rest of Prodwise already shows; nothing is estimated here.
 const items:RoadmapItem[]=p.rows.filter(r=>!r.initiative.archivedAt).map(r=>{
  const i=r.initiative;const dev=factFor(facts,i.id,'DEV_STARTED');
  const deps=relationshipsFor(i.id,rel.relationships,ends,facts,'ACTIVE',p.today).filter(x=>x.group==='DEPENDS_ON');
  return {
   id:i.id,slug:i.slug,name:i.name,stage:STAGE_LABEL[i.stage],businessLine:i.businessLine,businessLineLabel:businessLineText(i.businessLine),
   ownerId:r.ownerId,ownerLabel:r.ownerLabel,scope:factFor(facts,i.id,'SCOPE')?.value.text??null,
   devStart:dev?.state==='SET'?dev.value.date:null,
   target:r.target?.state==='SET'?r.target.value.date:null,targetText:factDate(r.target),targetContext:r.target?.contextName??null,
   actual:r.actual?.state==='SET'?r.actual.value.date:null,actualExtent:r.actual?.value.extent??null,actualText:factDate(r.actual),
   milestone:r.milestone?{date:r.milestone.state==='SET'?r.milestone.value.date:null,dateText:factDate(r.milestone),text:r.milestone.value.text??'Next milestone'}:null,
   nextStep:r.nextStep?.value.text??null,
   movement:r.targetMovement?{from:r.targetMovement.from,to:r.targetMovement.to,days:r.targetMovement.days}:null,
   attention:r.attention.map(a=>({kind:a.kind,label:a.label,detail:a.detail,href:a.href})),
   dependencies:deps.map(x=>{const late=x.impact&&x.impact.assessed&&x.impact.late?x.impact:null;return {id:x.relationship.id,otherName:x.other?.name??'An initiative you can’t access',otherSlug:x.other?.slug??null,late:x.late,
    text:x.late?x.impactText??'Lands after the date it is needed.':x.impact?.assessed?'No date impact on recorded dates':'Date impact not assessed',
    neededDate:late?.neededDate??null,providerDate:late?.providerDate??null,days:late?.days??null};}),
   pastTarget:r.timing.kind==='NEEDS_UPDATE',
  };
 });
 const lines=[...new Set(p.rows.filter(r=>!r.initiative.archivedAt).map(r=>r.initiative.businessLine))].sort().map(line=>({value:line,label:businessLineText(line),short:BUSINESS_LINE_LABEL[line]}));
 const owners=d.source.members.filter(m=>m.active).map(m=>({value:m.id,label:m.displayName}));
 const cutoffLabel=explicitCutoff?'Cutoff':d.presentation.isDemo?'Scenario date':'Today';
 return <div className={styles.page}>
  <PageHeader title="Roadmap" meta={<>{items.length} active {items.length === 1 ? "initiative" : "initiatives"} · {items.filter(i => i.target).length} with a Target Live · {cutoffLabel.toLowerCase()} {formatDate(cutoff)}{d.presentation.isDemo ? " · synthetic demo records" : ""}</>}
   actions={<ButtonLink href="/weekly-review" prefetch={false} variant="secondary">Weekly Review</ButtonLink>} />
  <WriteNotice ctx={d.ctx}/>
  <RoadmapView items={items} lines={lines} owners={owners} initial={parseFilters(f)} cutoff={cutoff} explicitCutoff={explicitCutoff} cutoffLabel={cutoffLabel} reference={{date:scenario.slice(0,10),label:d.presentation.isDemo?'Scenario date':'Today'}}
   note={`Current facts · ${cutoffLabel.toLowerCase()} ${displayDate(cutoff)}${d.presentation.isDemo&&explicitCutoff?` · scenario date ${displayDate(scenario.slice(0,10))}`:''}. Changing the cutoff does not reconstruct historical records.`}/>
  <p className={styles.note}>Missing Actual Live does not mean a launch failed or has not happened. A past target requests a human update. Bars connect recorded dates; they never represent estimated progress.</p>
 </div>;
}
