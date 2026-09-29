/**
 * Operator-only hosted Demo generation. No network or DB calls in --dry-run or --self-test.
 * Run with the existing TypeScript loader used by the local operator.
 */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,rmdirSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { canonicalDemoData,DEMO_CANONICAL_VERSION,DEMO_CUTOFF,DEMO_ORGANIZATION_NAME } from '../../src/lib/demo/canonical.ts';
import { freezeInput,sectionDigest,canonical } from '../../src/lib/delivery/model.ts';
import { canonicalDemoDataV4,DEMO_V4_VERSION } from '../../src/lib/demo/scenario-v4.ts';

const EMAIL='reviewer@prodwise.demo';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const literal=value=>value===null||value===undefined?'null':"'"+String(value).replaceAll("'","''")+"'";
const json=value=>literal(JSON.stringify(value))+'::jsonb';
const digest=value=>createHash('sha256').update(value).digest('hex');

export function validateHostedTarget({projectRef,supabaseUrl,databaseUrl},requireDatabase=false){
 if(!/^[a-z0-9]{20}$/.test(projectRef??''))throw new Error('Set the exact expected Supabase project reference.');
 let url;try{url=new URL(supabaseUrl);}catch{throw new Error('The expected Supabase HTTPS origin is required.');}
 if(url.protocol!=='https:'||url.hostname!==projectRef+'.supabase.co'||url.port||url.username||url.password||!['','/'].includes(url.pathname)||url.search||url.hash)throw new Error('Supabase origin does not match the pinned project.');
 if(requireDatabase&&!databaseUrl)throw new Error('A private operator database connection is required.');
 if(databaseUrl){
   let db;try{db=new URL(databaseUrl);}catch{throw new Error('Invalid private operator database connection.');}
   const user=decodeURIComponent(db.username);
   const direct=db.hostname==='db.'+projectRef+'.supabase.co';
   const pooler=db.hostname.endsWith('.pooler.supabase.com')&&user==='postgres.'+projectRef;
   if(!['postgres:','postgresql:'].includes(db.protocol)||(!direct&&!pooler)||!db.password||!db.pathname||db.pathname==='/')throw new Error('Database connection does not match the expected Supabase project.');
 }
 return {projectRef,supabaseUrl:url.origin};
}

export function makeHostedPlan({projectRef,actorId,prior=null,ids={}}){
 if(!/^[a-z0-9]{20}$/.test(projectRef)||!uuid(actorId))throw new Error('A pinned project and persisted Platform Owner ID are required.');
 if(prior){
   if(prior.projectRef!==projectRef||prior.email!==EMAIL||prior.role!=='ORG_OWNER'||prior.platformRole!==null||prior.version!==DEMO_CANONICAL_VERSION)throw new Error('Prior private registration is not an isolated Demo generation.');
   for(const key of ['organizationId','workspaceId','reviewerUserId','reviewerMemberId','authUserId'])if(!uuid(prior[key]))throw new Error('Prior Demo registration has an invalid identity.');
 }
 const plan={format:1,mode:prior?'RESET_NEW_GENERATION':'INITIAL',projectRef,actorId,version:DEMO_CANONICAL_VERSION,scenarioAt:DEMO_CUTOFF,email:EMAIL,role:'ORG_OWNER',platformRole:null,
 organizationId:ids.organizationId??randomUUID(),workspaceId:ids.workspaceId??randomUUID(),reviewerMemberId:ids.reviewerMemberId??randomUUID(),
 reviewerUserId:prior?.reviewerUserId??ids.reviewerUserId??randomUUID(),authUserId:prior?.authUserId??ids.authUserId??randomUUID(),
 prior:prior?{organizationId:prior.organizationId,workspaceId:prior.workspaceId,reviewerMemberId:prior.reviewerMemberId}:null};
 for(const key of ['organizationId','workspaceId','reviewerMemberId','reviewerUserId','authUserId'])if(!uuid(plan[key]))throw new Error('Generated Demo identity is invalid.');
 if(new Set([plan.organizationId,plan.workspaceId,plan.reviewerMemberId,plan.reviewerUserId,plan.authUserId]).size!==5)throw new Error('Demo identities must be distinct.');
 if(prior&&(plan.organizationId===prior.organizationId||plan.workspaceId===prior.workspaceId||plan.reviewerMemberId===prior.reviewerMemberId))throw new Error('A reset must create a fresh organization, workspace and membership.');
 return plan;
}

