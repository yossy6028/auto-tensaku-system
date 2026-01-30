/**
 * ヒント付きOCR比較テスト
 *
 * 解答用紙構造分析の結果を使って、OCR精度の向上を検証
 *
 * 使用方法:
 *   cd web && DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config src/scripts/compare-ocr-with-hints.ts <画像パス>
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';
import {
  AgenticVisionPreprocessor,
  buildAnswerSheetHints,
  type PreprocessResult,
} from '../lib/core/agenticVision';

const OCR_MODEL = 'gemini-3-pro-preview';

// 標準OCRプロンプト（問九用）
const STANDARD_OCR_PROMPT = `
この画像に含まれる「問九」の手書き日本語テキストを正確に読み取ってください。

【指示】
- 縦書きの原稿用紙です
- 1文字ずつ正確に読み取る
- 読み取れない文字は [?] で示す
- 改行は元の配置を尊重する

【出力】
読み取ったテキストのみを出力してください。
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
使用方法:
  cd web && DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config src/scripts/compare-ocr-with-hints.ts <画像パス>
`);
    process.exit(0);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY が設定されていません');
    process.exit(1);
  }

  const imagePath = args[0];
  const absolutePath = path.resolve(imagePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`画像ファイルが見つかりません: ${absolutePath}`);
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ヒント付きOCR比較テスト');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`画像: ${imagePath}`);
  console.log('');

  // 画像を読み込み
  const buffer = fs.readFileSync(absolutePath);
  const base64 = buffer.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const genai = new GoogleGenAI({ apiKey });

  // Step 1: Agentic Vision 解答用紙分析
  console.log('🔍 Step 1: Agentic Vision 解答用紙分析...');
  const preprocessor = new AgenticVisionPreprocessor();
  const analysisResult = await preprocessor.analyze(base64, mimeType);

  if (!analysisResult?.success || !analysisResult.layout.answerSheet) {
    console.log('⚠️ 解答用紙分析に失敗。標準OCRのみ実行します。');
  } else {
    console.log(`   ✅ 分析完了（${analysisResult.processingTimeMs}ms）`);
    console.log(`   タイプ: ${analysisResult.layout.answerSheet.sheetType}`);
    if (analysisResult.layout.answerSheet.grid) {
      const g = analysisResult.layout.answerSheet.grid;
      console.log(`   構造: ${g.columns}列 × ${g.rows}行, ${g.filledCells}文字`);
    }
  }
  console.log('');

  // Step 2: 標準OCR
  console.log('📝 Step 2: 標準OCR...');
  const standardStart = Date.now();
  const standardResponse = await genai.models.generateContent({
    model: OCR_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: STANDARD_OCR_PROMPT }
        ]
      }
    ],
    config: { temperature: 0, topP: 0.1 }
  });
  const standardOcrTime = Date.now() - standardStart;
  const standardOcrText = standardResponse.text || '';
  console.log(`   ✅ 完了（${standardOcrTime}ms）`);
  console.log(`   文字数: ${standardOcrText.replace(/\s/g, '').length}`);
  console.log('');

  // Step 3: ヒント付きOCR
  console.log('📝 Step 3: ヒント付きOCR...');
  let hintsPrompt = '';
  if (analysisResult?.success && analysisResult.layout.answerSheet) {
    hintsPrompt = buildAnswerSheetHints(analysisResult.layout.answerSheet);
  }

  const enhancedPrompt = hintsPrompt + '\n\n' + STANDARD_OCR_PROMPT;

  const enhancedStart = Date.now();
  const enhancedResponse = await genai.models.generateContent({
    model: OCR_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: enhancedPrompt }
        ]
      }
    ],
    config: { temperature: 0, topP: 0.1 }
  });
  const enhancedOcrTime = Date.now() - enhancedStart;
  const enhancedOcrText = enhancedResponse.text || '';
  console.log(`   ✅ 完了（${enhancedOcrTime}ms）`);
  console.log(`   文字数: ${enhancedOcrText.replace(/\s/g, '').length}`);
  console.log('');

  // 結果比較
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  結果比較');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  const standardCharCount = standardOcrText.replace(/\s/g, '').length;
  const enhancedCharCount = enhancedOcrText.replace(/\s/g, '').length;
  const agenticVisionTime = analysisResult?.processingTimeMs || 0;

  console.log('【処理時間】');
  console.log(`  標準OCR:           ${standardOcrTime}ms`);
  console.log(`  Agentic Vision:    ${agenticVisionTime}ms`);
  console.log(`  ヒント付きOCR:     ${enhancedOcrTime}ms`);
  console.log(`  ─────────────────────────────`);
  console.log(`  標準合計:          ${standardOcrTime}ms`);
  console.log(`  ヒント付き合計:    ${agenticVisionTime + enhancedOcrTime}ms`);
  console.log('');

  console.log('【文字数】');
  console.log(`  標準OCR:     ${standardCharCount}文字`);
  console.log(`  ヒント付き:  ${enhancedCharCount}文字 (${enhancedCharCount - standardCharCount >= 0 ? '+' : ''}${enhancedCharCount - standardCharCount})`);
  console.log('');

  console.log('【標準OCR結果】');
  console.log('─'.repeat(50));
  console.log(standardOcrText || '(テキストなし)');
  console.log('─'.repeat(50));
  console.log('');

  console.log('【ヒント付きOCR結果】');
  console.log('─'.repeat(50));
  console.log(enhancedOcrText || '(テキストなし)');
  console.log('─'.repeat(50));
  console.log('');

  // 差分チェック
  if (standardOcrText !== enhancedOcrText) {
    console.log('⚡ OCR結果に差異があります！');

    // 先頭・末尾の一致チェック
    if (analysisResult?.layout.answerSheet?.grid?.lineHints) {
      const hints = analysisResult.layout.answerSheet.grid.lineHints;
      console.log('');
      console.log('【先頭・末尾文字の照合】');
      for (const hint of hints) {
        const line = hint.lineNumber;
        const first = hint.firstChar;
        const last = hint.lastChar;

        const standardHasFirst = first && standardOcrText.includes(first);
        const enhancedHasFirst = first && enhancedOcrText.includes(first);
        const standardHasLast = last && standardOcrText.includes(last);
        const enhancedHasLast = last && enhancedOcrText.includes(last);

        console.log(`  ${line}行目 先頭「${first}」: 標準=${standardHasFirst ? '✅' : '❌'} ヒント付き=${enhancedHasFirst ? '✅' : '❌'}`);
        console.log(`  ${line}行目 末尾「${last}」: 標準=${standardHasLast ? '✅' : '❌'} ヒント付き=${enhancedHasLast ? '✅' : '❌'}`);
      }
    }
  } else {
    console.log('✓ OCR結果は同一です');
  }

  // 結果をJSONで保存
  const result = {
    image: imagePath,
    timestamp: new Date().toISOString(),
    agenticVision: {
      success: analysisResult?.success || false,
      processingTimeMs: agenticVisionTime,
      answerSheet: analysisResult?.layout.answerSheet || null,
    },
    standardOcr: {
      text: standardOcrText,
      charCount: standardCharCount,
      processingTimeMs: standardOcrTime,
    },
    enhancedOcr: {
      text: enhancedOcrText,
      charCount: enhancedCharCount,
      processingTimeMs: enhancedOcrTime,
      hintsUsed: hintsPrompt,
    },
    comparison: {
      charDifference: enhancedCharCount - standardCharCount,
      totalTimeDifference: (agenticVisionTime + enhancedOcrTime) - standardOcrTime,
      textDifferent: standardOcrText !== enhancedOcrText,
    },
  };

  const outputPath = path.join(__dirname, 'ocr-comparison-result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n📁 詳細結果を保存: ${outputPath}`);
}

main().catch(console.error);
