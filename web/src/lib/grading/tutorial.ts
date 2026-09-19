export type TutorialStep =
  | 'intro'
  | 'select'
  | 'confirm'
  | 'score'
  | 'deductions'
  | 'rewrite'
  | 'complete';

export type TutorialOcrSnapshot = {
  results: Record<string, { text: string; charCount: number }>;
  confirmedTexts: Record<string, string>;
};

export type TutorialGradeResult = {
  label: string;
  status?: string;
  strictness?: 'lenient' | 'standard' | 'strict';
  result: {
    grading_result: {
      score: number;
      recognized_text?: string;
      recognized_text_full?: string;
      deduction_details?: Array<{
        reason?: string;
        deduction_percentage?: number;
        advice?: string;
      }>;
      feedback_content: {
        good_point?: string;
        improvement_advice?: string;
        rewrite_example?: string;
      };
    };
  };
};

export type TutorialStoredState = {
  version: 1;
  step: TutorialStep;
  paused: boolean;
  completed: boolean;
  ocr?: TutorialOcrSnapshot;
  grade?: { results: TutorialGradeResult[] };
};

export const TUTORIAL_STORAGE_PREFIX = 'taskal-grading-tutorial:v1:';
export const TUTORIAL_SAMPLE_LABEL = 'サンプル問5';

const STEPS: readonly TutorialStep[] = [
  'intro',
  'select',
  'confirm',
  'score',
  'deductions',
  'rewrite',
  'complete',
];

const ERROR_STATUSES = new Set(['error', 'failed', 'incomplete', 'partial']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasFailureMarker = (value: Record<string, unknown>): boolean => {
  const status = typeof value.status === 'string' ? value.status.toLowerCase() : '';
  return Boolean(value.error) || value.incomplete === true || value.incompleteGrading === true ||
    value.incomplete_grading === true || ERROR_STATUSES.has(status);
};

/** A successful grade must be complete enough for both the report and analytics. */
export function isValidGradeResult(value: unknown): boolean {
  if (!isRecord(value) || hasFailureMarker(value)) return false;
  if (typeof value.label !== 'string' || value.label.trim().length === 0) return false;
  const result = value.result;
  if (!isRecord(result) || hasFailureMarker(result)) return false;
  const gradingResult = result.grading_result;
  if (!isRecord(gradingResult) || hasFailureMarker(gradingResult)) return false;
  if (typeof gradingResult.score !== 'number' || !Number.isFinite(gradingResult.score)) return false;
  return isRecord(gradingResult.feedback_content);
}

export function isValidGradeResponse(value: unknown): value is { results: unknown[] } {
  if (!isRecord(value) || hasFailureMarker(value) || !Array.isArray(value.results)) return false;
  return value.results.length > 0 && value.results.every(isValidGradeResult);
}

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** Keep only the small report fields required to resume. Tokens and files are excluded. */
export function sanitizeGradeResults(values: unknown[]): TutorialGradeResult[] {
  return values.filter(isValidGradeResult).map((value) => {
    const item = value as Record<string, unknown>;
    const result = item.result as Record<string, unknown>;
    const grading = result.grading_result as Record<string, unknown>;
    const feedback = grading.feedback_content as Record<string, unknown>;
    const deductions = Array.isArray(grading.deduction_details)
      ? grading.deduction_details.filter(isRecord).map((deduction) => ({
          reason: optionalString(deduction.reason),
          deduction_percentage: optionalNumber(deduction.deduction_percentage),
          advice: optionalString(deduction.advice),
        }))
      : undefined;

    const strictness = item.strictness === 'lenient' || item.strictness === 'strict'
      ? item.strictness
      : item.strictness === 'standard'
        ? 'standard'
        : undefined;

    return {
      label: typeof item.label === 'string' ? item.label : '',
      status: optionalString(item.status),
      strictness,
      result: {
        grading_result: {
          score: grading.score as number,
          recognized_text: optionalString(grading.recognized_text),
          recognized_text_full: optionalString(grading.recognized_text_full),
          deduction_details: deductions,
          feedback_content: {
            good_point: optionalString(feedback.good_point),
            improvement_advice: optionalString(feedback.improvement_advice),
            rewrite_example: optionalString(feedback.rewrite_example),
          },
        },
      },
    };
  });
}

const isOcrSnapshot = (value: unknown): value is TutorialOcrSnapshot => {
  if (!isRecord(value) || !isRecord(value.results) || !isRecord(value.confirmedTexts)) return false;
  return Object.values(value.results).every((entry) =>
    isRecord(entry) && typeof entry.text === 'string' &&
    typeof entry.charCount === 'number' && Number.isFinite(entry.charCount)
  ) && Object.values(value.confirmedTexts).every((text) => typeof text === 'string');
};

export function parseTutorialState(raw: string | null): TutorialStoredState | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1 || !STEPS.includes(value.step as TutorialStep)) return null;
    if (typeof value.paused !== 'boolean' || typeof value.completed !== 'boolean') return null;
    if (value.ocr !== undefined && !isOcrSnapshot(value.ocr)) return null;
    if (value.ocr !== undefined) {
      const ocr = value.ocr as TutorialOcrSnapshot;
      if (Object.keys(ocr.results).length !== 1 || Object.keys(ocr.confirmedTexts).length !== 1 ||
          !(TUTORIAL_SAMPLE_LABEL in ocr.results) || !(TUTORIAL_SAMPLE_LABEL in ocr.confirmedTexts)) return null;
    }
    if (value.grade !== undefined) {
      if (!isRecord(value.grade) || !Array.isArray(value.grade.results) ||
          value.grade.results.length === 0 || !value.grade.results.every(isValidGradeResult)) return null;
      if (value.grade.results.some((result) => (result as Record<string, unknown>).label !== TUTORIAL_SAMPLE_LABEL)) return null;
    }
    const step = value.step as TutorialStep;
    if (value.completed !== (step === 'complete')) return null;
    if (step === 'confirm' && value.ocr === undefined) return null;
    if (['score', 'deductions', 'rewrite', 'complete'].includes(step) && value.grade === undefined) return null;
    return value as TutorialStoredState;
  } catch {
    return null;
  }
}

export function tutorialStorageKey(userId: string): string {
  return `${TUTORIAL_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

export function nextTutorialStep(step: TutorialStep): TutorialStep {
  const index = STEPS.indexOf(step);
  return index < 0 || index === STEPS.length - 1 ? 'complete' : STEPS[index + 1];
}

export function deriveTrialUsage({
  usageCount,
  usageLimit,
  remainingCount,
  fallbackLimit = 5,
}: {
  usageCount: number | null | undefined;
  usageLimit: number | null | undefined;
  remainingCount: number | null | undefined;
  fallbackLimit?: number | null;
}): { count: number; limit: number; remaining: number } {
  const safeFallback = typeof fallbackLimit === 'number' && fallbackLimit > 0 ? fallbackLimit : 5;
  const limit = usageLimit ?? (
    usageCount !== null && usageCount !== undefined && remainingCount !== null && remainingCount !== undefined
      ? usageCount + remainingCount
      : safeFallback
  );
  const count = usageCount ?? Math.max(0, limit - (remainingCount ?? 0));
  return {
    count,
    limit,
    remaining: remainingCount ?? Math.max(0, limit - count),
  };
}