function validatePlan(plan,config){
 const rebuilt=makeHostedPlan({projectRef:plan.projectRef,actorId:plan.actorId,prior:plan.prior?{...plan,...plan.prior}:null,ids:plan});
 if(plan.format!==1||plan.mode!==rebuilt.mode||plan.projectRef!==config.projectRef||plan.actorId!==config.actorId||plan.version!==DEMO_CANONICAL_VERSION||plan.scenarioAt!==DEMO_CUTOFF||plan.email!==EMAIL||plan.role!=='ORG_OWNER'||plan.platformRole!==null)throw new Error('The saved plan does not match the pinned operator configuration.');
}
/** P1 collections: stored as the product's own JSON records plus their indexed columns. */
function renderP1Rows(demo,p,part){
 const s=demo.productStore,ws=p.workspaceId;const ev=e=>e.requestId??e.id;let sql='';
 if(part==='BEFORE_CLAIMS'){
 sql+=insertRows('source_containers',['id','workspace_id','provider','provider_workspace','reference','name','created_by','created_at'],s.sourceContainers.map(snake));
 sql+=insertRows('source_items',['id','workspace_id','container_id','reference','name','kind','url','created_by','created_at'],s.sourceItems.map(snake));
 sql+=insertRows('source_mappings',['id','workspace_id','initiative_id','item_id','role','revision','linked_by','linked_at','unlinked_by','unlinked_at','unlink_reason'],s.sourceMappings.map(snake));
 sql+=insertRows('evidence_submissions',['id','workspace_id','initiative_id','request_id','data'],s.evidenceSubmissions.map(x=>({id:x.id,workspace_id:ws,initiative_id:x.initiativeId,request_id:x.requestId,data:x})));
 sql+=insertRows('meeting_notes',['submission_id','workspace_id','initiative_id','revision','data'],s.meetingNotes.map(m=>({submission_id:m.submissionId,workspace_id:ws,initiative_id:m.initiativeId,revision:m.revision,data:m})));
 sql+=insertRows('evidence_attempts',['id','workspace_id','initiative_id','submission_id','request_id','data'],s.evidenceAttempts.map(a=>({id:a.id,workspace_id:ws,initiative_id:a.initiativeId,submission_id:a.submissionId,request_id:a.requestId,data:a})));
 sql+=insertRows('evidence_anchors',['id','workspace_id','initiative_id','submission_id','data'],s.evidenceAnchors.map(a=>({id:a.id,workspace_id:ws,initiative_id:a.initiativeId,submission_id:a.submissionId,data:a})));
 return sql;}
 sql+=insertRows('finding_states',['workspace_id','initiative_id','fingerprint','rule_id','subject','attribute','phase','values_recorded','status','resolution','resolved_at','created_at','updated_at','content_digest','outcome','chosen_claim_id','decision_claim_id','decided_value','confirmed_with','actor_id','actor_label','confirmer_label','confirmer_set_at','confirmer_set_by_label'],s.findingStates.map(snake));
 sql+=insertRows('finding_dispositions',['id','workspace_id','organization_id','initiative_id','finding_id','kind','underlying_digest','defer_until','defer_until_next_review','reason','actor','at','client_request_id','data','input'],s.findingDispositions.map(d=>({id:d.id,workspace_id:ws,organization_id:p.organizationId,initiative_id:d.initiativeId,finding_id:d.findingId,kind:d.kind,underlying_digest:d.underlyingDigest,defer_until:d.deferUntil,defer_until_next_review:d.deferUntilNextReview,reason:d.reason,actor:d.actor,at:d.at,client_request_id:d.clientRequestId,data:d,input:{kind:d.kind,reason:d.reason}})));
 sql+=insertRows('actions',['id','workspace_id','initiative_id','revision','data'],s.commitments.map(a=>({id:a.id,workspace_id:ws,initiative_id:a.initiativeId,revision:a.revision,data:a})));
 sql+=insertRows('action_events',['id','workspace_id','initiative_id','action_id','seq','data','request_id','input'],s.commitmentEvents.map(e=>({id:e.id,workspace_id:ws,initiative_id:e.initiativeId,action_id:e.actionId,seq:e.seq,data:e,request_id:ev(e),input:{synthetic:true}})));
 sql+=insertRows('open_questions',['id','workspace_id','initiative_id','revision','data'],s.openQuestions.map(q=>({id:q.id,workspace_id:ws,initiative_id:q.initiativeId,revision:q.revision,data:q})));
 sql+=insertRows('question_events',['id','workspace_id','initiative_id','question_id','seq','data','request_id','input'],s.questionEvents.map(e=>({id:e.id,workspace_id:ws,initiative_id:e.initiativeId,question_id:e.questionId,seq:e.seq,data:e,request_id:ev(e),input:{synthetic:true}})));
 sql+=insertRows('initiative_relationships',['id','workspace_id','from_initiative_id','to_initiative_id','type','status','revision','data'],s.relationships.map(r=>({id:r.id,workspace_id:ws,from_initiative_id:r.fromInitiativeId,to_initiative_id:r.toInitiativeId,type:r.type,status:r.status,revision:r.revision,data:r})));
 sql+=insertRows('relationship_events',['id','workspace_id','relationship_id','seq','data','request_id','input'],s.relationshipEvents.map(e=>({id:e.id,workspace_id:ws,relationship_id:e.relationshipId,seq:e.seq,data:e,request_id:ev(e),input:{synthetic:true}})));
 sql+=insertRows('risk_tracking',['id','workspace_id','initiative_id','claim_id','status','revision','data'],s.riskTracking.map(t=>({id:t.id,workspace_id:ws,initiative_id:t.initiativeId,claim_id:t.claimId,status:t.status,revision:t.revision,data:t})));
 sql+=insertRows('risk_tracking_events',['id','workspace_id','initiative_id','tracking_id','seq','data','request_id','input'],s.riskEvents.map(e=>({id:e.id,workspace_id:ws,initiative_id:e.initiativeId,tracking_id:e.trackingId,seq:e.seq,data:e,request_id:ev(e),input:{synthetic:true}})));
 sql+=insertRows('evidence_proposals',['id','workspace_id','initiative_id','submission_id','attempt_id','anchor_id','data'],s.evidenceProposals.map(x=>({id:x.id,workspace_id:ws,initiative_id:x.initiativeId,submission_id:x.submissionId,attempt_id:x.attemptId,anchor_id:x.anchorId,data:x})));
 sql+=insertRows('evidence_confirmations',['proposal_id','workspace_id','initiative_id','data'],s.evidenceConfirmations.map(c=>({proposal_id:c.proposalId,workspace_id:ws,initiative_id:c.initiativeId,data:c})));
 return sql;
}
/** metric_definitions / metric_observations exactly as migration 0017 defines them; created_at keeps its default. */
export const METRIC_DEFINITION_COLUMNS=['id','organization_id','workspace_id','initiative_id','name','definition','unit','formula','source_label','source_evidence_id','period_grain','timezone','target_value','target_comparator','target_owner_label','target_approved_at','target_note','origin','revision','updated_at'];
export const METRIC_OBSERVATION_COLUMNS=['id','metric_id','workspace_id','period_start','period_end','value','captured_at','source_evidence_id','note','origin'];
function renderMetricRows(metrics,p){
 if(metrics.some(m=>m.workspaceId!==p.workspaceId||m.origin!=='SYNTHETIC_DEMO'))throw new Error('Demo metrics must be synthetic and scoped to the new generation.');
 const definitions=metrics.map(({observations:_observations,...rest})=>({...snake(rest),organization_id:p.organizationId}));
 const observations=metrics.flatMap(m=>m.observations.map(o=>({...snake(o),metric_id:m.id,workspace_id:p.workspaceId})));
 return insertRows('metric_definitions',METRIC_DEFINITION_COLUMNS,definitions)+insertRows('metric_observations',METRIC_OBSERVATION_COLUMNS,observations);
}
function replacementsFirst(claims){const byId=new Map(claims.map(c=>[c.id,c])),done=new Set(),out=[];const visit=c=>{if(done.has(c.id))return;done.add(c.id);const next=byId.get(c.supersededByClaimId);if(next)visit(next);out.push(c);};claims.forEach(visit);return out;}
function snake(row){return Object.fromEntries(Object.entries(row).map(([key,value])=>[key.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),value]));}
function insertRows(table,columns,rows){
 if(!rows.length)return '';
 return 'insert into public.'+table+' ('+columns.join(',')+') select '+columns.map(c=>'r.'+c).join(',')+' from jsonb_populate_recordset(null::public.'+table+', '+json(rows)+') r;\n';
}
/** Column-backed timestamps come back from PostgreSQL as e.g. 2026-07-27T15:00:00+00:00; JSON-stored ones keep their text. */
function pgTimes(value){
 if(Array.isArray(value))return value.map(pgTimes);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,pgTimes(v)]));
 const m=typeof value==='string'&&/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d+))?Z$/.exec(value);
 if(!m)return value;const fraction=(m[2]??'').replace(/0+$/,'');return m[1]+(fraction?'.'+fraction:'')+'+00:00';
}
function fixtureFor(plan){
 const demo=canonicalDemoDataV4({workspaceId:plan.workspaceId,organizationId:plan.organizationId,reviewerMemberId:plan.reviewerMemberId,reviewerUserId:plan.reviewerUserId});
 // Each review is re-frozen from its OWN frozen records in the database's ordering (delivery_source orders
 // evidence, claims and claim evidence by id). Re-freezing a Final from today's records would rewrite history.
 const dbOrder=snapshots=>{for(const snap of snapshots){snap.initiative={archivedAt:null,archivedBy:null,archiveReason:null,...snap.initiative,createdBy:plan.reviewerUserId};snap.evidence.sort((a,b)=>a.id.localeCompare(b.id));snap.claims.sort((a,b)=>a.id.localeCompare(b.id));for(const claim of snap.claims){claim.evidence.sort((a,b)=>a.id.localeCompare(b.id));claim.anchors?.sort((a,b)=>a.evidenceId.localeCompare(b.evidenceId));}}return snapshots;};
 for(const snap of demo.source.snapshots)snap.initiative.createdBy=plan.reviewerUserId;
 for(const review of demo.deliveryState.reviews){
   const frozen=structuredClone(review.input);const source={...frozen,contexts:demo.productStore.contexts,snapshots:pgTimes(dbOrder(frozen.snapshots))};
   review.input=freezeInput(source,{...demo.deliveryState,facts:frozen.facts,events:frozen.events},plan.workspaceId,frozen.asOf);
   for(const section of review.sections)section.sourceDigest=sectionDigest(review.input,section.initiativeId);
 }
 return demo;
}

