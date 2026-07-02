/**
 * アップロードサイズ上限（grade / ocr APIで共有）
 *
 * ■ なぜこの値か
 *   Vercel Serverless Functions のリクエストペイロード上限は、プランに関係なく
 *   約 4.5MB（4,500,000 バイト相当）。これを超えると関数に到達する前に 413 になる。
 *   FormData の境界文字列やフィールドのオーバーヘッドを見込み、安全マージンを取って
 *   実ファイル合計の上限を 4.3MB に設定する。
 *
 * ■ 二段構えの役割分担
 *   - フロントエンド（grading/page.tsx・imageCompressor）は事前に約 4.2MB まで圧縮し、
 *     サーバー上限よりわずかに低い「予算」で先に弾く（UX向上のための予防線）。
 *   - サーバー（このモジュールを使う各 API ルート）が最終防衛線として 4.3MB で検証する。
 *
 * ※ 以前コード内コメントに「20MB対応」とあったが、Vercel ペイロード上限により
 *   実際には到達不可能で誤りだった。実態に合わせて本モジュールへ一元化した。
 */

/** 単一ファイルの最大サイズ（バイト） */
export const MAX_SINGLE_FILE_SIZE = 4.3 * 1024 * 1024;

/** 全ファイル合計の最大サイズ（バイト） */
export const MAX_TOTAL_SIZE = 4.3 * 1024 * 1024;

/**
 * リクエスト全体（FormData）の最大サイズ（バイト）。
 * Vercel の 4.5MB 上限に対する最終ガード。合計サイズ上限と同値に揃える。
 */
export const MAX_REQUEST_SIZE = 4.3 * 1024 * 1024;

/** アップロード可能なファイル数の上限 */
export const MAX_FILES_COUNT = 10;

/** 人間可読なMB上限（メッセージ用） */
export const MAX_TOTAL_SIZE_MB_LABEL = (MAX_TOTAL_SIZE / 1024 / 1024).toFixed(1);

/**
 * 容量オーバー時のアドバイス文言。PDFは圧縮しづらいので別案内にする。
 */
export function oversizeAdvice(hasPdf: boolean): string {
    return hasPdf
        ? 'PDFは容量オーバーしやすいため、スマホ等で写真を撮ってアップロードすることをおすすめします。または、オンライン圧縮ツール（iLovePDF等）で圧縮してから再度お試しください。'
        : `合計${MAX_TOTAL_SIZE_MB_LABEL}MB以下になるように、ファイルを分割するか、写真の枚数を減らしてください。`;
}
