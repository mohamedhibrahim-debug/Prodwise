import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportingParts } from './save-parts.ts';
import type { PerformanceRow } from './types.ts';

const row: PerformanceRow = {key:'x',product:'PGW',source:'PGW',date:'2026-08-01',kind:'PAYMENT',amount:10,currency:'EGP',businessUnit:'UNASSIGNED',runner:null,supplier:null,terminal:null};
test('reporting parts preserve exact row order and bound UTF-8 payload size',()=>{
  const rows=Array.from({length:12000},(_,i)=>({...row,key:String(i),source:'\u00e9'.repeat(100)}));
  const parts=[...reportingParts(rows)];
  assert.deepEqual(parts.flat(),rows);
  assert.ok(parts.length>3);
  for(const part of parts){assert.ok(part.length<=5000);assert.ok(Buffer.byteLength(JSON.stringify(part))<=1_000_000);}
});
test('empty reporting state needs no staged rows; oversized rows fail closed',()=>{
  assert.deepEqual([...reportingParts([])],[]);
  assert.throws(()=>[...reportingParts([{...row,source:'a'.repeat(1_000_001)}])],/too large/);
});
