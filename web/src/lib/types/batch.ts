// Batch processing types for multi-student grading

export type FileRole = 'answer' | 'problem' | 'model' | 'problem_model' | 'answer_problem' | 'all' | 'other';

export type GradingStrictness = 'lenient' | 'standard' | 'strict';

export type StudentStatus = 'pending' | 'processing' | 'success' | 'error';

export type DeductionDetail = {
  reason?: string;
  deduction_percentage?: number;
  advice?: string;
};

export type FeedbackContent = {
  good_point?: string;
  improvement_advice?: string;
  rewrite_example?: string;
};

export type GradingResultPayload = {
  score: number;
  recognized_text?: string;
  recognized_text_full?: string;
  deduction_details?: DeductionDetail[];
  feedback_content: FeedbackContent;
};

export type GradingResponseItem = {
  label: string;
  result?: { grading_result?: GradingResultPayload; incomplete_grading?: boolean };
  error?: string;
  status?: string;
  strictness?: GradingStrictness;
  regradeToken?: string | null;
  regradeRemaining?: number | null;
  regradeMode?: 'new' | 'free' | 'none';
};

export type StudentEntry = {
  id: string;
  name: string;
  files: File[];
  fileRoles: Record<number, FileRole>;
  status: StudentStatus;
  errorMessage?: string;
  results?: GradingResponseItem[];
};

export type BatchState = {
  students: StudentEntry[];
  currentIndex: number;
  isProcessing: boolean;
  completedCount: number;
  successCount: number;
  errorCount: number;
};

export type BatchMode = 'single' | 'batch';

// Helper function to create a new student entry
export const createStudentEntry = (id?: string): StudentEntry => ({
  id: id || crypto.randomUUID(),
  name: '',
  files: [],
  fileRoles: {},
  status: 'pending',
});

// Constants
export const MAX_STUDENTS = 10;
export const MAX_FILES_PER_STUDENT = 5;
export const MIN_FILES_PER_STUDENT = 2;
