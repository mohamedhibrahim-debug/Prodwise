import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalDemoData,DEMO_CUTOFF} from '../demo/canonical.ts';
import {buildPortfolioProjection} from '../workspace/portfolio.ts';
import {recommend,setupQueue,type RecommendInput} from './recommend.ts';

const identity={workspaceId:'11111111-1111-4111-8111-111111111111',organizationId:'22222222-2222-4222-8222-222222222222',reviewerMemberId:'33333333-3333-4333-8333-333333333333',reviewerUserId:'44444444-4444-4444-8444-444444444444'};
const fixture=()=>{const d=canonicalDemoData(identity);return {d,p:buildPortfolioProjection({source:d.source,state:d.deliveryState,workspaceId:identity.workspaceId,activity:d.productStore.activity,asOf:DEMO_CUTOFF})};};
const base=(p:ReturnType<typeof fixture>['p']):RecommendInput=>({today:p.today,me:{memberId:identity.reviewerMemberId,writer:true,canFinalize:true},rows:p.rows,commitments:[],questions:[],review:{week:'2026-W39',status:'DRAFT',pending:2,total:5,started:true,next:null}});

test('a recorded difference awaiting a decision ranks first and says why',()=>{
 const {p}=fixture();const out=recommend(base(p));
 assert.ok(out.length>=1&&out.length<=3);
 assert.equal(out[0]!.kind,'decision');assert.match(out[0]!.why,/Two recorded values differ/);assert.doesNotMatch(out[0]!.why,/disagree|conflict in practice is (?!not)/);assert.ok(out[0]!.href.startsWith('/initiatives/'));
});
test('nothing recorded means no recommendation is manufactured',()=>{
 const {p}=fixture();const rows=p.rows.map(r=>({...r,attention:[],setup:{...r.setup,next:null,requirements:r.setup.requirements.map(x=>({...x,met:true}))},target:undefined,actual:undefined,nextStep:undefined}));
 const out=recommend({...base(p),rows,review:{week:'2026-W39',status:'FINAL',pending:0,total:5,started:true,next:{week:'2026-W40',started:false,exists:false}}});
 assert.deepEqual(out,[]);
});
test('pending proposals, the review and a first metric are grounded in recorded state',()=>{
 const {p}=fixture();const target=p.rows.find(r=>r.target?.value.date)!;
 // A recorded full Actual Live on one initiative, so "live with nothing measured" has something to point at.
 const live={...target,actual:{...target.target!,kind:'ACTUAL_LIVE' as const,value:{...target.target!.value,extent:'FULL' as const}}};
 const rows=p.rows.map(r=>r===target?live:r);
 const out=recommend({...base(p),rows,limit:10,proposals:[{initiativeId:p.rows[0]!.initiative.id,pending:2,sourceTitle:'Grooming notes'}],metrics:[{initiativeId:live.initiative.id,configured:0}]});
 assert.ok(out.some(r=>r.kind==='proposal'&&/2 pending proposals/.test(r.action)&&/Grooming notes/.test(r.why)));
 assert.ok(out.some(r=>r.kind==='review'&&/2 of 5 sections/.test(r.action)));
 assert.ok(out.some(r=>r.kind==='metric'&&r.initiative?.slug===live.initiative.slug));
});
test('the list is capped and spreads across initiatives before repeating one',()=>{
 const {p}=fixture();const out=recommend({...base(p),limit:3});
 assert.ok(out.length<=3);const slugs=out.map(r=>r.initiative?.slug??r.kind);assert.equal(new Set(slugs).size,slugs.length);
});
test('a viewer is never told to prepare or finalize a review, and is pointed to who can act',()=>{
 const {p}=fixture();const out=recommend({...base(p),me:{memberId:null,writer:false,canFinalize:false},review:{week:'2026-W40',status:'NONE',pending:0,total:0,started:true,next:null},limit:10});
 assert.ok(!out.some(r=>r.kind==='review'));
 for(const r of out){assert.match(r.action,/^Ask someone with write access to /);assert.match(r.why,/read-only/);}
});
test('the setup queue names gaps with direct links and never invents readiness',()=>{
 const {p}=fixture();const q=setupQueue(p.rows,{week:'2026-W40',status:'NONE',pending:0,total:0,started:true,next:null},true);
 assert.ok(q.length<=5);for(const item of q){assert.ok(item.href.startsWith('/'));assert.ok(item.label.length>0);}
 assert.ok(q.some(i=>i.key==='review'));
});
