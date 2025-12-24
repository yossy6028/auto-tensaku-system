/**
 * 画像圧縮ユーティリティ
 *
 * スマホで撮影した大きな画像を自動的に圧縮し、
 * Vercelのペイロード制限（4.5MB）内に収める
 *
 * スマホ対応最優先:
 * - 画像サイズを1000pxに制限（メモリ節約）
 * - 処理間に500msの遅延（GC時間確保）
 * - requestAnimationFrameでUI更新保証
 * - HEIC形式を自動的にJPEGに変換（Gemini API互換性のため）
 */

import { isHeicFile, convertHeicToJpeg } from './heicConverter';

// タイムアウト設定
const IS_MOBILE = typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent);
const PER_FILE_TIMEOUT_MS = 4000;         // 1ファイルあたり最大4秒（短縮）
const MAX_TOTAL_COMPRESSION_MS = 30000;   // 全体で30秒
const INTER_FILE_DELAY_MS = 500;          // ファイル間の遅延（メモリ解放用）★500msに増加
// iOS Safari で createImageBitmap がハングする事例があるためモバイルでは無効化
const CAN_USE_IMAGE_BITMAP = typeof createImageBitmap === 'function' && !IS_MOBILE;
const TOBLOB_TIMEOUT_MS = 1500;

/**
 * 圧縮オプション
 */
export type CompressionOptions = {
    maxSizeMB: number;
    maxWidthOrHeight: number;
    useWebWorker: boolean;
    initialQuality?: number;
};

/**
 * デフォルトの圧縮設定
 * PC/スマホで異なる解像度を使用（OCR精度とメモリのバランス）
 * ★重要: 解像度を下げすぎると手書き文字のOCRが失敗する
 */
export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.4,
    maxWidthOrHeight: IS_MOBILE ? 1400 : 1600,  // スマホ1400px、PC1600px
    useWebWorker: false,
    initialQuality: 0.65,
};

/**
 * 高品質圧縮設定（文字の多い答案向け）
 */
export const HIGH_QUALITY_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.85,
    maxWidthOrHeight: IS_MOBILE ? 1800 : 2560,  // スマホ1800px、PC2560px
    useWebWorker: false,
    initialQuality: 0.85,
};

/**
 * 低品質圧縮設定（ファイル数が多い場合）
 */
export const LOW_QUALITY_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.2,
    maxWidthOrHeight: IS_MOBILE ? 1000 : 1200,  // より積極的に圧縮
    useWebWorker: false,
    initialQuality: 0.5,
};


/**
 * 超低品質圧縮設定（10枚以上の大量ファイル向け）
 */
export const ULTRA_LOW_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.15,
    maxWidthOrHeight: IS_MOBILE ? 800 : 1000,  // 最小限の解像度
    useWebWorker: false,
    initialQuality: 0.4,
};

/**
 * 画像ファイルかどうかを判定
 */
export function isImageFile(file: File): boolean {
    // MIMEタイプでチェック
    if (file.type.startsWith('image/')) {
        return true;
    }
    // MIMEタイプが不正/未設定の場合、拡張子でチェック（スマホHEIC対応）
    const name = file.name.toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif'];
    return imageExtensions.some(ext => name.endsWith(ext));
}

/**
 * PDFファイルかどうかを判定
 */
export function isPdfFile(file: File): boolean {
    return file.type === 'application/pdf';
}

/**
 * 圧縮が必要かどうかを判定
 */
export function needsCompression(file: File, maxSizeMB: number = 0.8): boolean {
    if (!isImageFile(file)) {
        return false;
    }
    return file.size > maxSizeMB * 1024 * 1024;
}

/**
 * 次のアニメーションフレームまで待機（UI更新保証）
 */
function waitForNextFrame(): Promise<void> {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
        });
    });
}

/**
 * 遅延（メモリ解放用）
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Promiseにタイムアウトを設定
 */
