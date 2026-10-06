import { createHash } from 'node:crypto';
import { excelRecords } from './excel-reader.ts';
import { parse } from 'csv-parse/sync';
import { money, rowKey, validDay } from './model.ts';
import type { BusinessUnit, PerformanceRow, Product } from './types.ts';

export interface ParsedImport { product: Product; source: string; rows: PerformanceRow[]; excluded: number; firstDate: string; lastDate: string; digest: string; }
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function sourceDay(input: string | undefined): string {
  const value = input ?? '';
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})(?:[ T]|$)/)?.[1];
  const wallet = value.match(/^\w+, (\w+) (\d{1,2}),\s*(\d{4}) /);
  const result = iso ?? (wallet ? `${wallet[3]}-${String(months.indexOf(wallet[1]!)+1).padStart(2,'0')}-${wallet[2]!.padStart(2,'0')}` : '');
  if (!validDay(result)) throw Error('A transaction has an invalid date. Use the original source export.');
  return result;
}
export function normalizeRows(records: Record<string,string>[], product: Product, businessUnit: BusinessUnit = 'UNASSIGNED'): Omit<ParsedImport,'digest'> {
  if (!records.length) throw Error('The file has no transaction rows.');
  if (records.length > 150_000) throw Error('Import at most 150,000 rows at a time.');
  const required = product === 'WALLET' ? ['Date','Type','Amount','Currency','Response','System Reference'] : product === 'CASH_COLLECTION' ? ['transaction_id','transaction_timestamp','transaction_type','amount','supplier_id','runner_id','terminal_id'] : product === 'PGW' ? ['Transaction Reference','Transaction Date','Transaction Type','Transaction Status','Amount'] : [];
  if (!required.length) throw Error('Salefny uses reviewed aggregate entry in this version.');
  const missing = required.filter(k => !(k in records[0]!));
  if (missing.length) throw Error(`Source columns missing: ${missing.join(', ')}.`);
  const source = product === 'WALLET' ? 'Meeza Digital QR' : product === 'CASH_COLLECTION' ? 'Cash Collection transaction export' : 'PGW transaction report';
  const rows: PerformanceRow[] = []; let excluded = 0;
  for (const record of records) {
    if (product === 'WALLET' && !record['System Reference']) {
      if (record.Amount || record.Response || record.Type) throw Error('A Wallet transaction is missing its System Reference.');
      excluded++; continue;
    }
    let id: string | undefined, date: string, kind: PerformanceRow['kind'], amount: number;
    if (product === 'WALLET') {
      if (record.Currency !== 'EGP') throw Error('This Wallet import supports EGP only.');
      if (record.Response !== '0 - Approved') { excluded++; continue; }
      if (!['Meeza Digital Receive (P)','Meeza Digital Refund'].includes(record.Type ?? '')) throw Error('Unrecognized Wallet transaction type.');
      id = record['System Reference']; date = sourceDay(record.Date); amount = money(record.Amount); kind = record.Type === 'Meeza Digital Refund' ? 'REFUND' : 'PAYMENT';
    } else if (product === 'CASH_COLLECTION') {
      if (!['cash-in','payment'].includes(record.transaction_type ?? '')) throw Error('Unrecognized Cash Collection transaction type.');
      id = record.transaction_id; date = sourceDay(record.transaction_timestamp); amount = money(record.amount); kind = record.transaction_type === 'cash-in' ? 'CASH_IN' : 'PAYMENT';
    } else {
      if (record['Transaction Status'] !== 'SUCCESS') { excluded++; continue; }
      if (record['Transaction Type'] !== 'SALE') throw Error('Only SALE transactions are supported by this PGW adapter.');
      id = record['Transaction Reference']; date = sourceDay(record['Transaction Date']); amount = money(record.Amount); kind = 'PAYMENT';
    }
    if (!id?.trim()) throw Error('A transaction has no stable identifier. Nothing was imported.');
    rows.push({ key:rowKey(source,id), product, source, date, kind, amount, currency:'EGP', businessUnit,
      runner:product === 'CASH_COLLECTION' ? record.runner_id || null : null,
      supplier:product === 'CASH_COLLECTION' ? record.supplier_id || null : null,
      terminal:product === 'CASH_COLLECTION' ? record.terminal_id || null : null });
  }
  if (!rows.length) throw Error('No supported successful transactions were found.');
  const dates = rows.map(r => r.date).sort();
  return { product, source, rows, excluded, firstDate:dates[0]!, lastDate:dates.at(-1)! };
}

export function parseCsv(text: string): Record<string,string>[] {
  const table = parse(text, { bom:true, skip_empty_lines:true, relax_column_count_less:true, max_record_size:100_000 }) as string[][];
  const nonempty = table.filter(values => values.some(value => value !== ''));
  const header=nonempty.shift();if(!header?.length)throw Error('CSV header is missing.');
  if(new Set(header).size!==header.length)throw Error('CSV has duplicate column names.');
  return nonempty.map(values=>Object.fromEntries(header.map((key,i)=>[key,values[i]??''])));
}

export async function parseExcelImport(bytes: Uint8Array, product: Product, unit: BusinessUnit): Promise<ParsedImport> {
  if (product !== 'PGW') throw Error('Excel imports currently support the PGW transaction report only.');
  if (bytes.byteLength > 25_000_000) throw Error('Upload a file smaller than 25 MB.');
  const records = await excelRecords(bytes);
  return { ...normalizeRows(records,product,unit), digest:createHash('sha256').update(bytes).digest('hex') };
}
export function parseCsvImport(text: string, product: Product, unit: BusinessUnit): ParsedImport {
  return { ...normalizeRows(parseCsv(text),product,unit), digest:createHash('sha256').update(text).digest('hex') };
}
