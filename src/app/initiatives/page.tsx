import {factDate} from '@/lib/delivery/display';
import {readRelationships} from '@/lib/data/relationships';
import {getRepository} from '@/lib/data';
import {readManagement} from '@/lib/data/management-read';
import {readDelivery} from '@/lib/delivery/repository';
import {buildPortfolioProjection,type PortfolioRow} from '@/lib/workspace/portfolio';
import {REGISTER_FACETS} from '@/lib/workspace/register-view';
import {toRegisterRow} from '@/lib/workspace/register-rows';
import {parseListState} from '@/lib/workspace/list-filter';
import {businessLineText,STAGE_LABEL} from '@/lib/domain/labels';
import {STAGES} from '@/lib/domain/types';
import {canBusinessWrite} from '@/lib/auth/roles';
import {isDemoWriteEnabled} from '@/lib/env';
import {ButtonLink} from '@/components/primitives/Button';
import {PageHeader} from '@/components/workspace/PageHeader';
import {RegisterView} from '@/components/initiative/RegisterView';
import styles from './initiatives.module.css';
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Initiatives" };
export const dynamic='force-dynamic';
function targetText(r:PortfolioRow){return r.actual?.value.extent==='FULL'?`Live ${factDate(r.actual)}`:r.target?.value.date?factDate(r.target):r.target?.value.unknown?'Explicitly unknown':'Not recorded';}
export default async function Initiatives({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const[d,activity,f,management,rel]=await Promise.all([readDelivery(),getRepository().listRecentActivity(150),searchParams,readManagement(),readRelationships()]);
 const p=buildPortfolioProjection({source:d.source,state:d.state,workspaceId:d.ctx.workspaceId,activity,management,relationships:rel.relationships,asOf:d.presentation.scenarioAt??new Date().toISOString()});
 // Rows are prepared once on the server; filtering, search and sort then run in the browser with the state mirrored to the URL.
 const rows=p.rows.map(r=>toRegisterRow(r,p.today,targetText(r),r.targetMovement?`${r.targetMovement.days>0?'+':''}${r.targetMovement.days} d`:null));
 const initial=parseListState(f,REGISTER_FACETS);
 // `line` and `businessLine` were both accepted before; keep old links working.
 if(!initial.filters.line&&f.businessLine)initial.filters.line=[f.businessLine];
 const owners=[{value:'unassigned',label:'Unassigned'},...d.source.members.filter(m=>m.active&&p.rows.some(r=>r.ownerId===m.id)).map(m=>({value:m.id,label:m.displayName}))];
 const lines=[...new Set(p.rows.map(r=>r.initiative.businessLine))].map(value=>({value,label:businessLineText(value)}));
 const canCreate=canBusinessWrite(d.ctx)&&isDemoWriteEnabled;
 return <div className={styles.page}>
  <PageHeader title="Initiatives" meta={<>{p.summary.total} active in {d.presentation.organizationName}{p.summary.attentionInitiatives?` · ${p.summary.attentionInitiatives} need attention`:''}</>} actions={canCreate?<ButtonLink variant="primary" href="/initiatives/new">Create initiative</ButtonLink>:null}/>
  <RegisterView rows={rows} initial={initial} stageLabel={STAGE_LABEL} options={{stage:STAGES.map(value=>({value,label:STAGE_LABEL[value]})),owner:owners,line:lines}}/>
  <p className={styles.note}>Setup counts recorded coverage; it is not a readiness assessment. Unknown dates stay unknown.</p>
 </div>;
}
