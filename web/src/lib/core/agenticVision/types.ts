/**
 * Agentic Vision 型定義
 *
 * Gemini 3 Flash の Agentic Vision 機能を使用した
 * 画像前処理の入出力型を定義
 */

/**
 * バウンディングボックス（画像内の領域）
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 画像品質メトリクス
 */
export interface QualityMetrics {
  /** ぼやけ度 (0=クリア, 1=ぼやけ) */
  blur: number;
  /** 明るさ (0=暗い, 1=明るい) */
  brightness: number;
  /** コントラスト (0=低, 1=高) */
  contrast: number;
  /** 傾き角度（度） */
  tiltDegrees: number;
  /** 総合スコア (0-100) */
  overallScore: number;
}

/**
 * 解答用紙の種類
 */
export type AnswerSheetType = 'grid' | 'lined' | 'blank';

/**
 * マス目（原稿用紙）の詳細分析
 */
export interface GridAnalysis {
  /** 総列数（縦書きの場合は行数） */
  columns: number;
  /** 総行数（縦書きの場合は1列あたりの文字数） */
  rows: number;
  /** 総マス数 */
  totalCells: number;
  /** 文字が埋まっているマス数（推定） */
  filledCells: number;
  /** 書字方向 */
  direction: 'vertical' | 'horizontal';
  /** 各列/行の先頭文字と末尾文字（読み取れた範囲で） */
  lineHints: Array<{
    lineNumber: number;
    firstChar: string | null;  // 先頭文字（読み取れない場合はnull）
    lastChar: string | null;   // 末尾文字（読み取れない場合はnull）
    isEmpty: boolean;          // 空行かどうか
  }>;
}

/**
 * 行（罫線）の詳細分析
 */
export interface LinedAnalysis {
  /** 総行数 */
  totalLines: number;
  /** 文字が書かれている行数 */
  filledLines: number;
  /** 各行の先頭文字と末尾文字 */
  lineHints: Array<{
    lineNumber: number;
    firstChar: string | null;
    lastChar: string | null;
    estimatedCharCount?: number;  // 推定文字数（オプション）
    isEmpty: boolean;
  }>;
}

/**
 * 空欄（自由記述）の詳細分析
 */
export interface BlankAnalysis {
  /** 推定総文字数 */
  estimatedCharCount: number;
  /** 推定行数 */
  estimatedLines: number;
  /** 先頭の数文字（読み取れた範囲で） */
  firstFewChars: string | null;
  /** 末尾の数文字（読み取れた範囲で） */
  lastFewChars: string | null;
}

/**
 * 解答用紙の構造分析（統合型）
 */
export interface AnswerSheetAnalysis {
  /** 解答用紙の種類 */
  sheetType: AnswerSheetType;
  /** マス目の場合の詳細（sheetType === 'grid' の場合のみ） */
  grid?: GridAnalysis;
  /** 罫線の場合の詳細（sheetType === 'lined' の場合のみ） */
  lined?: LinedAnalysis;
  /** 空欄の場合の詳細（sheetType === 'blank' の場合のみ） */
  blank?: BlankAnalysis;
  /** 信頼度（0-1） */
  confidence: number;
}

/**
 * レイアウト情報
 */
export interface LayoutInfo {
  /** レイアウトタイプ（互換性のため維持） */
  type: 'vertical' | 'horizontal' | 'grid' | 'mixed' | 'unknown';
  /** 推定行数 */
  estimatedLines: number;
  /** 複数列があるか */
  hasMultipleColumns: boolean;
  /** 解答領域のバウンディングボックス（オプション） */
  answerRegions?: BoundingBox[];
  /** 問題領域のバウンディングボックス（オプション） */
  problemRegions?: BoundingBox[];
  /** 解答用紙の構造分析（新規追加） */
  answerSheet?: AnswerSheetAnalysis;
}

/**
 * 難読箇所の情報
 */
export interface LowConfidenceRegion {
  /** 箇所の説明 */
  description: string;
  /** 推定される内容や注意点 */
  suggestion: string;
  /** 領域（オプション） */
  region?: BoundingBox;
  /** 拡大画像のBase64（オプション） */
  zoomedImageBase64?: string;
}

/**
 * OCRへのヒント情報
 */
export interface OcrHints {
  /** 難読箇所のリスト */
  lowConfidenceRegions: LowConfidenceRegion[];
  /** 推定される文字種 */
  expectedCharTypes: ('kanji' | 'hiragana' | 'katakana' | 'number' | 'alphabet')[];
  /** 特記事項 */
  notes: string[];
}

/**
 * 処理済み画像
 */
export interface ProcessedImage {
  /** 画像データ（Base64） */
  base64: string;
  /** MIMEタイプ */
  mimeType: string;
  /** 画像の用途 */
  purpose: 'main' | 'zoomed_region' | 'enhanced';
  /** 元画像での領域（オプション） */
  originalRegion?: BoundingBox;
}

/**
 * Agentic Vision 前処理結果
 */
export interface PreprocessResult {
  /** 処理成功フラグ */
  success: boolean;

  /** 画像品質評価 */
  quality: QualityMetrics;

  /** 検出されたレイアウト */
  layout: LayoutInfo;

  /** OCRへのヒント情報 */
  hints: OcrHints;

  /** 再撮影推奨フラグ */
  retakeRecommended: boolean;

  /** 再撮影理由（推奨時のみ） */
  retakeReason: string | null;

  /** 処理時間（ミリ秒） */
  processingTimeMs: number;

  /** エラーメッセージ（失敗時のみ） */
  error?: string;

  /** 生のAPIレスポンス（デバッグ用） */
  rawResponse?: string;
}

/**
 * Agentic Vision 設定
 */
export interface AgenticVisionConfig {
  /** 使用するモデル */
  model: string;
  /** タイムアウト（ミリ秒） */
  timeoutMs: number;
  /** 有効化フラグ */
  enabled: boolean;
  /** 品質スコア閾値（これ以下で再撮影推奨） */
  qualityThreshold: number;
  /** スキップする最小品質スコア（これ以上は前処理をスキップ） */
  skipThreshold: number;
}

/**
 * デフォルト設定
 */
export const DEFAULT_AGENTIC_VISION_CONFIG: AgenticVisionConfig = {
  model: 'gemini-3-flash-preview',
  timeoutMs: 60_000,  // 60秒
  enabled: true,
  qualityThreshold: 40,  // 40点以下で再撮影推奨
  skipThreshold: 95,     // 95点以上は前処理スキップ
};

/**
 * 空の前処理結果（フォールバック用）
 */
export const EMPTY_PREPROCESS_RESULT: PreprocessResult = {
  success: false,
  quality: {
    blur: 0.5,
    brightness: 0.5,
    contrast: 0.5,
    tiltDegrees: 0,
    overallScore: 50,
  },
  layout: {
    type: 'unknown',
    estimatedLines: 0,
    hasMultipleColumns: false,
  },
  hints: {
    lowConfidenceRegions: [],
    expectedCharTypes: [],
    notes: [],
  },
  retakeRecommended: false,
  retakeReason: null,
  processingTimeMs: 0,
};