export function preflightSql(plan,providerMustExist=false,allowPendingProvider=false){
 const p=plan,prior=p.prior;
 return `do $guard$
 begin
 perform pg_advisory_xact_lock(13142026);
 perform public.require_platform_owner(${literal(p.actorId)}::uuid);
 if to_regclass('public.demo_scenarios') is null then raise exception 'DEMO_SCHEMA_REQUIRED';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.organizations'::regclass and contype='c' and pg_get_constraintdef(oid) like '%ARCHIVED%') then raise exception 'ARCHIVE_SCHEMA_REQUIRED';end if;
 if exists(select 1 from public.organizations where id=${literal(p.organizationId)}::uuid) or exists(select 1 from public.workspaces where id=${literal(p.workspaceId)}::uuid) then raise exception 'NEW_GENERATION_ALREADY_EXISTS';end if;
 if exists(select 1 from auth.users where (id=${literal(p.authUserId)}::uuid and lower(email)<>${literal(EMAIL)}) or (lower(email)=${literal(EMAIL)} and id<>${literal(p.authUserId)}::uuid)) then raise exception 'PROVIDER_IDENTITY_MISMATCH';end if;
 ${!prior&&!providerMustExist&&!allowPendingProvider?`if exists(select 1 from auth.users where lower(email)=${literal(EMAIL)}) then raise exception 'UNREGISTERED_PROVIDER_IDENTITY';end if;`:''}
 ${providerMustExist?`if not exists(select 1 from auth.users where id=${literal(p.authUserId)}::uuid and lower(email)=${literal(EMAIL)} and email_confirmed_at is not null) then raise exception 'CONFIRMED_PROVIDER_IDENTITY_REQUIRED';end if;`:''}
 ${!prior?`if exists(select 1 from public.users where id=${literal(p.reviewerUserId)}::uuid or lower(email)=${literal(EMAIL)}) then raise exception 'REVIEWER_IDENTITY_ALREADY_EXISTS';end if;`:`
 perform 1 from public.organizations where id=${literal(prior.organizationId)}::uuid for update;
 perform 1 from public.workspaces where organization_id=${literal(prior.organizationId)}::uuid for update;
 perform 1 from public.organization_memberships where organization_id=${literal(prior.organizationId)}::uuid for update;
 perform 1 from public.users where id=${literal(p.reviewerUserId)}::uuid for update;
 if not exists(select 1 from public.users where id=${literal(p.reviewerUserId)}::uuid and auth_user_id=${literal(p.authUserId)}::uuid and lower(email)=${literal(EMAIL)} and active and not is_system and platform_role is null) then raise exception 'REVIEWER_IDENTITY_CHANGED';end if;
 if not exists(select 1 from public.demo_scenarios d join public.organizations o on o.id=d.organization_id join public.workspaces w on w.id=d.workspace_id
 where d.workspace_id=${literal(prior.workspaceId)}::uuid and d.organization_id=${literal(prior.organizationId)}::uuid and d.canonical_version=${literal(p.version)} and d.scenario_at=${literal(p.scenarioAt)}::timestamptz and o.status='ACTIVE' and w.status='ACTIVE' and cardinality(o.allowed_email_domains)=0 and o.allowed_exact_emails=array[${literal(EMAIL)}]::text[]) then raise exception 'REGISTERED_DEMO_TARGET_CHANGED';end if;
 if not exists(select 1 from public.organization_memberships where id=${literal(prior.reviewerMemberId)}::uuid and organization_id=${literal(prior.organizationId)}::uuid and user_id=${literal(p.reviewerUserId)}::uuid and role='ORG_OWNER' and active and not policy_override) then raise exception 'REGISTERED_DEMO_OWNER_CHANGED';end if;
 if exists(select 1 from public.workspaces where organization_id=${literal(prior.organizationId)}::uuid and id<>${literal(prior.workspaceId)}::uuid) then raise exception 'UNEXPECTED_DEMO_WORKSPACE';end if;
 if exists(select 1 from public.organization_memberships m join public.users u on u.id=m.user_id where m.organization_id=${literal(prior.organizationId)}::uuid and (u.platform_role is not null or (m.user_id<>${literal(p.reviewerUserId)}::uuid and not (u.auth_user_id is null and lower(u.email) like '%@example.demo')))) then raise exception 'UNEXPECTED_DEMO_MEMBER';end if;
 if exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id where m.user_id=${literal(p.reviewerUserId)}::uuid and m.organization_id<>${literal(prior.organizationId)}::uuid and (m.active or o.status<>'ARCHIVED' or not exists(select 1 from public.demo_scenarios d where d.organization_id=o.id))) then raise exception 'FOREIGN_REVIEWER_MEMBERSHIP';end if;
 perform 1 from public.demo_entry_config for update;
 if exists(select 1 from public.demo_entry_config where workspace_id<>${literal(prior.workspaceId)}::uuid or user_id<>${literal(p.reviewerUserId)}::uuid) then raise exception 'DEMO_ENTRY_TARGET_CHANGED';end if;
 `}
 end $guard$;`;
}