async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    onTimeout: () => T | Promise<T>
): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;
    return new Promise<T>((resolve, reject) => {
        timeoutId = setTimeout(async () => {
            try {
                resolve(await onTimeout());
            } catch (err) {
                reject(err);
            }
        }, timeoutMs);

        promise
            .then((result) => {
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch((err) => {
                clearTimeout(timeoutId);
                reject(err);
            });
    });
}

/**
 * DataURLをBlobに変換
 */
function dataURLtoBlob(dataURL: string): Blob {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(parts[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
}

/**
 * 画像を読み込む（タイムアウト付き）
 */
function loadImage(file: File, timeoutMs: number = 3000): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        let settled = false;
        
        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                URL.revokeObjectURL(url);
                reject(new Error('Image load timeout'));
            }
        }, timeoutMs);
        
        img.onload = () => {
            if (!settled) {
                settled = true;
                clearTimeout(timeout);
                URL.revokeObjectURL(url);
                resolve(img);
            }
        };
        
        img.onerror = () => {
            if (!settled) {
                settled = true;
                clearTimeout(timeout);
                URL.revokeObjectURL(url);
                reject(new Error('Image load failed'));
            }
        };
        
        img.src = url;
    });
}

/**
 * canvas.toBlobを優先し、失敗・タイムアウト時はtoDataURLへフォールバック
 * toDataURLは同期で重いため、なるべく避ける
 */
async function canvasToJpegBlob(
    canvas: HTMLCanvasElement,
    quality: number
): Promise<Blob | null> {
    const toBlobPromise = new Promise<Blob | null>((resolve, reject) => {
        if (!canvas.toBlob) {
            resolve(null);
            return;
        }
        canvas.toBlob(
            (blob) => {
                resolve(blob);
            },
            'image/jpeg',
            quality
        );
    });

    try {
        const blob = await withTimeout(
            toBlobPromise,
            TOBLOB_TIMEOUT_MS,
            () => Promise.resolve<Blob | null>(null)
        );
        if (blob) return blob;
        console.warn('[Compress] canvas.toBlob unavailable or returned null');
    } catch (err) {
        console.warn('[Compress] canvas.toBlob failed', err);
    }

    return null;
}

/**
 * createImageBitmapが使える場合はリサイズしながらデコード（メモリ削減）
 * 失敗時は従来のImage + drawImageにフォールバック
 */
async function drawToCanvas(
    file: File,
    width: number,
    height: number,
    timeoutMs: number,
    decodedImage?: HTMLImageElement,
    preDecodedBitmap?: ImageBitmap
): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Canvas context is not available');
    }

    if (preDecodedBitmap) {
        ctx.drawImage(preDecodedBitmap, 0, 0, width, height);
        if (typeof preDecodedBitmap.close === 'function') {
            preDecodedBitmap.close();
        }
        return canvas;
    }

    if (CAN_USE_IMAGE_BITMAP && !decodedImage) {
        try {
            const bitmap = await withTimeout(
                createImageBitmap(file, {
                    resizeWidth: width,
                    resizeHeight: height,
                    resizeQuality: 'high',
                }),
                timeoutMs,
                async () => {
                    throw new Error('createImageBitmap timeout');
                }
            );
            ctx.drawImage(bitmap, 0, 0, width, height);
            if (typeof bitmap.close === 'function') {
                bitmap.close();
            }
            return canvas;
        } catch (err) {
            console.warn(`[Compress] createImageBitmap failed for ${file.name}, fallback to Image`, err);
        }
    }

    const img = decodedImage ?? await loadImage(file, timeoutMs);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
}

