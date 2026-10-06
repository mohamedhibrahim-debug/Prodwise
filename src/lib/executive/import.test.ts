import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { parseExcelImport } from './import.ts';

const headers = ['Transaction Reference','Transaction Date','Transaction Type','Transaction Status','Amount'];
async function report(amount: ExcelJS.CellValue = 10.29, extraSheet = false) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');
  sheet.addRow([...headers,'Customer Email']);
  sheet.addRow(['test-1',new Date('2026-08-01T00:00:00Z'),'SALE','SUCCESS',amount,'private@example.test']);
  sheet.getCell('B2').numFmt = 'yyyy-mm-dd';
  if (extraSheet) {
    const extra = workbook.addWorksheet('Another report');
    extra.addRow(headers);
    extra.addRow(['test-2','2026-08-02','SALE','SUCCESS',20]);
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
test('Excel adapter reads actual Excel dates and exact cents without retaining customer data',async()=>{
  const parsed = await parseExcelImport(await report(),'PGW','UNASSIGNED');
  assert.equal(parsed.rows[0]!.date,'2026-08-01');
  assert.equal(parsed.rows[0]!.amount,1029);
  assert.equal(JSON.stringify(parsed).includes('private@'),false);
});
test('Excel formulas and multiple matching reports are rejected',async()=>{
  await assert.rejects(()=>report({formula:'1+1',result:2}).then(bytes=>parseExcelImport(bytes,'PGW','UNASSIGNED')),/plain values/);
  await assert.rejects(()=>report(10,true).then(bytes=>parseExcelImport(bytes,'PGW','UNASSIGNED')),/Multiple PGW/);
});
test('non-PGW and invalid workbook uploads fail closed',async()=>{
  await assert.rejects(()=>parseExcelImport(new Uint8Array(),'WALLET','UNASSIGNED'),/PGW/);
  await assert.rejects(()=>parseExcelImport(new Uint8Array([1,2,3]),'PGW','UNASSIGNED'));
});
test('Excel archive expansion metadata is bounded before parsing',async()=>{
  const bytes=Buffer.from(await report());
  const central=bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  assert.ok(central>=0);
  bytes.writeUInt32LE(300_000_001,central+24);
  await assert.rejects(()=>parseExcelImport(bytes,'PGW','UNASSIGNED'),/expanded-size/);
});

test('Excel worker transfer preserves caller bytes and respects sliced input',async()=>{
  const original=await report();
  const padded=new Uint8Array(original.length+16);
  padded.set(original,8);
  const view=padded.subarray(8,8+original.length);
  const first=await parseExcelImport(view,'PGW','UNASSIGNED');
  assert.equal(view.byteLength,original.byteLength);
  assert.deepEqual(view,original);
  const second=await parseExcelImport(view,'PGW','UNASSIGNED');
  assert.deepEqual(second,first);
});
