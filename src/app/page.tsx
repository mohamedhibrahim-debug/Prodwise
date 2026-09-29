import Link from 'next/link';
import type {Metadata} from 'next';
import {getRepository} from '@/lib/data';
import {readManagement} from '@/lib/data/management-read';
import {readDelivery} from '@/lib/delivery/repository';
import {isoWeek,nextReviewWeek,ownerFor,dayDifference} from '@/lib/delivery/model';
import {displayDate} from '@/lib/delivery/roadmap';
import {buildPortfolioProjection} from '@/lib/workspace/portfolio';
import {portfolioPulse,homeChanges} from '@/lib/workspace/home-view';
import {isDemoWriteEnabled} from '@/lib/env';
import {canBusinessWrite} from '@/lib/auth/roles';
import {isDemoGuestSession} from '@/lib/auth/service';
import {STAGE_LABEL,formatDate} from '@/lib/domain/labels';
import {FirstRunOrientation} from '@/components/shell/FirstRunOrientation';
import {readRelationships} from '@/lib/data/relationships';
import {readQuestions} from '@/lib/data/questions';
import {ownerAttention} from '@/lib/workspace/owner-attention';
import {Button,ButtonLink} from '@/components/primitives/Button';
import {StatStrip,type StatTone} from '@/components/workspace/StatStrip';
import styles from './home.module.css';
export const metadata:Metadata={title:'Home'};
export const dynamic='force-dynamic';
const shortWeek=(week:string)=>week.replace(/^\d{4}-/,'');
const PULSE_TONE:Record<string,StatTone>={attention:'attention',decision:'decision',blocker:'attention',past:'attention',upcoming:'schedule',unknown:'unknown',setup:'neutral'};
const VERB:Record<string,string>={DECISION:'Review decision',DEPENDENCY:'Review dependency',BLOCKER:'Open delivery facts',PAST_TARGET:'Update delivery facts',PAST_MILESTONE:'Update delivery facts',SUPPORT_CHANGED:'Inspect support'};
export default async function Home({searchParams}:{searchParams:Promise<{organizationChanged?:string}>}){
 const [d,activity,query,guest,management,rel,qs]=await Promise.all([readDelivery(),getRepository().listRecentActivity(100),searchParams,isDemoGuestSession(),readManagement(),readRelationships(),readQuestions()]);
 const asOf=d.presentation.scenarioAt??new Date().toISOString();
 const p=buildPortfolioProjection({source:d.source,state:d.state,workspaceId:d.ctx.workspaceId,activity,management,relationships:rel.relationships,asOf});
 const facts=d.state.facts.filter(f=>f.workspaceId===d.ctx.workspaceId);
 const waiting=ownerAttention({memberId:d.ctx.memberId??null,facts,relationships:rel.relationships,questions:qs.questions,ends:d.source.snapshots.map(x=>({id:x.initiative.id,name:x.initiative.name,slug:x.initiative.slug,archived:Boolean(x.initiative.archivedAt)})),today:p.today});
 const week=isoWeek(asOf);const review=d.state.reviews.find(r=>r.workspaceId===d.ctx.workspaceId&&r.week===week);const writer=canBusinessWrite(d.ctx)&&isDemoWriteEnabled;
 const reviewed=review?.sections.filter(s=>!s.needsRecheck&&(s.editedByMemberId||s.editedByUserId)).length??0;
 const baseline=review?d.state.reviews.find(r=>r.id===review.baselineReviewId):p.baseline;
 const next=review?.status==='FINAL'?nextReviewWeek(review.week):null;
 const nextExists=next?d.state.reviews.some(r=>r.workspaceId===d.ctx.workspaceId&&r.week===next.week):false;
 const nextAvailable=next&&next.week<=isoWeek(new Date().toISOString());
 const pulse=portfolioPulse(p);const {added,lines}=homeChanges(p.changes,p.rows);
 // Commitments routed to me: assigned to me, or unassigned on an initiative I own. Same rule as before; dated on this page's single frame (the scenario day in the Demo).
 const live=new Map(d.source.snapshots.filter(s=>!s.initiative.archivedAt).map(s=>[s.initiative.id,s.initiative]));
 const mine=(d.source.commitments??[]).filter(a=>!['DONE','CANCELLED'].includes(a.status)&&live.has(a.initiativeId)&&(a.assigneeMemberId===d.ctx.memberId||!a.assigneeMemberId&&ownerFor(facts,a.initiativeId)===d.ctx.memberId));
 const urgent=mine.filter(a=>a.blockedNote||a.dueDate&&dayDifference(p.today,a.dueDate)<=3).sort((a,b)=>(a.dueDate??'9999').localeCompare(b.dueDate??'9999'));
 const dueSoon=mine.filter(a=>a.dueDate&&dayDifference(p.today,a.dueDate)>3&&dayDifference(p.today,a.dueDate)<=28);
 const coming=[...p.upcoming.map(u=>({key:`${u.initiativeId}:${u.kind}`,date:u.date,title:u.label,name:u.name,href:`/initiatives/${u.slug}/delivery`,kind:u.kind==='TARGET_LIVE'?'Target Live':'Milestone'})),
  ...dueSoon.map(a=>({key:a.id,date:a.dueDate!,title:a.title.charAt(0).toUpperCase()+a.title.slice(1),name:live.get(a.initiativeId)!.name,href:`/initiatives/${live.get(a.initiativeId)!.slug}/actions?action=${a.id}`,kind:'Commitment'}))].sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
 // The Demo's opening line states what is open now, never a canned story: once the difference is decided it says so.
 const mffRow=p.rows.find(r=>r.initiative.slug==='merchant-flex-finance'&&!r.initiative.archivedAt);const mffDecision=mffRow?.attention.find(a=>a.kind==='DECISION');
 const demoLead=mffDecision?`Merchant Flex Finance has a difference waiting for a decision: ${mffDecision.detail}.`:mffRow?'Merchant Flex Finance shows how a difference between sources is recorded, decided and traced.':null;
 const yourWork=waiting.length+urgent.length;
 const reviewLabel=review?.status==='FINAL'?'Final':review?'Draft':'Not prepared';
 const reviewCta=review?.status==='FINAL'&&writer&&next&&!nextAvailable&&!nextExists
  ?{disabled:`Prepare ${shortWeek(next.week)} review`,note:<>{shortWeek(next.week)} starts {displayDate(next.startsOn)}. <Link prefetch={false} href={`/weekly-review?week=${week}`}>Read Final</Link></>}
  :{href:`/weekly-review?week=${review?.status==='FINAL'&&writer&&next?next.week:week}`,label:review?.status==='DRAFT'?(writer?'Continue review':'Read review'):review?.status==='FINAL'?writer&&next?`${nextExists?'Open':'Prepare'} ${shortWeek(next.week)} review`:'Read Final review':writer?`Prepare ${shortWeek(week)} review`:'Read weekly review'};
 return <div className={styles.page}>
 {query.organizationChanged&&<p role="status" className={styles.notice}>You are now working in {d.presentation.organizationName}.</p>}
 <FirstRunOrientation identity={{access:d.ctx,presentation:d.presentation,guest}} demoLead={demoLead}/>
 <header className={styles.header}>
  <div><h1 tabIndex={query.organizationChanged?-1:undefined}>{d.presentation.organizationName}</h1>
   <p className={styles.meta}>{p.summary.total} active {p.summary.total===1?'initiative':'initiatives'} · {d.presentation.isDemo?'dated to the Demo scenario day shown above':<>As of <time dateTime={p.today}>{displayDate(p.today)}</time></>}</p></div>
  {writer&&<ButtonLink href="/initiatives/new">Create initiative</ButtonLink>}
 </header>
 {p.summary.total>0&&<nav className={styles.pulse} aria-label="Portfolio pulse">{pulse.length?<StatStrip label="Portfolio pulse" dense items={pulse.map(item=>({key:item.key,value:item.count,label:item.label,href:item.href,tone:PULSE_TONE[item.key]??'neutral'}))}/>:<p>Nothing is flagged under the current checks. This is not a readiness assessment.</p>}</nav>}
 {!p.summary.total?<section className={styles.firstRun}><h2>No initiatives recorded in {d.presentation.organizationName} yet.</h2><p>Record an initiative to build its scope, sources and delivery facts.</p>{writer&&<ButtonLink variant="primary" href="/initiatives/new">Create initiative</ButtonLink>}</section>:
 <div className={styles.grid}>
  <div className={styles.main}>
   <section className={styles.section} aria-labelledby="attention-heading">
    <div className={styles.sectionHead}><h2 id="attention-heading">Needs attention</h2><span className={styles.count}>{p.summary.attentionInitiatives} {p.summary.attentionInitiatives===1?'initiative':'initiatives'} · {p.summary.attentionReasons} {p.summary.attentionReasons===1?'reason':'reasons'}</span>{p.attentionRows.length>5&&<Link prefetch={false} className={styles.headLink} href="/initiatives?attention=any">Showing 5 of {p.attentionRows.length} · View all</Link>}</div>
    {p.attentionRows.length?<ol className={styles.attention} aria-label="Initiatives ordered by reason type, then date">{p.attentionRows.slice(0,5).map(r=><li key={r.initiative.id} className={styles.group}>
     <div className={styles.groupHead}><Link prefetch={false} className={styles.groupName} href={`/initiatives/${r.initiative.slug}`}>{r.initiative.name}</Link><span className={styles.chip}>{STAGE_LABEL[r.initiative.stage]}</span><span className={styles.owner}>{r.ownerLabel}</span></div>
     <ul className={styles.reasons}>{r.attention.map((a,index)=><li key={index}><Link prefetch={false} href={a.href} className={styles.reason}><span className={styles.reasonLabel}><span aria-hidden="true" className={styles.glyph}>▲</span>{a.label}</span><span className={styles.reasonDetail} title={a.detail}>{a.detail}</span><span className={styles.reasonGo}>{VERB[a.kind]??'Inspect record'} <span aria-hidden="true">→</span></span></Link></li>)}</ul>
     <p className={styles.nextStep}>{r.nextStep?.value.text?<><span className={styles.nextLabel}>Next step</span>{r.nextStep.value.text}</>:<span className={styles.quiet}>No next step recorded.</span>}</p>
    </li>)}</ol>:<p className={styles.empty}>{p.summary.setupIncomplete?`No recorded decisions, blockers or past dates. ${p.summary.setupIncomplete} ${p.summary.setupIncomplete===1?'initiative has':'initiatives have'} setup incomplete, so record coverage is not complete.`:'Nothing flagged under the current checks. This is not a readiness assessment.'}</p>}
    <p className={styles.footnote}>Ordered by reason type, then date — not a priority score.</p>
   </section>
   <section className={styles.section} aria-labelledby="yours-heading">
    <div className={styles.sectionHead}><h2 id="yours-heading">Your work</h2><span className={styles.count}>{yourWork?`${yourWork} ${yourWork===1?'item':'items'}`:'Nothing routed to you'}</span></div>
    {yourWork?<ul className={styles.rows}>
     {waiting.slice(0,5).map(w=><li key={w.key}><Link prefetch={false} href={w.href} className={styles.row}><span className={styles.rowGlyph} data-kind={w.kind.toLowerCase()} aria-hidden="true">{w.kind==='DEPENDENCY'?'▲':'?'}</span><span className={styles.rowMain}><strong>{w.label}</strong><span>{w.initiative.name} · {w.detail}</span></span><span className={styles.rowAside}>{w.kind==='DEPENDENCY'?'Review':'Answer'} <span aria-hidden="true">→</span></span></Link></li>)}
     {urgent.slice(0,5).map(a=>{const i=live.get(a.initiativeId)!;const late=a.dueDate&&a.dueDate<p.today;return <li key={a.id}><Link prefetch={false} href={`/initiatives/${i.slug}/actions?action=${a.id}`} className={styles.row}><span className={styles.rowGlyph} data-kind={late||a.blockedNote?'late':'commitment'} aria-hidden="true">{late||a.blockedNote?'▲':'✓'}</span><span className={styles.rowMain}><strong>{a.title.charAt(0).toUpperCase()+a.title.slice(1)}</strong><span>{i.name}{a.blockedNote?` · Blocked: ${a.blockedNote}`:''}</span></span><span className={styles.rowAside} data-late={late||undefined}>{a.dueDate?late?`Overdue · ${displayDate(a.dueDate)}`:`Due ${displayDate(a.dueDate)}`:'No due date'}</span></Link></li>;})}
    </ul>:<p className={styles.empty}>No overdue, due-soon or blocked commitments assigned to you, and no questions or dependencies routed to you.</p>}
   </section>
  </div>
  <aside className={styles.side} aria-label="Weekly review, dates and changes">
   <section className={styles.review} aria-labelledby="review-heading">
    <div className={styles.sectionHead}><h2 id="review-heading">Weekly Review</h2><span className={styles.status} data-status={review?.status??'NONE'}>{shortWeek(week)} · {reviewLabel}</span></div>
    {review?.status==='DRAFT'?<div className={styles.progress}><p>Reviewed <strong>{reviewed}</strong> of <strong>{review.sections.length}</strong> sections</p><span className={styles.meter} aria-hidden="true"><span style={{inlineSize:`${(reviewed/Math.max(1,review.sections.length))*100}%`}}/></span></div>
     :review?.status==='FINAL'?<p className={styles.reviewLine}>Finalized by {review.finalizedByLabel??'Recorded actor'} · {formatDate(review.finalizedAt??'')}</p>
     :<p className={styles.reviewLine}>No review prepared for {shortWeek(week)}.</p>}
    <p className={styles.reviewMeta}>{baseline?`Compared with ${shortWeek(baseline.week)} Final (${formatDate(baseline.input.asOf)})`:'First review · no previous Final'}</p>
    {reviewCta.href?<ButtonLink variant="primary" className={styles.reviewCta} href={reviewCta.href}>{reviewCta.label}</ButtonLink>:<><Button variant="primary" className={styles.reviewCta} disabled>{reviewCta.disabled}</Button><p className={styles.reviewMeta}>{reviewCta.note}</p></>}
    {!writer&&<p className={styles.reviewMeta}>Read-only · changes need write access.</p>}
   </section>
   <section className={styles.section} aria-labelledby="coming-heading">
    <div className={styles.sectionHead}><h2 id="coming-heading">Coming up</h2><span className={styles.count}>Next 28 days</span><Link prefetch={false} className={styles.headLink} href="/roadmap">Roadmap</Link></div>
    {coming.length?<ul className={styles.dated}>{coming.slice(0,7).map(c=><li key={c.key}><Link prefetch={false} href={c.href}><time dateTime={c.date}>{displayDate(c.date)}</time><span className={styles.datedMain}><strong>{c.name}</strong><span>{c.kind} · {c.title}</span></span></Link></li>)}</ul>:<p className={styles.empty}>No confirmed dates in the next 28 days.</p>}
    {coming.length>7&&<p className={styles.footnote}>{coming.length-7} more on the <Link prefetch={false} href="/roadmap">Roadmap</Link>.</p>}
   </section>
   <section className={styles.section} aria-labelledby="changes-heading">
    <div className={styles.sectionHead}><h2 id="changes-heading">What changed</h2><span className={styles.count}>{p.baseline?`Since ${shortWeek(p.baseline.week)} Final`:'Last 28 days'}</span><Link prefetch={false} className={styles.headLink} href={p.baseline?`/weekly-review?week=${p.baseline.week}&view=since`:'/weekly-review'}>All</Link></div>
    {added.length||lines.length?<ul className={styles.changes}>
     {added.length>0&&<li><p><strong>{added.length} {added.length===1?'initiative':'initiatives'} added:</strong> {added.map((c,index)=><span key={c.id}>{index?', ':''}<Link prefetch={false} href={c.href}>{c.name}</Link></span>)}</p></li>}
     {lines.map(({change:c,more})=><li key={c.id}><p>{c.sentence}{more.length>0&&<span className={styles.quiet}> · +{more.length} related</span>}</p><small><Link prefetch={false} href={c.href}>{c.name}</Link> · {c.actorLabel} · {formatDate(c.occurredAt)}</small></li>)}
    </ul>:<p className={styles.empty}>No recorded changes in this comparison.</p>}
   </section>
  </aside>
 </div>}
 </div>;
}
