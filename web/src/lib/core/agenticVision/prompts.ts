/**
 * Agentic Vision プロンプト定義
 *
 * Gemini 3 Flash の Code Execution を活用した
 * 解答用紙の構造分析用プロンプト
 */

import type { AnswerSheetAnalysis, LayoutInfo, OcrHints } from './types';

/**
 * 解答用紙構造分析用メインプロンプト
 *
 * OCR精度向上のため、以下を事前分析:
 * 1. 解答用紙の種類（マス目/罫線/空欄）
 * 2. マス目の場合：総マス数、埋まっている文字数、各行の先頭・末尾文字
 * 3. 罫線の場合：行数、各行の先頭・末尾文字
 * 4. 空欄の場合：推定文字数、先頭・末尾の数文字
 */
export const ANSWER_SHEET_ANALYSIS_PROMPT = `
あなたは手書き日本語答案の画像分析エキスパートです。
この画像の解答用紙の構造を詳細に分析してください。

## 最重要タスク: 解答用紙の種類を判定

まず、解答用紙の種類を判定してください：

1. **grid（マス目・原稿用紙）**: 1文字ずつ入れるマス目がある
2. **lined（罫線）**: 横線のみで、マス目はない
3. **blank（空欄）**: 罫線もマス目もない自由記述欄

## タスク別の詳細分析

### 【grid（マス目）の場合】

Pythonコードを実行して以下を数えてください：

\`\`\`python
def analyze_grid():
    """
    マス目（原稿用紙）の構造分析
    視覚的に観察して以下を特定してください
    """
    # 縦書きか横書きかを判定
    direction = "vertical"  # または "horizontal"

    # マス目の数を数える
    columns = 0  # 列数（縦書きなら行数に相当）
    rows = 0     # 行数（縦書きなら1列の文字数）

    # 文字が埋まっているマス数を推定
    filled_cells = 0

    # 各列/行の先頭文字と末尾文字を読み取る
    line_hints = []
    # 例: {"lineNumber": 1, "firstChar": "日", "lastChar": "が", "isEmpty": False}

    return {
        "columns": columns,
        "rows": rows,
        "totalCells": columns * rows,
        "filledCells": filled_cells,
        "direction": direction,
        "lineHints": line_hints
    }

result = analyze_grid()
print(f"マス目分析結果: {result}")
\`\`\`

**重要**: 各列/行について、先頭の1文字と末尾の1文字を可能な限り読み取ってください。
これがOCRの精度向上に直結します。

### 【lined（罫線）の場合】

\`\`\`python
def analyze_lined():
    """
    罫線付き解答用紙の構造分析
    """
    total_lines = 0      # 総行数
    filled_lines = 0     # 文字が書かれている行数

    line_hints = []
    # 各行について:
    # - 先頭文字（読み取れなければnull）
    # - 末尾文字（読み取れなければnull）
    # - 推定文字数
    # 例: {"lineNumber": 1, "firstChar": "私", "lastChar": "た", "estimatedCharCount": 25, "isEmpty": False}

    return {
        "totalLines": total_lines,
        "filledLines": filled_lines,
        "lineHints": line_hints
    }

result = analyze_lined()
print(f"罫線分析結果: {result}")
\`\`\`

### 【blank（空欄）の場合】

\`\`\`python
def analyze_blank():
    """
    空欄（自由記述）の構造分析
    """
    return {
        "estimatedCharCount": 0,    # 推定総文字数
        "estimatedLines": 0,        # 推定行数
        "firstFewChars": None,      # 先頭の3〜5文字（読み取れた範囲で）
        "lastFewChars": None        # 末尾の3〜5文字（読み取れた範囲で）
    }

result = analyze_blank()
print(f"空欄分析結果: {result}")
\`\`\`

## 出力形式

必ず以下のJSON形式で結果を返してください。
コードブロックやマークダウンは使用せず、JSONのみを出力してください：

{
  "answerSheet": {
    "sheetType": "grid" または "lined" または "blank",
    "confidence": 0.0から1.0（判定の確信度）,

    "grid": {
      "columns": 列数,
      "rows": 行数,
      "totalCells": 総マス数,
      "filledCells": 埋まっているマス数,
      "direction": "vertical" または "horizontal",
      "lineHints": [
        {"lineNumber": 1, "firstChar": "先頭文字またはnull", "lastChar": "末尾文字またはnull", "isEmpty": false},
        ...最大10行まで
      ]
    },

    "lined": {
      "totalLines": 総行数,
      "filledLines": 文字がある行数,
      "lineHints": [
        {"lineNumber": 1, "firstChar": "先頭文字", "lastChar": "末尾文字", "estimatedCharCount": 推定文字数, "isEmpty": false},
        ...
      ]
    },

    "blank": {
      "estimatedCharCount": 推定文字数,
      "estimatedLines": 推定行数,
      "firstFewChars": "先頭の数文字またはnull",
      "lastFewChars": "末尾の数文字またはnull"
    }
  },

  "quality": {
    "blur": 0.0から1.0,
    "brightness": 0.0から1.0,
    "contrast": 0.0から1.0,
    "tiltDegrees": 傾き角度,
    "overallScore": 0から100
  },

  "lowConfidenceRegions": [
    {"description": "箇所の説明", "suggestion": "注意点"}
  ],

  "retakeRecommended": true または false,
  "retakeReason": "理由またはnull"
}

**注意**:
- sheetTypeに応じて、grid/lined/blankのうち該当するものだけを詳細に記載してください
- lineHintsは最大10行まで。それ以上ある場合は最初の5行と最後の5行を記載
- 文字が読み取れない場合はnullを使用（空文字""ではなく）
`;

