/**
 * 解答用紙構造分析テスト
 *
 * 新しいAgentic Vision解答用紙分析プロンプトをテスト
 *
 * 使用方法:
 *   cd web && npx tsx src/scripts/test-answer-sheet-analysis.ts <画像パス>
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// .env.local を最初に読み込み（importより前に実行される必要がある）
config({ path: path.join(__dirname, '../../.env.local') });

// 環境変数を直接設定（CONFIGが初期化される前に）
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY が設定されていません。.env.local を確認してください。');
  process.exit(1);
}

import {
  AgenticVisionPreprocessor,
  buildAnswerSheetHints,
  type PreprocessResult,
} from '../lib/core/agenticVision';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
使用方法:
  cd web && npx tsx src/scripts/test-answer-sheet-analysis.ts <画像パス>

例:
  cd web && npx tsx src/scripts/test-answer-sheet-analysis.ts ../images/real_student_answer.png
`);
    process.exit(0);
  }

  const imagePath = args[0];
  const absolutePath = path.resolve(imagePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`画像ファイルが見つかりません: ${absolutePath}`);
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  解答用紙構造分析テスト');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`画像: ${imagePath}`);
  console.log('');

  // 画像を読み込み
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

  // Agentic Vision Preprocessor でテスト
  console.log('🔍 Agentic Vision 解答用紙分析を開始...');
  console.log('');

  const preprocessor = new AgenticVisionPreprocessor();

  try {
    const result = await preprocessor.analyze(base64, mimeType);

    if (!result) {
      console.log('❌ 分析に失敗しました（null が返されました）');
      process.exit(1);
    }

    printResult(result);

    // 結果をJSONファイルに保存
    const outputPath = path.join(__dirname, 'answer-sheet-analysis-result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`\n📁 詳細結果を保存: ${outputPath}`);

  } catch (error) {
    console.error('❌ エラー:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function printResult(result: PreprocessResult): void {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  分析結果');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // 成功/失敗
  if (!result.success) {
    console.log(`❌ 分析失敗: ${result.error}`);
    return;
  }

  console.log(`✅ 分析成功（${result.processingTimeMs}ms）`);
  console.log('');

  // 解答用紙タイプ
  const answerSheet = result.layout.answerSheet;
  if (answerSheet) {
    console.log('【解答用紙タイプ】');
    const typeNames: Record<string, string> = {
      grid: 'マス目（原稿用紙）',
      lined: '罫線（行）',
      blank: '空欄（自由記述）',
    };
    console.log(`  種類: ${typeNames[answerSheet.sheetType] || answerSheet.sheetType}`);
    console.log(`  確信度: ${(answerSheet.confidence * 100).toFixed(0)}%`);
    console.log('');

    // マス目の詳細
    if (answerSheet.sheetType === 'grid' && answerSheet.grid) {
      const g = answerSheet.grid;
      console.log('【マス目の詳細】');
      console.log(`  書字方向: ${g.direction === 'vertical' ? '縦書き' : '横書き'}`);
      console.log(`  構造: ${g.columns}列 × ${g.rows}行 = ${g.totalCells}マス`);
      console.log(`  埋まっているマス: 約${g.filledCells}文字`);
      console.log('');

      if (g.lineHints.length > 0) {
        console.log('【各行の先頭・末尾文字】');
        for (const hint of g.lineHints) {
          if (hint.isEmpty) {
            console.log(`  ${hint.lineNumber}行目: （空行）`);
          } else {
            const first = hint.firstChar || '?';
            const last = hint.lastChar || '?';
            console.log(`  ${hint.lineNumber}行目: 「${first}」...「${last}」`);
          }
        }
        console.log('');
      }
    }

    // 罫線の詳細
    if (answerSheet.sheetType === 'lined' && answerSheet.lined) {
      const l = answerSheet.lined;
      console.log('【罫線の詳細】');
      console.log(`  総行数: ${l.totalLines}行`);
      console.log(`  文字がある行: ${l.filledLines}行`);
      console.log('');

      if (l.lineHints.length > 0) {
        console.log('【各行の先頭・末尾文字】');
        for (const hint of l.lineHints) {
          if (hint.isEmpty) {
            console.log(`  ${hint.lineNumber}行目: （空行）`);
          } else {
            const first = hint.firstChar || '?';
            const last = hint.lastChar || '?';
            console.log(`  ${hint.lineNumber}行目: 「${first}」...「${last}」（約${hint.estimatedCharCount}文字）`);
          }
        }
        console.log('');
      }
    }

    // 空欄の詳細
    if (answerSheet.sheetType === 'blank' && answerSheet.blank) {
      const b = answerSheet.blank;
      console.log('【空欄の詳細】');
      console.log(`  推定文字数: 約${b.estimatedCharCount}文字`);
      console.log(`  推定行数: 約${b.estimatedLines}行`);
      if (b.firstFewChars) console.log(`  先頭: 「${b.firstFewChars}...」`);
      if (b.lastFewChars) console.log(`  末尾: 「...${b.lastFewChars}」`);
      console.log('');
    }

    // OCRプロンプト用ヒント文字列を生成
    console.log('【OCRプロンプト用ヒント】');
    console.log('─'.repeat(50));
    console.log(buildAnswerSheetHints(answerSheet));
    console.log('─'.repeat(50));
    console.log('');
  }

  // 品質情報
  console.log('【画像品質】');
  console.log(`  総合スコア: ${result.quality.overallScore}/100`);
  console.log(`  ぼやけ度: ${(result.quality.blur * 100).toFixed(0)}%`);
  console.log(`  明るさ: ${(result.quality.brightness * 100).toFixed(0)}%`);
  console.log(`  コントラスト: ${(result.quality.contrast * 100).toFixed(0)}%`);
  if (Math.abs(result.quality.tiltDegrees) > 0.5) {
    console.log(`  傾き: ${result.quality.tiltDegrees.toFixed(1)}°`);
  }
  console.log('');

  // 難読箇所
  if (result.hints.lowConfidenceRegions.length > 0) {
    console.log('【難読箇所】');
    for (const [i, region] of result.hints.lowConfidenceRegions.entries()) {
      console.log(`  ${i + 1}. ${region.description}`);
      console.log(`     → ${region.suggestion}`);
    }
    console.log('');
  }

  // 再撮影推奨
  if (result.retakeRecommended) {
    console.log('⚠️ 【再撮影推奨】');
    console.log(`  理由: ${result.retakeReason}`);
    console.log('');
  }
}

main();