/**
 * 単一画像を圧縮（スマホ対応）
 * HEIC形式は先にJPEGに変換してから圧縮
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = DEFAULT_COMPRESSION_OPTIONS,
    onProgress?: (progress: number) => void
): Promise<File> {
    // 画像でない場合はそのまま
    if (!isImageFile(file)) {
        if (onProgress) onProgress(100);
        return file;
    }

    let workingFile = file;

    // HEIC形式の場合は先にJPEGに変換（Gemini API互換性のため必須）
    if (isHeicFile(file)) {
        console.log(`[Compress] HEIC detected: ${file.name}, converting to JPEG first...`);
        if (onProgress) onProgress(5);

        const converted = await convertHeicToJpeg(file, 0.7);
        if (converted) {
            workingFile = converted;
            console.log(`[Compress] HEIC→JPEG conversion successful: ${file.name} → ${converted.name}`);
        } else {
            // 変換失敗時は警告を出すが、元のファイルで続行（サーバー側で再試行）
            console.warn(`[Compress] HEIC conversion failed for ${file.name}, will try server-side conversion`);
        }
    }

    const fileSizeMB = workingFile.size / 1024 / 1024;

    // 小さいファイルはスキップ（ただしHEIC変換後は必ず返す）
    if (fileSizeMB <= options.maxSizeMB && fileSizeMB < 0.15) {
        console.log(`[Compress] Skip compression: ${workingFile.name} (${fileSizeMB.toFixed(2)}MB)`);
        if (onProgress) onProgress(100);
        return workingFile;
    }

    console.log(`[Compress] Start: ${workingFile.name} (${fileSizeMB.toFixed(2)}MB)`);
    if (onProgress) onProgress(10);

    try {
        // UI更新を待つ
        await waitForNextFrame();

        // 画像読み込み（解像度取得用）
        let bitmap: ImageBitmap | null = null;
        let img: HTMLImageElement | null = null;
        let width = 0;
        let height = 0;

        if (CAN_USE_IMAGE_BITMAP) {
            try {
                bitmap = await withTimeout(
                    createImageBitmap(workingFile),
                    PER_FILE_TIMEOUT_MS,
                    async () => {
                        throw new Error('createImageBitmap timeout');
                    }
                );
                width = bitmap.width;
                height = bitmap.height;
            } catch (err) {
                console.warn(`[Compress] createImageBitmap(size) failed for ${workingFile.name}, fallback to Image`, err);
                bitmap = null;
            }
        }

        if (!bitmap) {
            img = await loadImage(workingFile, PER_FILE_TIMEOUT_MS);
            width = img.width;
            height = img.height;
        }

        if (onProgress) onProgress(30);

        // UI更新を待つ
        await waitForNextFrame();

        // リサイズ計算
        const maxDim = options.maxWidthOrHeight;

        if (width > maxDim || height > maxDim) {
            if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
            } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
            }
        }

        if (onProgress) onProgress(50);

        // Canvas描画（createImageBitmapを優先してデコード&リサイズ）
        const canvas = await drawToCanvas(workingFile, width, height, PER_FILE_TIMEOUT_MS, img ?? undefined, bitmap ?? undefined);
        if (onProgress) onProgress(70);

        // UI更新を待つ
        await waitForNextFrame();

        // toBlobを優先（非同期・省メモリ）、失敗時はtoDataURLでフォールバック
        const jpegBlob = await canvasToJpegBlob(canvas, options.initialQuality || 0.7);
        if (onProgress) onProgress(90);

        // メモリ解放
        canvas.width = 0;
        canvas.height = 0;

        if (!jpegBlob) {
            console.warn(`[Compress] Skip toDataURL fallback for ${workingFile.name}, returning working file to avoid UI block`);
            if (onProgress) onProgress(100);
            return workingFile;
        }

        // Blob変換（ファイル名はJPEG拡張子に統一）
        const newName = workingFile.name.replace(/\.(heic|heif)$/i, '.jpeg');
        const compressedFile = new File([jpegBlob], newName, { type: 'image/jpeg' });

        console.log(`[Compress] Done: ${file.name} ${fileSizeMB.toFixed(2)}MB → ${(compressedFile.size/1024/1024).toFixed(2)}MB`);
        if (onProgress) onProgress(100);

        return compressedFile;
    } catch (error) {
        console.warn(`[Compress] Failed: ${file.name}`, error);
        if (onProgress) onProgress(100);
        // 変換失敗時もworkingFile（HEIC変換済みの可能性）を返す
        return workingFile;
    }
}

/**
 * ファイル数に応じて最適な圧縮設定を選択
 */
