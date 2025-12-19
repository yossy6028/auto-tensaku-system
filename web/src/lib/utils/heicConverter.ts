/**
 * HEIC画像変換ユーティリティ
 *
 * iPhoneで撮影したHEIC形式の画像をJPEGに変換します。
 * Gemini APIはドキュメント上はHEICをサポートしていますが、
 * 実際には不安定なため、JPEGに変換してから送信します。
 *
 * @see https://discuss.ai.google.dev/t/heic-image-supported-or-not-docs-say-yes-but-they-dont-work/55146
 */

// HEIC変換のタイムアウト（ミリ秒）
const HEIC_CONVERSION_TIMEOUT_MS = 10000; // 10秒

/**
 * ファイルがHEIC形式かどうかを判定
 */
export function isHeicFile(file: File): boolean {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    return (
        type === 'image/heic' ||
        type === 'image/heif' ||
        name.endsWith('.heic') ||
        name.endsWith('.heif')
    );
}

/**
 * 動的にheic2anyをインポート（クライアントサイドのみ）
 */
async function loadHeic2Any(): Promise<typeof import('heic2any').default | null> {
    if (typeof window === 'undefined') {
        console.warn('[HEIC] Server-side environment detected, skipping heic2any');
        return null;
    }

    try {
        const heic2any = (await import('heic2any')).default;
        return heic2any;
    } catch (error) {
        console.error('[HEIC] Failed to load heic2any:', error);
        return null;
    }
}

/**
 * タイムアウト付きPromise
 */
function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeoutMs);

        promise
            .then((result) => {
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

/**
 * HEIC画像をJPEGに変換
 *
 * @param file HEIC形式のファイル
 * @param quality JPEG品質（0.0-1.0）
 * @returns 変換後のJPEGファイル、または変換失敗時はnull
 */
export async function convertHeicToJpeg(
    file: File,
    quality: number = 0.85
): Promise<File | null> {
    if (!isHeicFile(file)) {
        return file;
    }

    console.log(`[HEIC] Converting: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    const heic2any = await loadHeic2Any();
    if (!heic2any) {
        console.warn('[HEIC] heic2any not available, returning original file');
        return null;
    }

    try {
        const result = await withTimeout(
            heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: quality,
            }),
            HEIC_CONVERSION_TIMEOUT_MS,
            `HEIC変換がタイムアウトしました（${HEIC_CONVERSION_TIMEOUT_MS / 1000}秒）`
        );

        // heic2anyはBlobまたはBlob[]を返す
        const jpegBlob = Array.isArray(result) ? result[0] : result;

        if (!jpegBlob) {
            console.error('[HEIC] Conversion returned empty result');
            return null;
        }

        // ファイル名を.jpegに変更
        const newName = file.name.replace(/\.(heic|heif)$/i, '.jpeg');
        const convertedFile = new File([jpegBlob], newName, { type: 'image/jpeg' });

        const originalSizeMB = file.size / 1024 / 1024;
        const convertedSizeMB = convertedFile.size / 1024 / 1024;

        console.log(`[HEIC] Converted: ${file.name} → ${newName} (${originalSizeMB.toFixed(2)}MB → ${convertedSizeMB.toFixed(2)}MB)`);

        return convertedFile;
    } catch (error) {
        console.error(`[HEIC] Conversion failed for ${file.name}:`, error);
        return null;
    }
}

/**
 * 複数のHEICファイルをJPEGに変換
 *
 * @param files ファイル配列
 * @param onProgress 進捗コールバック
 * @returns 変換後のファイル配列（HEICでないファイルはそのまま、変換失敗はnullで除外されない）
 */
export async function convertHeicFiles(
    files: File[],
    onProgress?: (progress: number, currentFile: string, status: 'converting' | 'done' | 'error') => void
): Promise<{ files: File[]; failedCount: number; convertedCount: number }> {
    const results: File[] = [];
    let failedCount = 0;
    let convertedCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = Math.round(((i + 1) / files.length) * 100);

        if (isHeicFile(file)) {
            if (onProgress) {
                onProgress(progress, file.name, 'converting');
            }

            const converted = await convertHeicToJpeg(file);

            if (converted) {
                results.push(converted);
                convertedCount++;
                if (onProgress) {
                    onProgress(progress, file.name, 'done');
                }
            } else {
                // 変換失敗時は元のファイルを保持（サーバー側で再試行）
                results.push(file);
                failedCount++;
                if (onProgress) {
                    onProgress(progress, file.name, 'error');
                }
            }
        } else {
            results.push(file);
        }
    }

    console.log(`[HEIC] Batch conversion complete: ${convertedCount} converted, ${failedCount} failed`);

    return { files: results, failedCount, convertedCount };
}

/**
 * ファイル配列にHEICファイルが含まれているかチェック
 */
export function hasHeicFiles(files: File[]): boolean {
    return files.some(isHeicFile);
}
