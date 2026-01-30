/**
 * Agentic Vision Preprocessor
 *
 * Gemini 3 Flash の Agentic Vision 機能を使用して、
 * OCR前に画像を分析・前処理するクラス
 */

import { GoogleGenAI } from '@google/genai';
import { CONFIG } from '../../config';
import {
  PreprocessResult,
  AgenticVisionConfig,
  DEFAULT_AGENTIC_VISION_CONFIG,
  EMPTY_PREPROCESS_RESULT,
  QualityMetrics,
  LayoutInfo,
  LowConfidenceRegion,
  AnswerSheetAnalysis,
  GridAnalysis,
  LinedAnalysis,
  BlankAnalysis,
} from './types';
import { ANSWER_SHEET_ANALYSIS_PROMPT } from './prompts';

/**
 * Agentic Vision Preprocessor クラス
 *
 * OCR処理の前に画像を分析し、以下を提供:
 * - 画像品質評価
 * - レイアウト検出
 * - 難読箇所の特定
 * - OCRへのヒント情報
 */
export class AgenticVisionPreprocessor {
  private genai: GoogleGenAI;
  private config: AgenticVisionConfig;

  constructor(config?: Partial<AgenticVisionConfig>) {
    const apiKey = CONFIG.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY が設定されていません');
    }