export function getOptimalCompressionOptions(fileCount: number): CompressionOptions {
    if (fileCount <= 2) return DEFAULT_COMPRESSION_OPTIONS;  // 2枚以下でもデフォルト
    if (fileCount <= 4) return LOW_QUALITY_OPTIONS;          // 3-4枚は低品質
    return ULTRA_LOW_OPTIONS;                                // 5枚以上は超低品質
}

/**
 * 複数ファイルを一括圧縮（スマホ対応）
 */
export async function compressMultipleImages(
    files: File[],
    onProgress?: (progress: number, currentFile: string) => void
): Promise<File[]> {
    const totalFiles = files.length;
    const MAX_TOTAL_SIZE = 4.2 * 1024 * 1024;
    const originalSize = files.reduce((sum, f) => sum + f.size, 0);
    const baseOptions = getOptimalCompressionOptions(totalFiles);
    
    console.log(`[Compress] Batch: ${totalFiles} files, ${(originalSize/1024/1024).toFixed(2)}MB`);
    
    const compressedFiles: File[] = [];
    let currentTotalSize = 0;
    const startTime = Date.now();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = Math.round((i / totalFiles) * 100);
        
        // 進捗更新
        if (onProgress) {
            onProgress(progress, file.name);
        }
        
        // ★重要: 処理前にUI更新とメモリ解放の時間を確保
        await waitForNextFrame();
        if (i > 0) {
            console.log(`[Compress] Waiting ${INTER_FILE_DELAY_MS}ms before file ${i + 1}...`);
            await delay(INTER_FILE_DELAY_MS);
            await waitForNextFrame();
        }

        // 全体タイムアウトチェック
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_TOTAL_COMPRESSION_MS) {
            console.warn(`[Compress] Total timeout at ${i}/${totalFiles}`);
            for (let j = i; j < files.length; j++) {
                compressedFiles.push(files[j]);
            }
            break;
        }

        // 動的オプション調整
        const remainingCount = totalFiles - i;
        const remainingBudget = MAX_TOTAL_SIZE - currentTotalSize;
        const dynamicMaxSizeMB = remainingCount > 0 
            ? Math.min(baseOptions.maxSizeMB, (remainingBudget * 0.7) / (remainingCount * 1024 * 1024))
            : baseOptions.maxSizeMB;
        
        const options = {
            ...baseOptions,
            maxSizeMB: Math.max(0.08, dynamicMaxSizeMB),
        };

        let compressedFile: File;
        try {
            compressedFile = await compressImage(file, options, (p) => {
                if (onProgress) {
                    const overall = Math.round(((i + p / 100) / totalFiles) * 100);
                    onProgress(overall, file.name);
                }
            });
        } catch (err) {
            console.error(`[Compress] Error: ${file.name}`, err);
            compressedFile = file;
        }

        currentTotalSize += compressedFile.size;
        compressedFiles.push(compressedFile);
        console.log(`[Compress] Progress: ${i + 1}/${totalFiles} done (${(currentTotalSize/1024/1024).toFixed(2)}MB total)`);
        
        // サイズ制限チェック
        if (currentTotalSize > MAX_TOTAL_SIZE && i < files.length - 1) {
            console.warn(`[Compress] Size limit reached`);
            for (let j = i + 1; j < files.length; j++) {
                compressedFiles.push(files[j]);
            }
            break;
        }
    }

    if (onProgress) {
        onProgress(100, '完了');
    }

    const compressedSize = compressedFiles.reduce((sum, f) => sum + f.size, 0);
    const reduction = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;
    console.log(`[Compress] Complete: ${(originalSize/1024/1024).toFixed(2)}MB → ${(compressedSize/1024/1024).toFixed(2)}MB (${reduction}%)`);

    return compressedFiles;
}

/**
 * ファイルサイズをフォーマット
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes}B`;
    } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)}KB`;
    } else {
        return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    }
}
