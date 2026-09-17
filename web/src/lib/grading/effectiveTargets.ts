export type EffectiveTarget = {
  label: string;
  points: number | null;
};

export type EffectiveTargetSelection = {
  targets: EffectiveTarget[];
  source: 'selected' | 'draft' | 'none';
  draftIsPending: boolean;
};

type DeriveEffectiveTargetsInput = {
  mode: 'single' | 'batch';
  selectedLabels: string[];
  pointsByLabel: Record<string, number>;
  draftLabel: string;
  draftPoints: number | null;
};

/**
 * Returns the exact problem targets used by grading.
 * Single grading keeps the historical implicit draft fallback. Batch grading
 * always requires an explicitly added target.
 */
export function deriveEffectiveTargets({
  mode,
  selectedLabels,
  pointsByLabel,
  draftLabel,
  draftPoints,
}: DeriveEffectiveTargetsInput): EffectiveTargetSelection {
  const explicitLabels = selectedLabels.filter((label) => label.trim().length > 0);
  const normalizedDraftLabel = draftLabel.trim();

  if (explicitLabels.length > 0) {
    return {
      targets: explicitLabels.map((label) => ({
        label,
        points: Number.isFinite(pointsByLabel[label]) ? pointsByLabel[label] : null,
      })),
      source: 'selected',
      draftIsPending: normalizedDraftLabel.length > 0,
    };
  }

  if (mode === 'single' && normalizedDraftLabel) {
    return {
      targets: [{ label: normalizedDraftLabel, points: draftPoints }],
      source: 'draft',
      draftIsPending: false,
    };
  }

  return { targets: [], source: 'none', draftIsPending: false };
}