export function renderHostedTransaction(plan){
 const demo=fixtureFor(plan),store=demo.productStore,p=plan;
 let sql='begin;\nset local standard_conforming_strings=on;\nset local lock_timeout=\'10s\';\nset local statement_timeout=\'60s\';\n'+preflightSql(p,true)+'\n';
 if(!p.prior)sql+=`insert into public.users(id,email,display_name,auth_user_id,is_system,active) values(${literal(p.reviewerUserId)}::uuid,${literal(EMAIL)},'Demo Reviewer',${literal(p.authUserId)}::uuid,false,true);\n`;
 sql+=`insert into public.organizations(id,name,status,allowed_email_domains,allowed_exact_emails) values(${literal(p.organizationId)}::uuid,${literal(DEMO_ORGANIZATION_NAME)},'BOOTSTRAPPING',array[]::text[],array[${literal(EMAIL)}]::text[]);
insert into public.workspaces(id,name,status,organization_id) values(${literal(p.workspaceId)}::uuid,${literal(DEMO_ORGANIZATION_NAME)},'BOOTSTRAPPING',${literal(p.organizationId)}::uuid);
insert into public.organization_memberships(id,organization_id,user_id,role,active,is_product_lead,policy_override) values(${literal(p.reviewerMemberId)}::uuid,${literal(p.organizationId)}::uuid,${literal(p.reviewerUserId)}::uuid,'ORG_OWNER',true,false,false);
insert into public.demo_scenarios(workspace_id,organization_id,canonical_version,scenario_at) values(${literal(p.workspaceId)}::uuid,${literal(p.organizationId)}::uuid,${literal(p.version)},${literal(p.scenarioAt)}::timestamptz);
update public.organizations set status='ACTIVE' where id=${literal(p.organizationId)}::uuid;
update public.workspaces set status='ACTIVE' where id=${literal(p.workspaceId)}::uuid;
`;
 // Fictional personas: Demo members who own and act on work. No provider identity, so they can never sign in.
 // Reused across generations; an existing row must still be exactly a sign-in-less persona.
 for(const x of demo.personas)sql+=`insert into public.users(id,email,display_name,auth_user_id,is_system,active) values(${literal(x.userId)}::uuid,${literal(x.email)},${literal(x.displayName)},null,false,true) on conflict (id) do nothing;
do $$begin if not exists(select 1 from public.users where id=${literal(x.userId)}::uuid and lower(email)=${literal(x.email)} and auth_user_id is null and platform_role is null) then raise exception 'DEMO_PERSONA_IDENTITY_CHANGED';end if;end$$;\n`;
 sql+=insertRows('organization_memberships',['id','organization_id','user_id','role','active','is_product_lead','policy_override','policy_override_reason','joined_via'],demo.personas.map(x=>({id:x.memberId,organization_id:p.organizationId,user_id:x.userId,role:x.role,active:true,is_product_lead:x.isProductLead,policy_override:true,policy_override_reason:'Synthetic Demo persona; cannot sign in.',joined_via:'PLATFORM'})));
 sql+=insertRows('initiatives',['id','workspace_id','slug','name','description','known_references','business_line','stage','overall_state','state_summary','is_demo','created_by','created_at','updated_at','current_context_id'],store.initiatives.map(row=>({...snake(row),current_context_id:row.currentContextId??null,created_by:p.reviewerUserId})));
 sql+=insertRows('initiative_contexts',['id','workspace_id','initiative_id','label','note','revision','created_at','updated_at','retired_at','created_by'],store.contexts.map(c=>({...snake(c),created_by:p.reviewerUserId})));

 sql+=insertRows('initiative_sources',['id','workspace_id','initiative_id','name','source_type','connection_state','last_synced_at','created_at','updated_at'],store.sources.map(snake));
 sql+=insertRows('evidence',['id','workspace_id','initiative_id','source_id','title','source_type','source_reference','source_url','content_summary','boundary','occurred_at','captured_at','last_verified_at','created_by','created_at','updated_at'],store.evidence.map(snake));
 sql+=renderP1Rows(demo,p,'BEFORE_CLAIMS');
 // A replacement claim is inserted before the claim it supersedes.
 sql+=insertRows('claims',['id','workspace_id','initiative_id','type','status','subject','attribute','value','domain','phase','confidence','superseded_by_claim_id','created_by','created_at','updated_at','origin','verified_at','verified_actor_id','verified_actor_label','verification_basis','verification_note','evidence_submission_id','evidence_anchor_id','context_id','effective_date'],replacementsFirst(store.claims).map(c=>({...snake(c),context_id:c.contextId??null,effective_date:c.effectiveDate??null,evidence_submission_id:c.evidenceSubmissionId??null,evidence_anchor_id:c.evidenceAnchorId??null})));
 sql+=insertRows('claim_evidence',['workspace_id','claim_id','evidence_id','created_at','locator','excerpt'],store.claimEvidence.map(snake));
 const personaIds=new Map(demo.personas.map(x=>[x.displayName,x.userId]));
 const logs=[...store.activity.map(row=>({...snake(row),actor_id:personaIds.get(row.actorLabel)??p.reviewerUserId})),...demo.deliveryState.events.map(event=>({id:event.id,workspace_id:p.workspaceId,initiative_id:event.initiativeId,actor_id:personaIds.get(event.actor.label)??p.reviewerUserId,actor_label:event.actor.label,event_type:'DELIVERY_FACT_RECORDED',summary:'Synthetic scenario delivery fact prepared',occurred_at:event.occurredAt,entity_type:'DELIVERY_FACT',entity_id:event.after.id,payload:{deliveryEvent:event}}))];
 sql+=insertRows('activity_log',['id','workspace_id','initiative_id','actor_id','actor_label','event_type','summary','occurred_at','entity_type','entity_id','payload'],logs);
 sql+=insertRows('delivery_facts',['id','workspace_id','initiative_id','kind','revision','value_date','value_text','owner_member_id','data'],demo.deliveryState.facts.map(f=>({id:f.id,workspace_id:p.workspaceId,initiative_id:f.initiativeId,kind:f.kind,revision:f.revision,value_date:f.value.date,value_text:f.value.text,owner_member_id:f.value.memberId,data:f})));
 sql+=insertRows('weekly_reviews',['id','workspace_id','iso_week','status','revision','data'],demo.deliveryState.reviews.map(r=>({id:r.id,workspace_id:p.workspaceId,iso_week:r.week,status:r.status,revision:r.revision,data:r})));
 sql+=renderP1Rows(demo,p,'AFTER_CLAIMS');
 // Synthetic business metrics (read-only in the product). demo_scenarios is registered above, so the scope guard accepts them.
 sql+=renderMetricRows(demo.metrics,p);
 // Archiving is the last write: archived initiatives refuse further product rows. Pinned to this generation's workspace.
 sql+=store.initiatives.filter(i=>i.archivedAt).map(i=>`update public.initiatives set archived_at=${literal(i.archivedAt)}::timestamptz,archived_by=${literal(i.archivedBy)}::uuid,archive_reason=${literal(i.archiveReason)} where id=${literal(i.id)}::uuid and workspace_id=${literal(p.workspaceId)}::uuid;\n`).join('');
 if(p.prior){
  sql+=`update public.organizations set status='ARCHIVED' where id=${literal(p.prior.organizationId)}::uuid;
update public.workspaces set status='ARCHIVED' where id=${literal(p.prior.workspaceId)}::uuid and organization_id=${literal(p.prior.organizationId)}::uuid;
update public.organization_memberships set active=false where id=${literal(p.prior.reviewerMemberId)}::uuid and organization_id=${literal(p.prior.organizationId)}::uuid and user_id=${literal(p.reviewerUserId)}::uuid;
update public.workspace_sessions set expires_at=least(expires_at,clock_timestamp()) where workspace_id=${literal(p.prior.workspaceId)}::uuid and organization_id=${literal(p.prior.organizationId)}::uuid and user_id=${literal(p.reviewerUserId)}::uuid;
-- Explore Demo follows the generation: the operator-only entry pointer moves from the archived workspace to the new one
-- (checked in the preflight to point at exactly the prior generation and reviewer). An enabled entry must then resolve.
update public.demo_entry_config set workspace_id=${literal(p.workspaceId)}::uuid where singleton and workspace_id=${literal(p.prior.workspaceId)}::uuid and user_id=${literal(p.reviewerUserId)}::uuid;
do $entry$begin if exists(select 1 from public.demo_entry_config where workspace_id<>${literal(p.workspaceId)}::uuid) then raise exception 'DEMO_ENTRY_NOT_MOVED';end if;
 if exists(select 1 from public.demo_entry_config where enabled) and (public.require_demo_entry()->>'workspaceId')::uuid<>${literal(p.workspaceId)}::uuid then raise exception 'DEMO_ENTRY_NOT_RESOLVED';end if;end$entry$;
select public.platform_audit(${literal(p.actorId)}::uuid,${literal(p.prior.organizationId)}::uuid,${literal(p.prior.workspaceId)}::uuid,${literal(p.prior.workspaceId)},'DEMO_GENERATION_ARCHIVED',null,${json({replacedByWorkspaceId:p.workspaceId})},'Operator reset retained all prior synthetic business records and Final reviews; only old Demo access was retired.',false);
`;
 }
 sql+=`select public.platform_audit(${literal(p.actorId)}::uuid,${literal(p.organizationId)}::uuid,${literal(p.workspaceId)}::uuid,${literal(p.reviewerUserId)},'DEMO_GENERATION_PREPARED',null,${json({version:p.version,dataset:DEMO_V4_VERSION,scenarioAt:p.scenarioAt,role:'ORG_OWNER',platformRole:null,priorWorkspaceId:p.prior?.workspaceId??null})},'Explicit operator preparation of isolated synthetic graduation reviewer scenario.',false);
set constraints all immediate;
commit;
`;
 return sql;
}

