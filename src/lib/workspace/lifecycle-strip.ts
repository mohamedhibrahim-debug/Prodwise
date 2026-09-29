import { STAGES, type Stage } from '../domain/types.ts';

/**
 * Data for the lifecycle strip: how many active initiatives sit in each of
 * the eight recorded stages, always in lifecycle order and always all eight,
 * so the legend reads the same on every screen. A count is a count of
 * recorded stages; it says nothing about readiness (CLAUDE.md §7, §12).
 */
export interface StageCount { stage: Stage; count: number }

export function lifecycleDistribution(rows: { initiative: { stage: Stage; archivedAt?: string | null } }[]): StageCount[] {
  const active = rows.filter(r => !r.initiative.archivedAt);
  return STAGES.map(stage => ({ stage, count: active.filter(r => r.initiative.stage === stage).length }));
}

/** Where a recorded stage sits: earlier stages read as passed, later as ahead. Not a waterfall claim, only a position. */
export function stagePosition(stage: Stage): { index: number; earlier: Stage[]; later: Stage[] } {
  const index = STAGES.indexOf(stage);
  return { index, earlier: STAGES.slice(0, Math.max(0, index)), later: STAGES.slice(index + 1) };
}