/**
 * 品質評価のみの簡易プロンプト（高速化用）
 */
export const QUICK_QUALITY_CHECK_PROMPT = `
この手書き答案画像の品質を簡潔に評価してください。

JSON形式で出力：
{
  "quality": {"blur": 0-1, "brightness": 0-1, "overallScore": 0-100},
  "sheetType": "grid" または "lined" または "blank",
  "retakeRecommended": true/false
}
`;

/**
 * 解答用紙分析結果からOCRプロンプト用のヒント文字列を生成
 */
export function buildAnswerSheetHints(analysis: AnswerSheetAnalysis): string {
  const lines: string[] = [];

  lines.push(`## 事前分析結果（Agentic Vision）`);
  lines.push(``);

  switch (analysis.sheetType) {
    case 'grid': {
      const grid = analysis.grid;
      if (grid) {
        const directionText = grid.direction === 'vertical' ? '縦書き' : '横書き';
        lines.push(`【解答用紙】マス目（原稿用紙）- ${directionText}`);
        lines.push(`- 構造: ${grid.columns}列 × ${grid.rows}行 = ${grid.totalCells}マス`);
        lines.push(`- 埋まっているマス: 約${grid.filledCells}文字`);
        lines.push(``);

        if (grid.lineHints.length > 0) {
          lines.push(`【各行の先頭・末尾文字】（OCR照合用）`);
          for (const hint of grid.lineHints.slice(0, 10)) {
            if (hint.isEmpty) {
              lines.push(`  ${hint.lineNumber}行目: （空行）`);
            } else {
              const first = hint.firstChar || '?';
              const last = hint.lastChar || '?';
              lines.push(`  ${hint.lineNumber}行目: 「${first}」...「${last}」`);
            }
          }
          lines.push(``);
          lines.push(`※上記の先頭・末尾文字と一致するようOCRしてください`);
        }
      }
      break;
    }

    case 'lined': {
      const lined = analysis.lined;
      if (lined) {
        lines.push(`【解答用紙】罫線（行）`);
        lines.push(`- 総行数: ${lined.totalLines}行`);
        lines.push(`- 文字がある行: ${lined.filledLines}行`);
        lines.push(``);

        if (lined.lineHints.length > 0) {
          lines.push(`【各行の先頭・末尾文字】（OCR照合用）`);
          for (const hint of lined.lineHints.slice(0, 10)) {
            if (hint.isEmpty) {
              lines.push(`  ${hint.lineNumber}行目: （空行）`);
            } else {
              const first = hint.firstChar || '?';
              const last = hint.lastChar || '?';
              lines.push(`  ${hint.lineNumber}行目: 「${first}」...「${last}」（約${hint.estimatedCharCount}文字）`);
            }
          }
          lines.push(``);
          lines.push(`※上記の先頭・末尾文字と一致するようOCRしてください`);
        }
      }
      break;
    }

    case 'blank': {
      const blank = analysis.blank;
      if (blank) {
        lines.push(`【解答用紙】空欄（自由記述）`);
        lines.push(`- 推定文字数: 約${blank.estimatedCharCount}文字`);
        lines.push(`- 推定行数: 約${blank.estimatedLines}行`);

        if (blank.firstFewChars) {
          lines.push(`- 先頭: 「${blank.firstFewChars}...」`);
        }
        if (blank.lastFewChars) {
          lines.push(`- 末尾: 「...${blank.lastFewChars}」`);
        }
        lines.push(``);
        lines.push(`※先頭・末尾の文字が一致するようOCRしてください`);
      }
      break;
    }
  }

  return lines.join('\n');
}

/**
 * OCRヒントを活用した強化プロンプトを生成
 */
export function buildEnhancedOcrPrompt(
  basePrompt: string,
  hints: {
    quality: { overallScore: number };
    layout: LayoutInfo;
    lowConfidenceRegions: Array<{ description: string; suggestion: string }>;
    expectedCharTypes?: string[];
    notes?: string[];
  }
): string {
  const sections: string[] = [];

  // 解答用紙の構造分析があれば優先的に使用
  if (hints.layout.answerSheet) {
    sections.push(buildAnswerSheetHints(hints.layout.answerSheet));
  } else {
    // 従来の簡易情報
    sections.push(`## 事前分析情報（Agentic Vision）`);
    sections.push(`画像の品質スコア: ${hints.quality.overallScore}/100`);
    sections.push(`レイアウト: ${hints.layout.type === 'vertical' ? '縦書き' : hints.layout.type === 'horizontal' ? '横書き' : hints.layout.type}`);
    sections.push(`推定行数: ${hints.layout.estimatedLines}行`);
  }

  // 難読箇所の情報を追加
  if (hints.lowConfidenceRegions.length > 0) {
    sections.push(``);
    sections.push(`## 注意が必要な箇所`);
    for (const [i, r] of hints.lowConfidenceRegions.slice(0, 5).entries()) {
      sections.push(`${i + 1}. ${r.description}`);
      sections.push(`   → ${r.suggestion}`);
    }
  }

  // 特記事項を追加
  if (hints.notes && hints.notes.length > 0) {
    sections.push(``);
    sections.push(`## 特記事項`);
    for (const n of hints.notes) {
      sections.push(`- ${n}`);
    }
  }

  // ベースプロンプトの前にヒントを挿入
  return sections.join('\n') + '\n\n' + basePrompt;
}

/**
 * 旧プロンプト（互換性のため維持）
 * @deprecated ANSWER_SHEET_ANALYSIS_PROMPT を使用してください
 */
export const AGENTIC_VISION_ANALYSIS_PROMPT = ANSWER_SHEET_ANALYSIS_PROMPT;