function privateWrite(path,value){const temporary=path+'.'+randomUUID()+'.tmp';try{writeFileSync(temporary,typeof value==='string'?value:JSON.stringify(value,null,2),{flag:'wx',mode:0o600});renameSync(temporary,path);}finally{if(existsSync(temporary))rmSync(temporary);}}
function pgEnvironment(databaseUrl){
 const db=new URL(databaseUrl);
 return {...process.env,PGHOST:db.hostname,PGPORT:db.port||'5432',PGDATABASE:decodeURIComponent(db.pathname.slice(1)),PGUSER:decodeURIComponent(db.username),PGPASSWORD:decodeURIComponent(db.password),PGSSLMODE:'verify-full',PGCONNECT_TIMEOUT:'15'};
}
function database(sql,config,privateRoot){
 const result=spawnSync(config.psqlPath||'psql',['-X','-q','-A','-t','--no-password','-v','ON_ERROR_STOP=1','-f','-'],{input:sql,encoding:'utf8',windowsHide:true,env:pgEnvironment(config.databaseUrl),maxBuffer:16*1024*1024});
 if(result.status!==0){
   let diagnostic=String(result.stderr||result.error?.message||'Database command failed');
   for(const secret of [config.databaseUrl,config.serviceKey,new URL(config.databaseUrl).password])if(secret)diagnostic=diagnostic.replaceAll(secret,'[REDACTED]');
   privateWrite(join(privateRoot,'hosted-demo-diagnostic.txt'),diagnostic);
   throw new Error('Database gate failed. Private diagnostic saved; no credentials were printed.');
 }
 return result.stdout.trim();
}
function selfTest(){
 const ref='abcdefghijklmnopqrst',actorId='10000000-0000-4000-8000-000000000001';
 validateHostedTarget({projectRef:ref,supabaseUrl:'https://'+ref+'.supabase.co',databaseUrl:'postgresql://postgres:private@db.'+ref+'.supabase.co:5432/postgres'},true);
 assert.throws(()=>validateHostedTarget({projectRef:ref,supabaseUrl:'https://otherprojectabcdefgh.supabase.co'}));
 assert.throws(()=>validateHostedTarget({projectRef:ref,supabaseUrl:'https://'+ref+'.supabase.co',databaseUrl:'postgresql://postgres:private@db.other.supabase.co/postgres'},true));
 assert.throws(()=>validateHostedTarget({projectRef:ref,supabaseUrl:'https://'+ref+'.supabase.co',databaseUrl:'postgresql://postgres.wrong:private@aws-0-x.pooler.supabase.com/postgres'},true));
 const initial=makeHostedPlan({projectRef:ref,actorId}),initialSql=renderHostedTransaction(initial);
 assert.ok(initialSql.includes('insert into public.demo_scenarios'));assert.ok(initialSql.indexOf('insert into public.metric_definitions')>initialSql.indexOf('insert into public.demo_scenarios'));assert.ok(initialSql.indexOf('insert into public.metric_observations')>initialSql.indexOf('insert into public.metric_definitions'));assert.ok(initialSql.includes('"preparedAsFixture":true'));assert.ok(!/\b(delete|truncate)\b/i.test(initialSql));assert.ok(!initialSql.includes("set status='ARCHIVED'"));
 const prior={...initial,version:DEMO_CANONICAL_VERSION};
 const reset=makeHostedPlan({projectRef:ref,actorId,prior}),sql=renderHostedTransaction(reset);
 assert.equal(reset.reviewerUserId,initial.reviewerUserId);assert.equal(reset.authUserId,initial.authUserId);assert.notEqual(reset.organizationId,initial.organizationId);assert.notEqual(reset.workspaceId,initial.workspaceId);
 assert.ok(sql.includes("set status='ARCHIVED'"));assert.ok(sql.includes('workspace_sessions set expires_at'));
 assert.ok(sql.includes(`update public.demo_entry_config set workspace_id='${reset.workspaceId}'::uuid where singleton and workspace_id='${prior.workspaceId}'::uuid`),'reset moves Explore Demo to the new generation');
 assert.ok(sql.indexOf('update public.demo_entry_config')>sql.indexOf("update public.workspaces set status='ARCHIVED'"),'entry moves after the prior generation is archived');
 assert.ok(sql.includes('DEMO_ENTRY_TARGET_CHANGED')&&sql.includes('DEMO_ENTRY_NOT_RESOLVED'),'entry pointer is guarded before and verified after');
 assert.ok(!initialSql.includes('update public.demo_entry_config'),'an initial generation never enables public entry');assert.ok(!/\b(delete|truncate)\b/i.test(sql));for(const statement of sql.match(/update public\.(weekly_reviews|delivery_facts|claims|evidence|initiatives)\b[^\n]*\n/gi)??[])assert.ok(statement.includes(`workspace_id='${reset.workspaceId}'::uuid`),'business updates must be pinned to the new generation');
 assert.throws(()=>makeHostedPlan({projectRef:ref,actorId,prior:{...prior,platformRole:'PLATFORM_OWNER'}}));assert.throws(()=>makeHostedPlan({projectRef:ref,actorId,prior:{...prior,projectRef:'otherprojectabcdefgh'}}));
 assert.throws(()=>makeHostedPlan({projectRef:ref,actorId,prior,ids:{workspaceId:prior.workspaceId}}));
 validatePlan(reset,{projectRef:ref,actorId});assert.throws(()=>validatePlan({...reset,role:'ADMIN'},{projectRef:ref,actorId}));
 console.log(JSON.stringify({status:'PASS',offlineGateGroups:5,targetPinning:true,identityReuse:true,freshGeneration:true,historyPreservationPlan:true,planTamperingRefused:true,hostedCalls:0}));
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--self-test'){selfTest();return;}
 if(args.length!==2||!['--dry-run','--apply'].includes(args[0])||!['--initial','--reset'].includes(args[1]))throw new Error('Use --dry-run|--apply with --initial|--reset, or --self-test.');
 const require=createRequire(import.meta.url);require('@next/env').loadEnvConfig(process.cwd(),true,{info(){},error(){}});
 const config={projectRef:process.env.PRODWISE_EXPECTED_SUPABASE_REF,supabaseUrl:process.env.SUPABASE_URL,databaseUrl:process.env.PRODWISE_DATABASE_URL,actorId:process.env.PRODWISE_PLATFORM_ACTOR_ID,serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,psqlPath:process.env.PRODWISE_PSQL_PATH};
 validateHostedTarget(config,args[0]==='--apply');
 const privateRoot=resolve('.data'),activePath=join(privateRoot,'demo-hosted-access.json'),planPath=join(privateRoot,'demo-hosted-plan.json'),sqlPath=join(privateRoot,'demo-hosted-plan.sql'),pendingPath=join(privateRoot,'demo-hosted-pending.json');
 mkdirSync(privateRoot,{recursive:true});
 const lockPath=join(privateRoot,'hosted-demo-operator.lock');mkdirSync(lockPath);
 try{
 for(const path of [activePath,planPath,sqlPath,pendingPath]){
  const tracked=spawnSync('git',['ls-files','--',path],{encoding:'utf8',windowsHide:true}),ignored=spawnSync('git',['check-ignore',path],{encoding:'utf8',windowsHide:true});
  if(tracked.status!==0||tracked.stdout.trim()||ignored.status!==0)throw new Error('Hosted operator files must be ignored and untracked.');
 }
 const prior=existsSync(activePath)?JSON.parse(readFileSync(activePath,'utf8')):null;
 if(args[1]==='--reset'&&!prior)throw new Error('A private registered hosted Demo generation is required for reset.');
 if(args[1]==='--initial'&&prior)throw new Error('A hosted Demo is already registered; use an explicit generation reset.');
 if(args[0]==='--dry-run'){
  if(existsSync(pendingPath))throw new Error('A prior apply is pending. Preserve its recovery files before preparing another plan.');
  const plan=makeHostedPlan({projectRef:config.projectRef,actorId:config.actorId,prior});
  const sql=renderHostedTransaction(plan);privateWrite(planPath,plan);privateWrite(sqlPath,sql);
  console.log(JSON.stringify({status:'PLAN_PREPARED',mode:plan.mode,organization:DEMO_ORGANIZATION_NAME,reviewerRole:'ORG_OWNER',platformRole:null,businessDeletion:false,networkCalls:0,sqlStoredPrivately:true}));return;
 }
 if(!config.serviceKey||!existsSync(planPath))throw new Error('A private service key and a prepared plan are required.');
 const plan=JSON.parse(readFileSync(planPath,'utf8'));validatePlan(plan,config);
 if((plan.mode==='INITIAL')!==(args[1]==='--initial')||canonical(plan.prior)!==canonical(prior?{organizationId:prior.organizationId,workspaceId:prior.workspaceId,reviewerMemberId:prior.reviewerMemberId}:null))throw new Error('Current registration does not match the prepared plan.');
 const sql=renderHostedTransaction(plan);if(readFileSync(sqlPath,'utf8')!==sql)throw new Error('The reviewed SQL bundle changed. Recreate and review the plan.');
 let pending=existsSync(pendingPath)?JSON.parse(readFileSync(pendingPath,'utf8')):null;
 if(pending&&(pending.planDigest!==digest(JSON.stringify(plan))||pending.authUserId!==plan.authUserId||typeof pending.password!=='string'||pending.password.length<32))throw new Error('Pending provider preparation belongs to a different or invalid plan.');
 database('begin;\n'+preflightSql(plan,false,Boolean(pending))+'\nrollback;',config,privateRoot);
 const backup=join(privateRoot,'hosted-demo-backups',new Date().toISOString().replaceAll(':','-')+'-'+randomUUID());mkdirSync(backup,{recursive:true});
 if(prior)privateWrite(join(backup,'prior-registration.json'),prior);privateWrite(join(backup,'plan.json'),plan);privateWrite(join(backup,'transaction.sql'),sql);
 if(!pending){pending={planDigest:digest(JSON.stringify(plan)),password:prior?.password??randomBytes(30).toString('base64url'),authUserId:plan.authUserId};privateWrite(pendingPath,pending);}
 const {createClient}=await import('@supabase/supabase-js');
 const provider=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 let providerUser=await provider.auth.admin.getUserById(plan.authUserId);
 if(providerUser.error||!providerUser.data.user){
   if(plan.prior)throw new Error('Registered reviewer provider identity is unavailable. No password or identity was changed.');
   providerUser=await provider.auth.admin.createUser({id:plan.authUserId,email:EMAIL,password:pending.password,email_confirm:true,user_metadata:{display_name:'Demo Reviewer'}});
 }
 if(providerUser.error||providerUser.data.user?.id!==plan.authUserId||providerUser.data.user?.email?.toLowerCase()!==EMAIL)throw new Error('Provider identity preparation failed. Private pending recovery file retained; no existing credentials changed.');
 database(sql,config,privateRoot);
 const active={...plan,password:pending.password,createdAt:new Date().toISOString(),previous:prior?[...(prior.previous??[]),{organizationId:prior.organizationId,workspaceId:prior.workspaceId,reviewerMemberId:prior.reviewerMemberId}]:[]};
 privateWrite(activePath,active);privateWrite(join(backup,'completed.json'),{workspaceId:plan.workspaceId,organizationId:plan.organizationId,completedAt:active.createdAt});rmSync(pendingPath);
 console.log(JSON.stringify({status:'APPLIED',mode:plan.mode,organization:DEMO_ORGANIZATION_NAME,workspaceId:plan.workspaceId,reviewerRole:'ORG_OWNER',platformRole:null,priorBusinessHistoryRetained:true,credentialsStoredPrivately:true}));
 }finally{rmdirSync(lockPath);}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{console.error('Hosted Demo operator stopped safely. Review the private configuration, plan and diagnostic; no secret values were printed.');process.exitCode=1;});
