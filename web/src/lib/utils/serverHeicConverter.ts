/**
 * サーバーサイドHEIC変換ユーティリティ
 *
 * クライアント側でHEIC変換が失敗した場合のバックアップとして、
 * sharpライブラリを使用してサーバー側でHEIC→JPEG変換を行います。
 *
 * @see https://discuss.ai.google.dev/t/heic-image-supported-or-not-docs-say-yes-but-they-dont-work/55146
 */

import sharp from 'sharp';

/**
 * MIMEタイプがHEIC/HEIFかどうかを判定
 */
export function isHeicMimeType(mimeType: string): boolean {
    const normalized = mimeType.toLowerCase();
    return normalized === 'image/heic' || normalized === 'image/heif';
}

/**
 * ファイル名がHEIC/HEIF拡張子かどうかを判定
 */
export function hasHeicExtension(fileName: string): boolean {
    const normalized = fileName.toLowerCase();
    return normalized.endsWith('.heic') || normalized.endsWith('.heif');
}

/**
 * HEIC画像をJPEGに変換（サーバーサイド）
 *
 * @param buffer HEIC画像のBufferデータ
 * @param quality JPEG品質（1-100）
 * @param fileName オプションのファイル名（ログ用）
 * @returns 変換後のJPEG Buffer、または変換失敗時はnull
 */
export async function convertHeicBufferToJpeg(
    buffer: Buffer,
    quality: number = 85,
    fileName?: string
): Promise<Buffer | null> {
    const startTime = Date.now();
    const sizeMB = buffer.length / 1024 / 1024;
    const fileLabel = fileName ? ` (${fileName})` : '';

    try {
        console.log(`[ServerHEIC] Starting conversion${fileLabel}: ${sizeMB.toFixed(2)}MB, quality: ${quality}`);

        const jpegBuffer = await sharp(buffer)
            .jpeg({ quality })
            .toBuffer();

        const resultSizeMB = jpegBuffer.length / 1024 / 1024;
        const elapsed = Date.now() - startTime;
        console.log(`[ServerHEIC] ✓ Conversion successful${fileLabel}: ${sizeMB.toFixed(2)}MB → ${resultSizeMB.toFixed(2)}MB in ${elapsed}ms`);

        // Buffer型の互換性を確保するためにBuffer.fromで再ラップ
        return Buffer.from(jpegBuffer);
    } catch (error) {
        const elapsed = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ServerHEIC] ✗ Conversion failed${fileLabel} after ${elapsed}ms: ${errorMessage}`);
        console.error('[ServerHEIC] Full error:', error);
        return null;
    }
}

/**
 * HEIC画像をJPEGに変換し、ファイル情報も更新
 *
 * @param buffer HEIC画像のBufferデータ
 * @param originalName 元のファイル名
 * @param originalMimeType 元のMIMEタイプ
 * @param quality JPEG品質（1-100）
 * @returns 変換後の情報、または変換失敗/不要時はnull
 */
export async function convertHeicFileToJpeg(
    buffer: Buffer,
    originalName: string,
    originalMimeType: string,
    quality: number = 85
): Promise<{ buffer: Buffer; name: string; mimeType: string } | null> {
    // HEICでない場合は変換不要
    if (!isHeicMimeType(originalMimeType) && !hasHeicExtension(originalName)) {
        return null;
    }

    const convertedBuffer = await convertHeicBufferToJpeg(buffer, quality);

    if (!convertedBuffer) {
        return null;
    }

    // ファイル名の拡張子を.jpegに変更
    const newName = originalName.replace(/\.(heic|heif)$/i, '.jpeg');

    return {
        buffer: convertedBuffer,
        name: newName,
        mimeType: 'image/jpeg',
    };
}

/**
 * 複数のファイルをバッチ変換
 * HEICファイルはJPEGに変換し、それ以外はそのまま返す
 */
export async function convertHeicFilesInBatch(
    files: Array<{ buffer: Buffer; name: string; mimeType: string }>
): Promise<Array<{ buffer: Buffer; name: string; mimeType: string; wasConverted: boolean }>> {
    const results: Array<{ buffer: Buffer; name: string; mimeType: string; wasConverted: boolean }> = [];

    for (const file of files) {
        if (isHeicMimeType(file.mimeType) || hasHeicExtension(file.name)) {
            const converted = await convertHeicFileToJpeg(file.buffer, file.name, file.mimeType);

            if (converted) {
                results.push({
                    buffer: converted.buffer,
                    name: converted.name,
                    mimeType: converted.mimeType,
                    wasConverted: true,
                });
            } else {
                // 変換失敗時は元のファイルを保持（エラーログは関数内で出力済み）
                results.push({
                    ...file,
                    wasConverted: false,
                });
            }
        } else {
            results.push({
                ...file,
                wasConverted: false,
            });
        }
    }

    const convertedCount = results.filter(r => r.wasConverted).length;
    if (convertedCount > 0) {
        console.log(`[ServerHEIC] Batch conversion complete: ${convertedCount}/${files.length} files converted`);
    }

    return results;
}
