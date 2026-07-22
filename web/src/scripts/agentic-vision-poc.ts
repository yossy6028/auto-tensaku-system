/**
 * Agentic Vision PoC スクリプト
 *
 * Gemini 3.6 Flash + Code Execution を使用して、
 * 日本語手書き答案画像の前処理が有効かを検証する。
 *
 * 使用方法:
 *   cd web && npx tsx ../poc/agentic-vision-poc.ts <画像パス>
 *
 * 環境変数:
 *   GEMINI_API_KEY: Gemini API キー（.env.local から自動読み込み）
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// .env.local を読み込み
config({ path: path.join(__dirname, '../../.env.local') });

// ========================================
// 設定
// ========================================

const AGENTIC_VISION_MODEL = process.env.AGENTIC_VISION_MODEL || process.env.MODEL_NAME || 'gemini-3.6-flash';
const STANDARD_OCR_MODEL = process.env.OCR_MODEL_NAME || process.env.MODEL_NAME || 'gemini-3.6-flash';

// ========================================
// 型定義
// ========================================

interface QualityMetrics {
  blur: number;           // 0-1 (0=クリア, 1=ぼやけ)
  brightness: number;     // 0-1 (0=暗い, 1=明るい)
  contrast: number;       // 0-1 (0=低, 1=高)
  tiltDegrees: number;    // 傾き角度
  overallScore: number;   // 総合スコア 0-100
}

interface LayoutInfo {
  type: 'vertical' | 'horizontal' | 'grid' | 'mixed' | 'unknown';
  estimatedLines: number;
  hasMultipleColumns: boolean;
}

interface LowConfidenceRegion {
  description: string;
  suggestion: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface AgenticVisionResult {
  success: boolean;
  quality: QualityMetrics;
  layout: LayoutInfo;
  lowConfidenceRegions: LowConfidenceRegion[];
  retakeRecommended: boolean;
  retakeReason: string | null;
  processingTimeMs: number;
  rawResponse?: string;
  error?: string;
}

interface OcrResult {
  text: string;
  processingTimeMs: number;
  model: string;
}

interface ComparisonResult {
  agenticVision: AgenticVisionResult;
  standardOcr: OcrResult;
  enhancedOcr: OcrResult;
  improvement: {
    characterDifference: number;
    qualityInsights: string[];
  };
}

// ========================================
// Agentic Vision プロンプト
// ========================================

const AGENTIC_VISION_PROMPT = `
あなたは手書き日本語答案の画像分析エキスパートです。
この画像を分析し、OCR処理の前処理として有用な情報を抽出してください。

## 実行するタスク

### タスク1: 画像品質評価
Pythonコードを実行して以下を計測してください：

\`\`\`python
import numpy as np
from PIL import Image
import io

# 画像をグレースケールで読み込み（ここでは仮のデータとして分析）
# 実際の画像データは内部的に処理されます

# ぼやけ度の推定（エッジの鮮明さから）
# Laplacian varianceの代替として、コントラスト比から推定
def estimate_blur(description: str) -> float:
    """画像の説明からぼやけ度を推定（0=クリア, 1=ぼやけ）"""
    # 視覚的な分析に基づいて0-1のスコアを返す
    return 0.0  # 実際の分析結果に置き換え

# 明るさの推定
def estimate_brightness(description: str) -> float:
    """画像の説明から明るさを推定（0=暗い, 1=明るい）"""
    return 0.5  # 実際の分析結果に置き換え

# コントラストの推定
def estimate_contrast(description: str) -> float:
    """画像の説明からコントラストを推定（0=低, 1=高）"""
    return 0.5  # 実際の分析結果に置き換え

print("画像品質分析完了")
\`\`\`

### タスク2: レイアウト分析
- 文字の配置方向（縦書き/横書き）
- 推定行数
- 複数列があるかどうか
- 解答欄の構造

### タスク3: 難読箇所の特定
- 読み取りが困難そうな箇所を特定
- その箇所の推定内容（漢字/ひらがな/数字など）
- 文脈から推測される語彙

### タスク4: 再撮影の必要性判断
- 画像品質が著しく低い場合は再撮影を推奨

## 出力形式

必ず以下のJSON形式で結果を返してください。コードブロックは使用せず、JSONのみを出力してください：

{
  "quality": {
    "blur": 0.0から1.0の数値,
    "brightness": 0.0から1.0の数値,
    "contrast": 0.0から1.0の数値,
    "tiltDegrees": 傾き角度（度）,
    "overallScore": 0から100の総合スコア
  },
  "layout": {
    "type": "vertical" または "horizontal" または "grid" または "mixed" または "unknown",
    "estimatedLines": 推定行数,
    "hasMultipleColumns": true または false
  },
  "lowConfidenceRegions": [
    {
      "description": "箇所の説明",
      "suggestion": "推定される内容や注意点"
    }
  ],
  "retakeRecommended": true または false,
  "retakeReason": "再撮影理由（不要ならnull）"
}
`;

const STANDARD_OCR_PROMPT = `
この画像に含まれる手書きの日本語テキストを正確に読み取ってください。

## 指示
- 手書き文字を可能な限り正確に読み取る
- 読み取れない文字は [?] で示す
- 改行は元の配置を尊重する

## 出力
読み取ったテキストのみを出力してください。
`;

const ENHANCED_OCR_PROMPT = (hints: AgenticVisionResult) => `
この画像に含まれる手書きの日本語テキストを正確に読み取ってください。

## 事前分析情報
画像の品質スコア: ${hints.quality.overallScore}/100
レイアウト: ${hints.layout.type === 'vertical' ? '縦書き' : hints.layout.type === 'horizontal' ? '横書き' : hints.layout.type}
推定行数: ${hints.layout.estimatedLines}行

${hints.lowConfidenceRegions.length > 0 ? `
## 注意が必要な箇所
${hints.lowConfidenceRegions.map((r, i) => `${i + 1}. ${r.description} - ${r.suggestion}`).join('\n')}
` : ''}

## 指示
- 上記の事前分析を参考に、手書き文字を正確に読み取る
- 特に「注意が必要な箇所」は慎重に判読する
- 読み取れない文字は [?] で示す
- 改行は元の配置を尊重する

## 出力
読み取ったテキストのみを出力してください。
`;

// ========================================
// メイン処理
// ========================================

class AgenticVisionPoc {
  private genai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY が設定されていません。.env.local を確認してください。');
    }
    this.genai = new GoogleGenAI({ apiKey });
  }

  /**
   * 画像ファイルを読み込んでBase64エンコード
   */
  private loadImage(imagePath: string): { base64: string; mimeType: string } {
    const absolutePath = path.resolve(imagePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`画像ファイルが見つかりません: ${absolutePath}`);
    }

    const buffer = fs.readFileSync(absolutePath);
    const base64 = buffer.toString('base64');

    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const mimeType = mimeTypeMap[ext] || 'image/jpeg';

    return { base64, mimeType };
  }

  /**
   * Agentic Vision による画像分析
   */
  async runAgenticVision(imagePath: string): Promise<AgenticVisionResult> {
    console.log('\n🔍 Agentic Vision 分析を開始...');
    const startTime = Date.now();

    try {
      const { base64, mimeType } = this.loadImage(imagePath);

      const response = await this.genai.models.generateContent({
        model: AGENTIC_VISION_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: AGENTIC_VISION_PROMPT }
            ]
          }
        ],
        config: {
          tools: [{ codeExecution: {} }],  // Code Execution を有効化
        }
      });

      const processingTimeMs = Date.now() - startTime;
      const text = response.text || '';

      console.log(`   処理時間: ${processingTimeMs}ms`);

      // JSONをパース
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('   ⚠️ JSON形式の応答が得られませんでした');
        console.log('   Raw response:', text.substring(0, 500));
        return {
          success: false,
          quality: { blur: 0.5, brightness: 0.5, contrast: 0.5, tiltDegrees: 0, overallScore: 50 },
          layout: { type: 'unknown', estimatedLines: 0, hasMultipleColumns: false },
          lowConfidenceRegions: [],
          retakeRecommended: false,
          retakeReason: null,
          processingTimeMs,
          rawResponse: text,
          error: 'JSON形式の応答が得られませんでした'
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log('   ✅ 分析完了');

      return {
        success: true,
        quality: parsed.quality || { blur: 0.5, brightness: 0.5, contrast: 0.5, tiltDegrees: 0, overallScore: 50 },
        layout: parsed.layout || { type: 'unknown', estimatedLines: 0, hasMultipleColumns: false },
        lowConfidenceRegions: parsed.lowConfidenceRegions || [],
        retakeRecommended: parsed.retakeRecommended || false,
        retakeReason: parsed.retakeReason || null,
        processingTimeMs,
        rawResponse: text
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ エラー: ${errorMessage}`);

      return {
        success: false,
        quality: { blur: 0.5, brightness: 0.5, contrast: 0.5, tiltDegrees: 0, overallScore: 50 },
        layout: { type: 'unknown', estimatedLines: 0, hasMultipleColumns: false },
        lowConfidenceRegions: [],
        retakeRecommended: false,
        retakeReason: null,
        processingTimeMs,
        error: errorMessage
      };
    }
  }

  /**
   * 標準OCR（比較用）
   */
  async runStandardOcr(imagePath: string): Promise<OcrResult> {
    console.log('\n📝 標準OCR を実行...');
    const startTime = Date.now();

    try {
      const { base64, mimeType } = this.loadImage(imagePath);

      const response = await this.genai.models.generateContent({
        model: STANDARD_OCR_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: STANDARD_OCR_PROMPT }
            ]
          }
        ]
      });

      const processingTimeMs = Date.now() - startTime;
      const text = response.text || '';

      console.log(`   処理時間: ${processingTimeMs}ms`);
      console.log(`   文字数: ${text.replace(/\s/g, '').length}`);

      return { text, processingTimeMs, model: STANDARD_OCR_MODEL };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ エラー: ${errorMessage}`);
      return { text: '', processingTimeMs, model: STANDARD_OCR_MODEL };
    }
  }

  /**
   * Agentic Visionのヒントを活用したOCR
   */
  async runEnhancedOcr(imagePath: string, hints: AgenticVisionResult): Promise<OcrResult> {
    console.log('\n📝 ヒント付きOCR を実行...');
    const startTime = Date.now();

    try {
      const { base64, mimeType } = this.loadImage(imagePath);

      const response = await this.genai.models.generateContent({
        model: STANDARD_OCR_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: ENHANCED_OCR_PROMPT(hints) }
            ]
          }
        ]
      });

      const processingTimeMs = Date.now() - startTime;
      const text = response.text || '';

      console.log(`   処理時間: ${processingTimeMs}ms`);
      console.log(`   文字数: ${text.replace(/\s/g, '').length}`);

      return { text, processingTimeMs, model: STANDARD_OCR_MODEL };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ エラー: ${errorMessage}`);
      return { text: '', processingTimeMs, model: STANDARD_OCR_MODEL };
    }
  }

  /**
   * 比較テストを実行
   */
  async runComparison(imagePath: string): Promise<ComparisonResult> {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Agentic Vision PoC - 比較テスト');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`画像: ${imagePath}`);

    // 1. Agentic Vision による事前分析
    const agenticVision = await this.runAgenticVision(imagePath);

    // 2. 標準OCR
    const standardOcr = await this.runStandardOcr(imagePath);

    // 3. ヒント付きOCR
    const enhancedOcr = await this.runEnhancedOcr(imagePath, agenticVision);

    // 比較結果
    const standardCharCount = standardOcr.text.replace(/\s/g, '').length;
    const enhancedCharCount = enhancedOcr.text.replace(/\s/g, '').length;

    const result: ComparisonResult = {
      agenticVision,
      standardOcr,
      enhancedOcr,
      improvement: {
        characterDifference: enhancedCharCount - standardCharCount,
        qualityInsights: []
      }
    };

    // 品質に基づくインサイト
    if (agenticVision.success) {
      if (agenticVision.quality.blur > 0.5) {
        result.improvement.qualityInsights.push('画像がぼやけています');
      }
      if (agenticVision.quality.brightness < 0.3) {
        result.improvement.qualityInsights.push('画像が暗いです');
      }
      if (agenticVision.lowConfidenceRegions.length > 0) {
        result.improvement.qualityInsights.push(`${agenticVision.lowConfidenceRegions.length}箇所の難読領域を検出`);
      }
    }

    return result;
  }

  /**
   * 結果を表示
   */
  printResult(result: ComparisonResult): void {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  結果サマリー');
    console.log('═══════════════════════════════════════════════════════════');

    console.log('\n【Agentic Vision 分析結果】');
    if (result.agenticVision.success) {
      console.log(`  品質スコア: ${result.agenticVision.quality.overallScore}/100`);
      console.log(`  ぼやけ度: ${(result.agenticVision.quality.blur * 100).toFixed(0)}%`);
      console.log(`  明るさ: ${(result.agenticVision.quality.brightness * 100).toFixed(0)}%`);
      console.log(`  レイアウト: ${result.agenticVision.layout.type}`);
      console.log(`  推定行数: ${result.agenticVision.layout.estimatedLines}`);
      console.log(`  難読箇所: ${result.agenticVision.lowConfidenceRegions.length}件`);
      if (result.agenticVision.retakeRecommended) {
        console.log(`  ⚠️ 再撮影推奨: ${result.agenticVision.retakeReason}`);
      }
      console.log(`  処理時間: ${result.agenticVision.processingTimeMs}ms`);
    } else {
      console.log(`  ❌ 分析失敗: ${result.agenticVision.error}`);
    }

    console.log('\n【OCR 比較】');
    console.log('  ┌─────────────┬──────────┬──────────┐');
    console.log('  │    方式     │  文字数  │ 処理時間 │');
    console.log('  ├─────────────┼──────────┼──────────┤');
    console.log(`  │ 標準OCR     │ ${String(result.standardOcr.text.replace(/\s/g, '').length).padStart(6)} │ ${String(result.standardOcr.processingTimeMs + 'ms').padStart(8)} │`);
    console.log(`  │ ヒント付き  │ ${String(result.enhancedOcr.text.replace(/\s/g, '').length).padStart(6)} │ ${String(result.enhancedOcr.processingTimeMs + 'ms').padStart(8)} │`);
    console.log('  └─────────────┴──────────┴──────────┘');

    const totalStandardTime = result.standardOcr.processingTimeMs;
    const totalEnhancedTime = result.agenticVision.processingTimeMs + result.enhancedOcr.processingTimeMs;

    console.log('\n【合計処理時間】');
    console.log(`  標準フロー:      ${totalStandardTime}ms`);
    console.log(`  Agentic Vision:  ${totalEnhancedTime}ms (${((totalEnhancedTime / totalStandardTime) * 100).toFixed(0)}%)`);

    if (result.improvement.qualityInsights.length > 0) {
      console.log('\n【品質インサイト】');
      result.improvement.qualityInsights.forEach(insight => {
        console.log(`  - ${insight}`);
      });
    }

    console.log('\n【標準OCR テキスト】');
    console.log('─'.repeat(50));
    console.log(result.standardOcr.text || '(テキストなし)');
    console.log('─'.repeat(50));

    console.log('\n【ヒント付きOCR テキスト】');
    console.log('─'.repeat(50));
    console.log(result.enhancedOcr.text || '(テキストなし)');
    console.log('─'.repeat(50));

    // 差分がある場合
    if (result.standardOcr.text !== result.enhancedOcr.text) {
      console.log('\n⚡ OCR結果に差異があります！');
    } else {
      console.log('\n✓ OCR結果は同一です');
    }
  }
}

// ========================================
// エントリーポイント
// ========================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
使用方法:
  cd web && npx tsx ../poc/agentic-vision-poc.ts <画像パス>

例:
  cd web && npx tsx ../poc/agentic-vision-poc.ts ../samples/answer1.jpg

オプション:
  --help    このヘルプを表示
`);
    process.exit(0);
  }

  if (args[0] === '--help') {
    console.log(`
Agentic Vision PoC スクリプト

Gemini 3 Flash の Agentic Vision 機能を使用して、
手書き日本語答案の画像分析・OCR改善を検証します。

比較項目:
  1. Agentic Vision による画像品質分析
  2. 標準OCR（従来方式）
  3. ヒント付きOCR（Agentic Visionの分析結果を活用）

環境設定:
  GEMINI_API_KEY を .env.local に設定してください
`);
    process.exit(0);
  }

  const imagePath = args[0];
  const poc = new AgenticVisionPoc();

  try {
    const result = await poc.runComparison(imagePath);
    poc.printResult(result);

    // 結果をJSONファイルに保存
    const outputPath = path.join(__dirname, 'poc-result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`\n📁 詳細結果を保存: ${outputPath}`);

  } catch (error) {
    console.error('エラー:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
