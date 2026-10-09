import type { ExecutiveState, PerformanceRow } from './types';

export const REPORTING_READ_SIZE = 5000;
type Header = { state: ExecutiveState; rowCount: number; revision: number };
type Part = { rows: PerformanceRow[]; revision: number };

export async function readReportingParts(
  header: Header,
  fetchPart: (offset: number, revision: number) => Promise<Part>,
): Promise<ExecutiveState> {
  if (!Number.isInteger(header.rowCount) || header.rowCount < 0 || header.rowCount > 300000 ||
      !Number.isInteger(header.revision) || header.state.revision !== header.revision)
    throw Error('Invalid reporting snapshot.');
  const rows: PerformanceRow[] = [];
  // Bound both response size and concurrent reads; never combine different revisions.
  for (let offset = 0; offset < header.rowCount; offset += REPORTING_READ_SIZE * 4) {
    const offsets = Array.from({ length: 4 }, (_, i) => offset + i * REPORTING_READ_SIZE)
      .filter(start => start < header.rowCount);
    const parts = await Promise.all(offsets.map(start => fetchPart(start, header.revision)));
    parts.forEach((part, i) => {
      const start = offsets[i];
      if (start === undefined || part.revision !== header.revision || !Array.isArray(part.rows) ||
          part.rows.length !== Math.min(REPORTING_READ_SIZE, header.rowCount - start))
        throw Error('Reporting changed while loading. Please reload.');
      rows.push(...part.rows);
    });
  }
  return { ...header.state, rows };
}
