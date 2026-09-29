import {factDate} from '@/lib/delivery/display';
import {notCompared} from '@/lib/review/applicability';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readManagement} from '@/lib/data/management-read';
import {readDelivery} from '@/lib/delivery/repository';
import {getRepository} from '@/lib/data';
import {buildPortfolioProjection} from '@/lib/workspace/portfolio';
import {displayDate} from '@/lib/delivery/roadmap';
import {factFor,ownerFor,dayDifference} from '@/lib/delivery/model';
import {hasOrganizationAdminAuthority,canBusinessWrite} from '@/lib/auth/roles';
import {isDemoWriteEnabled} from '@/lib/env';
import {STAGE_LABEL,formatDate} from '@/lib/domain/labels';
import {safeUserLabel} from '@/lib/demo/presentation';
import {readRelationships} from '@/lib/data/relationships';
import {readQuestions} from '@/lib/data/questions';
import {readRisks} from '@/lib/data/risks';
import {riskViews,RISK_STATUS_LABEL} from '@/lib/workspace/risks';
import {questionOverdueDays} from '@/lib/workspace/questions';
import {canChangeCommitment} from '@/lib/workspace/commitment-policy';
import {relationshipsFor,GROUP_LABEL} from '@/lib/workspace/relationship-view';
import {latestDecisionAt,recordedBeforeDecision} from '@/lib/workspace/decision-followup';
import {toRoadmapItem} from '@/lib/workspace/delivery-row';
import {ButtonLink} from '@/components/primitives/Button';
import {CompleteCommitment} from '@/components/initiative/CompleteCommitment';
import {DeliveryRow} from '@/components/initiative/DeliveryRow';
import {LifecycleStepper} from '@/components/workspace/LifecycleStrip';
import {AttentionBand} from '@/components/workspace/AttentionBand';
import {ATTENTION_KIND} from '@/components/workspace/attention-kind';
import styles from './brief.module.css';
export const metadata={title:'Brief'};export const dynamic='force-dynamic';
export default async function Brief({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{created?:string}>}){
 const [{slug},q,d,management,rel,qs,rs]=await Promise.all([params,searchParams,readDelivery(),readManagement(),readRelationships(),readQuestions(),readRisks()]);
 const snapshot=d.source.snapshots.find(s=>s.initiative.slug===slug);if(!snapshot)notFound();
 const activity=await getRepository().listActivity(snapshot.initiative.id,50);
 const asOf=d.presentation.scenarioAt??new Date().toISOString();
 const p=buildPortfolioProjection({source:d.source,state:d.state,workspaceId:d.ctx.workspaceId,activity,management,relationships:rel.relationships,asOf});
 const r=p.rows.find(r=>r.initiative.slug===slug)!;const i=r.initiative;const base=`/initiatives/${slug}`;
 const facts=d.state.facts.filter(f=>f.workspaceId===d.ctx.workspaceId);const get=(kind:Parameters<typeof factFor>[2])=>factFor(facts,i.id,kind);
 const scope=get('SCOPE');const today=p.today;
 const riskRows=riskViews(snapshot.claims.map(c=>({id:c.id,initiativeId:i.id,type:c.type,status:c.status,subject:c.subject,value:c.value,supersededByClaimId:c.supersededByClaimId??null})),rs.tracking.filter(t=>t.initiativeId===i.id),i.id).filter(v=>v.state!=='SUPERSEDED'&&(!v.tracking||['OPEN','MITIGATING'].includes(v.tracking.status)));
 const openQs=qs.questions.filter(x=>x.initiativeId===i.id&&x.status==='OPEN').map(x=>({q:x,overdue:questionOverdueDays(x,today)})).sort((a,b)=>(b.overdue??-1)-(a.overdue??-1));
 const relRows=relationshipsFor(i.id,rel.relationships,d.source.snapshots.map(x=>({id:x.initiative.id,name:x.initiative.name,slug:x.initiative.slug,archived:Boolean(x.initiative.archivedAt)})),facts,'ACTIVE',today);
 const writer=!i.archivedAt&&canBusinessWrite(d.ctx)&&isDemoWriteEnabled;const factWriter=writer&&(hasOrganizationAdminAuthority(d.ctx)||r.ownerId===d.ctx.memberId);
 const owner=ownerFor(facts,i.id);
 const commitments=(d.source.commitments??[]).filter(a=>a.initiativeId===i.id&&!['DONE','CANCELLED'].includes(a.status)).sort((a,b)=>(a.dueDate??'9999').localeCompare(b.dueDate??'9999'));
 const member=(id:string|null)=>d.source.members.find(m=>m.id===id)?.displayName??null;
 const changes=p.changes.filter(c=>c.initiativeId===i.id);
 const context=management.contexts.find(c=>c.id===i.currentContextId&&!c.retiredAt)?.label??(scope?.value.text?`${scope.value.text} (earlier scope text)`:null);
 const skipped=notCompared(snapshot.claims).length;
 const setupNext=r.setup.next;
 // Recorded delivery facts are never changed by a decision; a fact written before the latest decision only gets asked about.
 const decisionAt=latestDecisionAt(snapshot.findingStates);
 const nextStepCheck=recordedBeforeDecision(r.nextStep?.value.text?r.nextStep:null,decisionAt),blockerCheck=recordedBeforeDecision(get('BLOCKER'),decisionAt);
 const factsHref=`${base}/delivery?returnTo=${encodeURIComponent(base)}`;
 const checkNote=(at:string)=><p className={styles.decisionCheck}><span aria-hidden="true" className={styles.glyph}>◆</span>Recorded before the decision on {formatDate(at)} — still accurate?{factWriter&&!i.archivedAt?<> <Link prefetch={false} href={factsHref}>Update delivery facts</Link></>:null}</p>;
 const openDecisions=r.attention.filter(a=>a.kind==='DECISION').length;
 const decidedCount=snapshot.findingStates.filter(s=>s.status==='RESOLVED').length;
 const overdueQs=openQs.filter(x=>x.overdue).length;const lateCommitments=commitments.filter(a=>a.dueDate&&a.dueDate<today).length;
 const targetDays=r.target?.value.date?dayDifference(today,r.target.value.date):null;
 const item=toRoadmapItem(r,facts,relRows);
 const cutoffLabel=d.presentation.isDemo?'Scenario date':'Today';
 return <div className={styles.page}>
 {q.created==='1'&&<p role="status" className={styles.created}><strong>{i.name} was created.</strong> {setupNext?<>Next: {setupNext.label.toLowerCase()} — <Link prefetch={false} href={setupNext.href}>continue setup</Link>. Each step can wait; setup resumes where you left off.</>:'Setup is complete.'}</p>}
 <div className={styles.cockpit}>
 <div className={styles.main}>
  <section className={styles.state} aria-labelledby="current-state">
   <h2 id="current-state" className="visually-hidden">Current state</h2>
   <div className={styles.stepper}><LifecycleStepper stage={i.stage}/></div>
   <p className={styles.statement}>{/* Composed only from recorded facts; it is not a readiness judgement. */}In <strong>{STAGE_LABEL[i.stage]}</strong>. {r.attention.length?<><strong>{r.attention.length} recorded {r.attention.length===1?'reason needs':'reasons need'} attention</strong>.</>:'No recorded attention reasons under the current checks.'}</p>
   {i.description&&<p className={styles.objective}><span>Objective</span> {i.description}</p>}
   {context&&<p className={styles.objective}><span>Scope / phase</span> {context}</p>}
   <dl className={styles.stateFacts}>
    <div><dt>Current stage</dt><dd>{STAGE_LABEL[i.stage]}</dd><dd className={styles.stateSub}>Recorded stage, not readiness</dd></div>
    <div><dt>Target vs actual</dt><dd>{r.target?.value.date?<><span className={styles.mark} data-kind="target" aria-hidden="true"/>{factDate(r.target)}</>:factDate(r.target)}{r.actual?.value.date?<> → <span className={styles.mark} data-kind="live" aria-hidden="true"/>{factDate(r.actual)}{r.actual.value.extent==='PARTIAL'?' (partial)':''}</>:''}</dd><dd className={styles.stateSub}>{r.actual?.value.date?r.actual.value.extent==='PARTIAL'?`Partial · ${r.actual.value.text??'scope not described'}`:'Actual Live recorded · full named scope':r.timing.kind==='NEEDS_UPDATE'?<span className={styles.late}>▲ Target passed · no Actual Live recorded</span>:targetDays!==null?targetDays===0?'Target Live is today':targetDays>0?`Target Live in ${targetDays} ${targetDays===1?'day':'days'}`:'Actual Live not recorded':r.target?.value.unknown?'Target explicitly unknown':'No Actual Live recorded'}</dd></div>
    <div><dt>Next milestone</dt><dd>{r.milestone?.value.text??'Not recorded'}</dd><dd className={styles.stateSub}>{r.milestone?r.milestone.value.date&&r.milestone.value.date<today?<span className={styles.late}>▲ {factDate(r.milestone)} · passed</span>:factDate(r.milestone):'No milestone recorded'}</dd></div>
   </dl>
   <div className={styles.next} aria-label="Next step">
    <span className={styles.nextLabel}>Next step</span>
    {r.nextStep?.value.text?<><p className={styles.nextText}>{r.nextStep.value.text}</p><p className={styles.nextMeta}>{r.nextStep.preparedAsFixture?'Prepared by':'Confirmed by'} {safeUserLabel(r.nextStep)} · {formatDate(r.nextStep.updatedAt)}</p>{nextStepCheck&&checkNote(nextStepCheck)}</>:<p className={styles.nextEmpty}>No next step recorded.</p>}
    {!i.archivedAt&&<div className={styles.nextActions}>{r.attention[0]?<ButtonLink variant="primary" href={r.attention[0].href}>{ATTENTION_KIND[r.attention[0].kind].go}</ButtonLink>:null}{factWriter&&<ButtonLink variant={r.attention[0]?'ghost':'secondary'} href={factsHref}>{r.nextStep?.value.text?'Update next step':'Record next step'}</ButtonLink>}</div>}
   </div>
  </section>

  <section className={styles.section} aria-labelledby="delivery">
   <div className={styles.head}><h2 id="delivery">Delivery</h2><span>{item.target?`Recorded dates · ${cutoffLabel.toLowerCase()} ${displayDate(today)}`:'No timeline yet'}</span>{factWriter?<Link prefetch={false} className={styles.headLink} href={factsHref}>Update facts</Link>:<Link prefetch={false} className={styles.headLink} href={`${base}/delivery`}>Delivery facts</Link>}</div>
   <div className={styles.deliveryBody}><DeliveryRow item={item} cutoff={today} cutoffLabel={cutoffLabel} setupHref={`${base}/setup?step=delivery`} roadmapHref="/roadmap" canRecord={Boolean(factWriter)}/></div>
   <p className={styles.note}>Bars connect recorded dates; they never represent estimated progress. Missing Actual Live does not establish whether the initiative launched.</p>
  </section>

  <section className={styles.section} aria-labelledby="attention" id="attention">
   <div className={styles.head}><h2 id="attention">Needs attention</h2><span>{r.attention.length} recorded {r.attention.length===1?'reason':'reasons'}</span></div>
   <div className={styles.band}><AttentionBand rows={r.attention.map((a,n)=>({id:String(n),attention:[a]}))} total={r.attention.length} noun="reasons" compact/></div>
   {r.attention.length?<ul className={styles.list}>{r.attention.map((a,n)=>{const k=ATTENTION_KIND[a.kind];return <li key={n}><Link prefetch={false} href={a.href} className={styles.item} data-tone={k.tone}><span className={styles.itemLabel} data-tone={k.tone}><span aria-hidden="true" className={styles.kindGlyph} data-tone={k.tone}>{k.glyph}</span>{a.label}</span><span className={styles.itemText}>{a.detail}</span><span className={styles.itemGo}>{k.go} <span aria-hidden="true">→</span></span></Link>{a.kind==='BLOCKER'&&blockerCheck&&checkNote(blockerCheck)}</li>;})}</ul>
    :<p className={styles.empty}>No open differences or delivery attention under the current checks. This is not a readiness assessment.</p>}
   {skipped>0&&<p className={styles.note}>Some Knowledge entries were not compared because applicability differs or is not recorded. <Link prefetch={false} href={`${base}/knowledge?view=all`}>Review applicability</Link></p>}
  </section>

  <section className={styles.section} aria-labelledby="open-items">
   <div className={styles.head}><h2 id="open-items">Risks, decisions and open work</h2><Link prefetch={false} className={styles.headLink} href={`${base}/actions`}>Commitments</Link><Link prefetch={false} className={styles.headLink} href={`${base}/context`}>Risks & questions</Link></div>
   <ul className={styles.summary} aria-label="Risk and decision summary">
    <li data-tone="decision"><Link prefetch={false} href={`${base}/decisions`}><i aria-hidden="true">?</i><strong>{openDecisions}</strong><span>{openDecisions===1?'decision open':'decisions open'}</span><small>{decidedCount?`${decidedCount} decided on record`:'None decided yet'}</small></Link></li>
    <li data-tone="risk"><Link prefetch={false} href={`${base}/context`}><i aria-hidden="true">▲</i><strong>{riskRows.length}</strong><span>{riskRows.length===1?'risk open':'risks open'}</span><small>{riskRows.filter(v=>v.state==='AWAITING_VERIFICATION').length?`${riskRows.filter(v=>v.state==='AWAITING_VERIFICATION').length} awaiting confirmation`:riskRows.filter(v=>v.tracking?.status==='MITIGATING').length?`${riskRows.filter(v=>v.tracking?.status==='MITIGATING').length} mitigating`:'Recorded risks only'}</small></Link></li>
    <li data-tone={overdueQs?'past':'neutral'}><Link prefetch={false} href={`${base}/context`}><i aria-hidden="true">?</i><strong>{openQs.length}</strong><span>{openQs.length===1?'question open':'questions open'}</span><small>{overdueQs?`${overdueQs} overdue`:'None overdue'}</small></Link></li>
    <li data-tone={lateCommitments?'past':'work'}><Link prefetch={false} href={`${base}/actions`}><i aria-hidden="true">✓</i><strong>{commitments.length}</strong><span>{commitments.length===1?'commitment open':'commitments open'}</span><small>{lateCommitments?`${lateCommitments} overdue`:commitments.some(a=>a.blockedNote)?`${commitments.filter(a=>a.blockedNote).length} blocked`:'None overdue'}</small></Link></li>
   </ul>
   {commitments.length+openQs.length+riskRows.length?<ul className={styles.list}>
    {commitments.slice(0,4).map(a=>{const late=a.dueDate&&a.dueDate<today;const canComplete=writer&&!a.blockedNote&&canChangeCommitment(d.ctx,a,owner,'STATUS');return <li key={a.id} className={styles.itemRow}>
     <Link prefetch={false} href={`${base}/actions?action=${a.id}`} className={styles.item} data-tone={late||a.blockedNote?'past':'work'}><span className={styles.itemLabel}><span aria-hidden="true" className={styles.kindGlyph} data-tone={late||a.blockedNote?'past':'work'}>{late||a.blockedNote?'▲':'✓'}</span>Commitment</span><span className={styles.itemText}>{a.title.charAt(0).toUpperCase()+a.title.slice(1)}<span className={styles.itemMeta}> · {member(a.assigneeMemberId)??'No assignee'}{a.blockedNote?` · Blocked: ${a.blockedNote}`:''}</span></span><span className={styles.itemDate} data-late={late||undefined}>{a.dueDate?late?`Overdue · ${displayDate(a.dueDate)}`:`Due ${displayDate(a.dueDate)}`:'No due date'}</span></Link>
     {canComplete&&<CompleteCommitment slug={slug} commitment={a} returnHref={`${base}/actions?action=${a.id}`}/>}</li>;})}
    {openQs.slice(0,3).map(({q:x,overdue})=><li key={x.id}><Link prefetch={false} href={`${base}/context#question-${x.id}`} className={styles.item} data-tone={overdue?'past':'question'}><span className={styles.itemLabel}><span aria-hidden="true" className={styles.kindGlyph} data-tone={overdue?'past':'question'}>?</span>Question</span><span className={styles.itemText}>{x.question}</span><span className={styles.itemDate} data-late={overdue?true:undefined}>{overdue?`Overdue ${overdue} ${overdue===1?'day':'days'}`:x.dueDate?`Needed by ${displayDate(x.dueDate)}`:'Answer →'}</span></Link></li>)}
    {riskRows.slice(0,3).map(v=><li key={v.claim.id}><Link prefetch={false} href={v.state==='AWAITING_VERIFICATION'&&writer?`${base}/knowledge/${v.claim.id}/confirm`:`${base}/context#risk-${v.claim.id}`} className={styles.item} data-tone="risk"><span className={styles.itemLabel}><span aria-hidden="true" className={styles.kindGlyph} data-tone="risk">▲</span>Risk</span><span className={styles.itemText}><strong>{v.claim.subject}</strong> {v.claim.value}</span><span className={styles.itemDate}>{v.state==='AWAITING_VERIFICATION'?writer?'Awaiting confirmation · Confirm →':'Awaiting confirmation':v.tracking?RISK_STATUS_LABEL[v.tracking.status]:'Open · not yet tracked'}</span></Link></li>)}
   </ul>:<p className={styles.empty}>No open commitments, questions or risks recorded.</p>}
  </section>

  <section className={styles.section} aria-labelledby="changed">
   <div className={styles.head}><h2 id="changed">What changed</h2><span>{p.baseline?`Since ${p.baseline.week.replace(/^\d{4}-/,'')} Final`:'Last 28 days'}</span><Link prefetch={false} className={styles.headLink} href={`${base}/history`}>History</Link></div>
   {changes.length?<ul className={styles.changes}>{changes.slice(0,5).map(c=><li key={c.id}><Link prefetch={false} href={c.href}>{c.sentence}</Link><small>{c.actorLabel} · {formatDate(c.occurredAt)}</small></li>)}</ul>:<p className={styles.empty}>No recorded changes in this comparison.</p>}
  </section>
 </div>

 <aside className={styles.side} aria-label="Initiative facts">
  <section className={styles.panel} aria-labelledby="setup-heading">
   <div className={styles.setupHead}><h2 id="setup-heading">Setup</h2><span className={styles.setupCount}>{r.setup.completed} of {r.setup.total}</span></div>
   <span className={styles.meter} aria-hidden="true"><span style={{inlineSize:`${(r.setup.completed/Math.max(1,r.setup.total))*100}%`}} data-ready={r.setup.ready||undefined}/></span>
   {i.archivedAt?<p className={styles.panelNote}>Read-only while archived · restore in Manage initiative.</p>:setupNext?<p className={styles.panelNote}>Next: <Link prefetch={false} href={setupNext.href}>{setupNext.label}</Link></p>:<p className={styles.panelNote}>All setup requirements recorded. Setup coverage is not release approval.</p>}
   {!i.archivedAt&&!r.setup.ready&&writer&&<Link prefetch={false} className={styles.panelLink} href={setupNext?.href??`${base}/setup?step=review`}>Complete setup →</Link>}
  </section>
  <section className={styles.panel} aria-labelledby="facts-heading">
   <div className={styles.setupHead}><h2 id="facts-heading">Delivery facts</h2>{factWriter?<Link prefetch={false} className={styles.panelLink} href={factsHref}>Update</Link>:<Link prefetch={false} className={styles.panelLink} href={`${base}/delivery`}>View</Link>}</div>
   <dl className={styles.facts}>
    <div><dt>Owner</dt><dd>{r.ownerLabel}</dd></div>
    <div><dt>Target Live</dt><dd>{factDate(r.target)}{r.targetMovement&&<small>Moved {r.targetMovement.days>0?'+':''}{r.targetMovement.days} d from {displayDate(r.targetMovement.from)}</small>}</dd></div>
    <div><dt>Actual Live</dt><dd>{r.actual?.value.date?factDate(r.actual):'Not recorded'}{r.actual&&<small>{r.actual.value.extent==='PARTIAL'?`Partial · ${r.actual.value.text}`:'Full named scope'}</small>}</dd></div>
    <div><dt>Development start</dt><dd>{factDate(get('DEV_STARTED'))}</dd></div>
    <div><dt>Blocker</dt><dd>{get('BLOCKER')?.value.text??<span className={styles.factQuiet}>None recorded</span>}</dd></div>
   </dl>
  </section>
  <section className={styles.panel} aria-labelledby="rel-heading">
   <div className={styles.setupHead}><h2 id="rel-heading">Relationships</h2>{!i.archivedAt&&writer?<Link prefetch={false} className={styles.panelLink} href={`${base}/manage?section=relationships#relationships`}>{relRows.length?'Manage':'Record'}</Link>:null}</div>
   {relRows.length?<ul className={styles.relations}>{relRows.map(x=><li key={x.relationship.id}>{x.other?<Link prefetch={false} href={`/initiatives/${x.other.slug}`} className={styles.relChip} data-late={x.late||undefined}><span className={styles.relType}>{x.late?'⇢ ':''}{GROUP_LABEL[x.group]}</span><span className={styles.relName}>{x.other.name}{x.other.archived?' · archived':''}</span></Link>:<span className={styles.relChip}><span className={styles.relType}>{GROUP_LABEL[x.group]}</span><span className={styles.relName}>An initiative you can’t access</span></span>}{x.group==='DEPENDS_ON'&&x.impactText&&<small data-late={x.late||undefined}>{x.impactText}</small>}</li>)}</ul>:<p className={styles.panelNote}>None recorded.</p>}
  </section>
  <nav className={styles.records} aria-label="Records">
   <Link prefetch={false} href={`${base}/knowledge`}><span>Knowledge</span><strong>{snapshot.claims.filter(c=>c.status==='ACTIVE').length}</strong><small>confirmed</small></Link>
   <Link prefetch={false} href={`${base}/sources`}><span>Sources</span><strong>{snapshot.evidence.length}</strong><small>recorded</small></Link>
   <Link prefetch={false} href={`${base}/decisions`}><span>Decisions</span><strong>{openDecisions}</strong><small>open</small></Link>
  </nav>
 </aside>
 </div></div>;
}
