/**
 * Agentic Vision モジュール
 *
 * Gemini 3 Flash の Agentic Vision 機能を使用した
 * OCR前処理機能を提供
 */

// 型定義
export type {
  BoundingBox,
  QualityMetrics,
  LayoutInfo,
  LowConfidenceRegion,
  OcrHints,
  ProcessedImage,
  PreprocessResult,
  AgenticVisionConfig,
  AnswerSheetType,
  AnswerSheetAnalysis,
  GridAnalysis,
  LinedAnalysis,
  BlankAnalysis,
} from './types';

export {
  DEFAULT_AGENTIC_VISION_CONFIG,
  EMPTY_PREPROCESS_RESULT,
} from './types';

// Preprocessorクラス
export {
  AgenticVisionPreprocessor,
  getAgenticVisionPreprocessor,
  resetAgenticVisionPreprocessor,
} from './preprocessor';

// プロンプト
export {
  ANSWER_SHEET_ANALYSIS_PROMPT,
  AGENTIC_VISION_ANALYSIS_PROMPT,  // 互換性のため
  QUICK_QUALITY_CHECK_PROMPT,
  buildAnswerSheetHints,
  buildEnhancedOcrPrompt,
} from './prompts';
