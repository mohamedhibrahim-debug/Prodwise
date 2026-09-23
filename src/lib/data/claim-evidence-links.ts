export function partitionEvidenceLinks<T extends { evidenceId: string }>(
  current: readonly T[],
  desiredEvidenceIds: readonly string[],
): { retained: T[]; removed: T[]; addedEvidenceIds: string[] } {
  const desired = new Set(desiredEvidenceIds);
  const currentIds = new Set(current.map((link) => link.evidenceId));
  return {
    retained: current.filter((link) => desired.has(link.evidenceId)),
    removed: current.filter((link) => !desired.has(link.evidenceId)),
    addedEvidenceIds: [...desired].filter((id) => !currentIds.has(id)),
  };
}
