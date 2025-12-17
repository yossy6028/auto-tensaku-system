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
 */

// タイムアウト設定
const PER_FILE_TIMEOUT_MS = 5000;         // 1ファイルあたり最大5秒
const MAX_TOTAL_COMPRESSION_MS = 30000;   // 全体で30秒
const INTER_FILE_DELAY_MS = 500;          // ファイル間の遅延（メモリ解放用）★500msに増加

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
 * デフォルトの圧縮設定（スマホ対応）
 */
export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1000,      // ★1000pxに縮小（メモリ節約）
    useWebWorker: false,
    initialQuality: 0.7,
};

/**
 * 高品質圧縮設定
 */
export const HIGH_QUALITY_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.7,
    maxWidthOrHeight: 1200,      // ★1200pxに縮小
    useWebWorker: false,
    initialQuality: 0.75,
};

/**
 * 低品質圧縮設定（ファイル数が多い場合）
 */
export const LOW_QUALITY_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 800,       // ★800pxに縮小
    useWebWorker: false,
    initialQuality: 0.5,
};

/**
 * 画像ファイルかどうかを判定
 */
export function isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
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
 * 単一画像を圧縮（スマホ対応）
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

    const fileSizeMB = file.size / 1024 / 1024;
    
    // 小さいファイルはスキップ
    if (fileSizeMB <= options.maxSizeMB && fileSizeMB < 0.5) {
        console.log(`[Compress] Skip: ${file.name} (${fileSizeMB.toFixed(2)}MB)`);
        if (onProgress) onProgress(100);
        return file;
    }

    console.log(`[Compress] Start: ${file.name} (${fileSizeMB.toFixed(2)}MB)`);
    if (onProgress) onProgress(10);

    try {
        // UI更新を待つ
        await waitForNextFrame();
        
        // 画像読み込み
        const img = await loadImage(file, PER_FILE_TIMEOUT_MS);
        if (onProgress) onProgress(30);
        
        // UI更新を待つ
        await waitForNextFrame();
        
        // リサイズ計算
        let { width, height } = img;
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
        
        // Canvas描画
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            console.warn(`[Compress] No canvas context for ${file.name}`);
            if (onProgress) onProgress(100);
            return file;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        if (onProgress) onProgress(70);
        
        // UI更新を待つ
        await waitForNextFrame();
        
        // toDataURL（同期）
        const dataURL = canvas.toDataURL('image/jpeg', options.initialQuality || 0.7);
        if (onProgress) onProgress(90);
        
        // メモリ解放
        canvas.width = 0;
        canvas.height = 0;
        
        // Blob変換
        const blob = dataURLtoBlob(dataURL);
        const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
        
        console.log(`[Compress] Done: ${file.name} ${fileSizeMB.toFixed(2)}MB → ${(compressedFile.size/1024/1024).toFixed(2)}MB`);
        if (onProgress) onProgress(100);
        
        return compressedFile;
    } catch (error) {
        console.warn(`[Compress] Failed: ${file.name}`, error);
        if (onProgress) onProgress(100);
        return file;
    }
}

/**
 * ファイル数に応じて最適な圧縮設定を選択
 */
export function getOptimalCompressionOptions(fileCount: number): CompressionOptions {
    if (fileCount <= 2) return HIGH_QUALITY_OPTIONS;
    if (fileCount <= 5) return DEFAULT_COMPRESSION_OPTIONS;
    return LOW_QUALITY_OPTIONS;
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
