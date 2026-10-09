import type { PerformanceRow } from './types.ts';

export function* reportingParts(rows: PerformanceRow[]) {
  if (rows.length > 300_000) throw Error('Reporting capacity exceeded.');
  let part: PerformanceRow[] = [], bytes = 2;
  for (const row of rows) {
    const size = Buffer.byteLength(JSON.stringify(row), 'utf8') + 1;
    if (size > 1_000_000) throw Error('A reporting row is too large.');
    if (part.length && (bytes + size > 1_000_000 || part.length >= 5_000)) {
      yield part;
      part = []; bytes = 2;
    }
    part.push(row); bytes += size;
  }
  if (part.length) yield part;
}