    this.genai = new GoogleGenAI({ apiKey });
    this.config = { ...DEFAULT_AGENTIC_VISION_CONFIG, ...config };
  }

  /**
   * 画像を分析してOCR前処理情報を取得
   *
   * @param imageBase64 - Base64エンコードされた画像データ
   * @param mimeType - 画像のMIMEタイプ
   * @returns 前処理結果（失敗時はnullを返し、既存フローにフォールバック）
   */
  async analyze(
    imageBase64: string,
    mimeType: string
  ): Promise<PreprocessResult | null> {
    // 無効化されている場合はスキップ
    if (!this.config.enabled) {
      console.log('[AgenticVision] 無効化されているためスキップ');
      return null;
    }

    const startTime = Date.now();
    console.log('[AgenticVision] 画像分析を開始...');

    try {
      const response = await this.callAgenticVisionAPI(imageBase64, mimeType);
      const processingTimeMs = Date.now() - startTime;

      const result = this.parseResponse(response, processingTimeMs);

      // 結果をログ出力
      this.logResult(result);

      return result;
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.warn(`[AgenticVision] 分析失敗（${processingTimeMs}ms）: ${errorMessage}`);
      console.warn('[AgenticVision] 前処理をスキップして既存フローにフォールバック');

      // エラー時はnullを返し、呼び出し元で既存フローを使用
      return null;
    }
  }

  /**
   * 複数の画像を分析（バッチ処理）
   *
   * @param images - 画像データの配列
   * @returns 前処理結果の配列
   */
  async analyzeMultiple(
    images: Array<{ base64: string; mimeType: string }>
  ): Promise<(PreprocessResult | null)[]> {
    // 並列実行（ただしレート制限に注意）
    const results = await Promise.all(
      images.map(img => this.analyze(img.base64, img.mimeType))
    );

    return results;
  }

  /**
   * 画像品質が十分かどうかを判定
   *
   * @param result - 前処理結果
   * @returns 品質が十分ならtrue
   */
  isQualitySufficient(result: PreprocessResult | null): boolean {
    if (!result || !result.success) {
      // 分析できなかった場合は「十分」として既存フローを使用
      return true;
    }

    return result.quality.overallScore >= this.config.qualityThreshold;
  }

  /**
   * 前処理をスキップすべきかどうかを判定
   * （品質が非常に高い場合は前処理不要）
   *
   * @param result - 前処理結果
   * @returns スキップすべきならtrue
   */
  shouldSkipPreprocessing(result: PreprocessResult | null): boolean {
    if (!result || !result.success) {
      return true;  // 分析できなかった場合はスキップ
    }

    return result.quality.overallScore >= this.config.skipThreshold;
  }

  /**
   * Agentic Vision APIを呼び出し
   */
  private async callAgenticVisionAPI(
    imageBase64: string,
    mimeType: string
  ): Promise<string> {
    const response = await this.genai.models.generateContent({
      model: this.config.model,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: ANSWER_SHEET_ANALYSIS_PROMPT }
          ]
        }
      ],
      config: {
        tools: [{ codeExecution: {} }],  // Code Execution を有効化
        temperature: 0,
        topP: 0.1,
      }
    });

    return response.text || '';
  }

  /**
   * APIレスポンスをパース
   */
  private parseResponse(
    responseText: string,
    processingTimeMs: number
  ): PreprocessResult {
    // JSONを抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[AgenticVision] JSON形式の応答が得られませんでした');
      return {
        ...EMPTY_PREPROCESS_RESULT,
        processingTimeMs,
        rawResponse: responseText,
        error: 'JSON形式の応答が得られませんでした',
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      // 必須フィールドの検証と正規化
      const quality = this.normalizeQuality(parsed.quality);
      const answerSheet = this.normalizeAnswerSheet(parsed.answerSheet);
      const layout = this.normalizeLayout(parsed.layout, answerSheet);
      const lowConfidenceRegions = this.normalizeLowConfidenceRegions(
        parsed.lowConfidenceRegions
      );

      // 再撮影推奨の判定
      const retakeRecommended =
        parsed.retakeRecommended === true ||
        quality.overallScore < this.config.qualityThreshold;

      const retakeReason = retakeRecommended
        ? parsed.retakeReason || this.generateRetakeReason(quality)
        : null;

      return {
        success: true,
        quality,
        layout,
        hints: {
          lowConfidenceRegions,
          expectedCharTypes: parsed.expectedCharTypes || [],
          notes: parsed.notes || [],
        },
        retakeRecommended,
        retakeReason,
        processingTimeMs,
        rawResponse: responseText,
      };
    } catch (parseError) {
      console.warn('[AgenticVision] JSONパースエラー:', parseError);
      return {
        ...EMPTY_PREPROCESS_RESULT,
        processingTimeMs,
        rawResponse: responseText,
        error: 'JSONパースエラー',
      };
    }
  }

  /**
   * 品質メトリクスを正規化
   */
  private normalizeQuality(raw: unknown): QualityMetrics {
    const defaults: QualityMetrics = {
      blur: 0.5,
      brightness: 0.5,
      contrast: 0.5,
      tiltDegrees: 0,
      overallScore: 50,
    };

    if (!raw || typeof raw !== 'object') {
      return defaults;
    }

    const q = raw as Record<string, unknown>;

    return {
      blur: this.clamp(Number(q.blur) || 0.5, 0, 1),
      brightness: this.clamp(Number(q.brightness) || 0.5, 0, 1),
      contrast: this.clamp(Number(q.contrast) || 0.5, 0, 1),
      tiltDegrees: Number(q.tiltDegrees) || 0,
      overallScore: this.clamp(Number(q.overallScore) || 50, 0, 100),
    };
  }

  /**
   * 解答用紙分析を正規化
   */
  private normalizeAnswerSheet(raw: unknown): AnswerSheetAnalysis | undefined {
    if (!raw || typeof raw !== 'object') {
      return undefined;
    }

    const a = raw as Record<string, unknown>;
    const sheetType = ['grid', 'lined', 'blank'].includes(String(a.sheetType))
      ? (String(a.sheetType) as 'grid' | 'lined' | 'blank')
      : 'blank';

    const result: AnswerSheetAnalysis = {
      sheetType,
      confidence: this.clamp(Number(a.confidence) || 0.5, 0, 1),
    };

    // マス目の詳細
    if (sheetType === 'grid' && a.grid && typeof a.grid === 'object') {
      const g = a.grid as Record<string, unknown>;
      result.grid = {
        columns: Math.max(0, Number(g.columns) || 0),
        rows: Math.max(0, Number(g.rows) || 0),
        totalCells: Math.max(0, Number(g.totalCells) || 0),
        filledCells: Math.max(0, Number(g.filledCells) || 0),
        direction: g.direction === 'horizontal' ? 'horizontal' : 'vertical',
        lineHints: this.normalizeLineHints(g.lineHints, false),
      };
    }

    // 罫線の詳細
    if (sheetType === 'lined' && a.lined && typeof a.lined === 'object') {
      const l = a.lined as Record<string, unknown>;
      result.lined = {
        totalLines: Math.max(0, Number(l.totalLines) || 0),
        filledLines: Math.max(0, Number(l.filledLines) || 0),
        lineHints: this.normalizeLineHints(l.lineHints, true),
      };
    }

    // 空欄の詳細
    if (sheetType === 'blank' && a.blank && typeof a.blank === 'object') {
      const b = a.blank as Record<string, unknown>;
      result.blank = {
        estimatedCharCount: Math.max(0, Number(b.estimatedCharCount) || 0),
        estimatedLines: Math.max(0, Number(b.estimatedLines) || 0),
        firstFewChars: b.firstFewChars ? String(b.firstFewChars) : null,
        lastFewChars: b.lastFewChars ? String(b.lastFewChars) : null,
      };
    }

    return result;
  }

  /**
   * 行ヒント情報を正規化
   */
  private normalizeLineHints(
    raw: unknown,
    includeCharCount: boolean
  ): Array<{
    lineNumber: number;
    firstChar: string | null;
    lastChar: string | null;
    isEmpty: boolean;
    estimatedCharCount?: number;
  }> {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((h): h is Record<string, unknown> => h && typeof h === 'object')
      .slice(0, 10)  // 最大10行
      .map(h => ({
        lineNumber: Number(h.lineNumber) || 0,
        firstChar: h.firstChar ? String(h.firstChar) : null,
        lastChar: h.lastChar ? String(h.lastChar) : null,
        isEmpty: Boolean(h.isEmpty),
        ...(includeCharCount && { estimatedCharCount: Number(h.estimatedCharCount) || 0 }),
      }));
  }

  /**
   * レイアウト情報を正規化
   */
  private normalizeLayout(raw: unknown, answerSheet?: AnswerSheetAnalysis): LayoutInfo {
    const defaults: LayoutInfo = {
      type: 'unknown',
      estimatedLines: 0,
      hasMultipleColumns: false,
    };

    // answerSheetからレイアウト情報を推論
    if (answerSheet) {
      let type: LayoutInfo['type'] = 'unknown';
      let estimatedLines = 0;

      if (answerSheet.sheetType === 'grid' && answerSheet.grid) {
        type = answerSheet.grid.direction === 'vertical' ? 'vertical' : 'horizontal';
        estimatedLines = answerSheet.grid.columns;
      } else if (answerSheet.sheetType === 'lined' && answerSheet.lined) {
        type = 'horizontal';
        estimatedLines = answerSheet.lined.totalLines;
      } else if (answerSheet.sheetType === 'blank' && answerSheet.blank) {
        type = 'mixed';
        estimatedLines = answerSheet.blank.estimatedLines;
      }

      return {
        type,
        estimatedLines,
        hasMultipleColumns: answerSheet.sheetType === 'grid',
        answerSheet,
      };
    }

    // 従来のパース（互換性のため）
    if (!raw || typeof raw !== 'object') {
      return defaults;
    }

    const l = raw as Record<string, unknown>;

    const validTypes = ['vertical', 'horizontal', 'grid', 'mixed', 'unknown'];
    const type = validTypes.includes(String(l.type))
      ? (String(l.type) as LayoutInfo['type'])
      : 'unknown';

    return {
      type,
      estimatedLines: Math.max(0, Number(l.estimatedLines) || 0),
      hasMultipleColumns: Boolean(l.hasMultipleColumns),
    };
  }

  /**
   * 難読箇所情報を正規化
   */
  private normalizeLowConfidenceRegions(raw: unknown): LowConfidenceRegion[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((r): r is Record<string, unknown> => r && typeof r === 'object')
      .map(r => ({
        description: String(r.description || ''),
        suggestion: String(r.suggestion || ''),
      }))
      .filter(r => r.description.length > 0);
  }

  /**
   * 再撮影理由を生成
   */
  private generateRetakeReason(quality: QualityMetrics): string {
    const reasons: string[] = [];

    if (quality.blur > 0.6) {
      reasons.push('画像がぼやけています');
    }
    if (quality.brightness < 0.3) {
      reasons.push('画像が暗すぎます');
    }
    if (quality.brightness > 0.9) {
      reasons.push('画像が明るすぎます（白飛び）');
    }
    if (quality.contrast < 0.3) {
      reasons.push('コントラストが低く、文字が読み取りにくいです');
    }
    if (Math.abs(quality.tiltDegrees) > 10) {
      reasons.push('画像が傾いています');
    }

    if (reasons.length === 0) {
      reasons.push('画像品質が低いため、再撮影をお勧めします');
    }

    return reasons.join('。');
  }

  /**
   * 結果をログ出力
   */
  private logResult(result: PreprocessResult): void {
    if (!result.success) {
      console.log(`[AgenticVision] 分析失敗: ${result.error}`);
      return;
    }

    console.log(`[AgenticVision] 分析完了（${result.processingTimeMs}ms）`);
    console.log(`  品質スコア: ${result.quality.overallScore}/100`);
    console.log(`  レイアウト: ${result.layout.type}`);
    console.log(`  推定行数: ${result.layout.estimatedLines}`);
    console.log(`  難読箇所: ${result.hints.lowConfidenceRegions.length}件`);

    if (result.retakeRecommended) {
      console.log(`  ⚠️ 再撮影推奨: ${result.retakeReason}`);
    }
  }

  /**
   * 数値を範囲内に制限
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

/**
 * シングルトンインスタンスを取得
 */
let preprocessorInstance: AgenticVisionPreprocessor | null = null;

export function getAgenticVisionPreprocessor(
  config?: Partial<AgenticVisionConfig>
): AgenticVisionPreprocessor {
  if (!preprocessorInstance) {
    preprocessorInstance = new AgenticVisionPreprocessor(config);
  }
  return preprocessorInstance;
}

/**
 * インスタンスをリセット（テスト用）
 */
export function resetAgenticVisionPreprocessor(): void {
  preprocessorInstance = null;
}
