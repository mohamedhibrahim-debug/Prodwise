import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalDeliveryStore } from "./local-store.ts";
test("Durable isolated delivery file survives reopen; failed transaction leaves no partial state",async()=>{
 const root=await mkdtemp(join(tmpdir(),"prodwise-delivery-test-"));
 try {const path=join(root,"isolated.json"); const store=new LocalDeliveryStore(path); await store.transaction(async state=>({...state,schema:1})); const reopened=new LocalDeliveryStore(path); assert.deepEqual(await reopened.read(),{schema:1,facts:[],events:[],reviews:[]}); await assert.rejects(store.transaction(async()=>{throw new Error("refused before write");})); assert.deepEqual(await reopened.read(),{schema:1,facts:[],events:[],reviews:[]});}
 finally { if (!root.startsWith(join(tmpdir(),"prodwise-delivery-test-"))) throw new Error("Unexpected temp path"); await rm(root,{recursive:true,force:true}); }
});
test("Exclusive local transaction refuses concurrent writer instead of losing data",async()=>{
 const root=await mkdtemp(join(tmpdir(),"prodwise-delivery-test-")); let release:()=>void=()=>{}; let started:()=>void=()=>{}; const entered=new Promise<void>(resolve=>{started=resolve;}); const gate=new Promise<void>(resolve=>{release=resolve;});
 try {const store=new LocalDeliveryStore(join(root,"isolated.json")); const first=store.transaction(async state=>{started();await gate;return state;}); await entered; await assert.rejects(store.transaction(async state=>state),/Another delivery/); release(); await first;}
 finally {release(); if (!root.startsWith(join(tmpdir(),"prodwise-delivery-test-"))) throw new Error("Unexpected temp path"); await rm(root,{recursive:true,force:true});}
});

test("Ownership read lock serializes behind delivery writes and never rewrites state",async()=>{
 const root=await mkdtemp(join(tmpdir(),"prodwise-delivery-test-"));let release:()=>void=()=>{};let entered:()=>void=()=>{};
 const started=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{release=r;});
 try{const store=new LocalDeliveryStore(join(root,"isolated.json"));
 const writing=store.transaction(async state=>{entered();await gate;return state;});await started;
 await assert.rejects(store.withReadLock(()=>true),/Another delivery/);release();await writing;
 const before=await store.read();assert.equal(await store.withReadLock(s=>s.reviews.length),0);assert.deepEqual(await store.read(),before);
 await assert.rejects(store.withReadLock(()=>{throw new Error('refused');}),/refused/);
 assert.equal(await store.withReadLock(s=>s.facts.length),0);
 }finally{release();if(!root.startsWith(join(tmpdir(),"prodwise-delivery-test-")))throw new Error('Unexpected temp path');await rm(root,{recursive:true,force:true});}
});
