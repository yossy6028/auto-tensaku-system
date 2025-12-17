/**
 * 画像圧縮ユーティリティ
 * 
 * スマホで撮影した大きな画像を自動的に圧縮し、
 * Vercelのペイロード制限（4.5MB）内に収める
 * 
 * 安定性重視: Canvas APIのみ使用（browser-image-compressionは不安定なため廃止）
 * - 外部ライブラリなし、シンプルなCanvas API
 * - ファイル間に遅延を入れてリソース解放を促す
 * - 各処理にタイムアウトを設けてハング防止
 */

// 圧縮タイムアウト設定
const PER_FILE_TIMEOUT_MS = 6000;         // 1ファイルあたり最大6秒
const MAX_TOTAL_COMPRESSION_MS = 25000;   // 全体で25秒を超えたら打ち切り
const INTER_FILE_DELAY_MS = 100;          // ファイル間の遅延（リソース解放用）

/**
 * 圧縮オプション
 */
export type CompressionOptions = {
    maxSizeMB: number;           // 最大ファイルサイズ（MB）
    maxWidthOrHeight: number;    // 最大幅または高さ（px）
    useWebWorker: boolean;       // WebWorkerを使用するか
    initialQuality?: number;     // 初期品質（0-1）
};

/**
 * デフォルトの圧縮設定
 * スマホ写真を効率的に圧縮しつつ、テキストの可読性を維持
 * WebWorkerを無効化（一部のブラウザ/環境で動作しないため）
 */
export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.6,              // 600KB以下に圧縮（複数ファイル対応）
    maxWidthOrHeight: 2048,      // 2048px以下にリサイズ（テキスト可読性維持）
    useWebWorker: false,         // メインスレッドで処理（WebWorker問題回避）
    initialQuality: 0.8,         // 80%品質
};

/**
 * 高品質圧縮設定（文字の多い資料向け）
 */
export const HIGH_QUALITY_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.85,
    maxWidthOrHeight: 2560,
    useWebWorker: false,         // メインスレッドで処理
    initialQuality: 0.85,
};

/**
 * 低品質圧縮設定（ファイル数が多い場合）
 */
export const LOW_QUALITY_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.25,             // 10枚対応: 0.25MB × 10 = 2.5MB（4.2MB制限内、より安全なマージン）
    maxWidthOrHeight: 1100,       // さらに小さくリサイズ（テキスト可読性を維持しつつ）
    useWebWorker: false,         // メインスレッドで処理
    initialQuality: 0.5,         // 品質を下げてサイズ削減
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
    // 画像ファイルのみ圧縮対象
    if (!isImageFile(file)) {
        return false;
    }
    // 指定サイズ以上なら圧縮
    return file.size > maxSizeMB * 1024 * 1024;
}

/**
 * Canvas APIを使った安定した画像圧縮
 * browser-image-compressionは不安定なため、Canvas APIのみ使用
 */
async function compressWithCanvas(
    file: File,
    maxWidthOrHeight: number = 2048,
    quality: number = 0.7
): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        let resolved = false;
        
        // タイムアウト設定（ハング防止）
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                URL.revokeObjectURL(url);
                console.warn(`[Canvas] Timeout for ${file.name}, using original`);
                resolve(file);
            }
        }, PER_FILE_TIMEOUT_MS);
        
        img.onload = () => {
            if (resolved) return;
            
            try {
                URL.revokeObjectURL(url);
                
                // リサイズ計算
                let { width, height } = img;
                const originalWidth = width;
                const originalHeight = height;
                
                if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidthOrHeight) / width);
                        width = maxWidthOrHeight;
                    } else {
                        width = Math.round((width * maxWidthOrHeight) / height);
                        height = maxWidthOrHeight;
                    }
                }
                
                // Canvas描画
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    clearTimeout(timeout);
                    resolved = true;
                    console.warn(`[Canvas] No context for ${file.name}, using original`);
                    resolve(file);
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                
                // JPEG出力
                canvas.toBlob(
                    (blob) => {
                        clearTimeout(timeout);
                        if (resolved) return;
                        resolved = true;
                        
                        if (blob) {
                            const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
                            console.log(`[Canvas] ${file.name}: ${originalWidth}x${originalHeight} → ${width}x${height}, ${(file.size/1024/1024).toFixed(2)}MB → ${(compressedFile.size/1024/1024).toFixed(2)}MB`);
                            
                            // Canvasをクリア（メモリ解放）
                            canvas.width = 0;
                            canvas.height = 0;
                            
                            resolve(compressedFile);
                        } else {
                            console.warn(`[Canvas] toBlob failed for ${file.name}, using original`);
                            resolve(file);
                        }
                    },
                    'image/jpeg',
                    quality
                );
            } catch (err) {
                clearTimeout(timeout);
                if (!resolved) {
                    resolved = true;
                    console.error(`[Canvas] Error for ${file.name}:`, err);
                    resolve(file); // エラー時も元ファイルで続行
                }
            }
        };
        
        img.onerror = () => {
            clearTimeout(timeout);
            if (!resolved) {
                resolved = true;
                URL.revokeObjectURL(url);
                console.warn(`[Canvas] Image load failed for ${file.name}, using original`);
                resolve(file);
            }
        };
        
        img.src = url;
    });
}

/**
 * 単一画像を圧縮（Canvas APIのみ使用 - 安定性重視）
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = DEFAULT_COMPRESSION_OPTIONS,
    onProgress?: (progress: number) => void
): Promise<File> {
    // 画像でない場合はそのまま返す
    if (!isImageFile(file)) {
        return file;
    }

    // 圧縮不要の場合はそのまま返す（ただし大きい画像はリサイズ）
    const fileSizeMB = file.size / 1024 / 1024;
    if (fileSizeMB <= options.maxSizeMB && fileSizeMB < 1.0) {
        console.log(`[Compressor] Skip: ${file.name} (${fileSizeMB.toFixed(2)}MB) - already small`);
        if (onProgress) onProgress(100);
        return file;
    }

    console.log(`[Compressor] Start: ${file.name} (${fileSizeMB.toFixed(2)}MB)`);
    if (onProgress) onProgress(10);

    try {
        // Canvas APIで圧縮（タイムアウト内蔵）
        const result = await compressWithCanvas(
            file,
            options.maxWidthOrHeight,
            options.initialQuality || 0.7
        );
        
        if (onProgress) onProgress(100);
        return result;
    } catch (error) {
        console.error(`[Compressor] Error for ${file.name}:`, error);
        if (onProgress) onProgress(100);
        return file; // エラー時は元ファイルで続行
    }
}

/**
 * ファイル数に応じて最適な圧縮設定を選択
 */
export function getOptimalCompressionOptions(fileCount: number): CompressionOptions {
    if (fileCount <= 2) return HIGH_QUALITY_OPTIONS;        // 少数は少し緩め
    if (fileCount <= 7) return DEFAULT_COMPRESSION_OPTIONS;  // 中程度
    return LOW_QUALITY_OPTIONS;                              // 多数（8枚以上）
}

/**
 * 複数ファイルを一括圧縮
 * 
 * @param files - 圧縮するファイル配列
 * @param onProgress - 進捗コールバック (0-100)
 * @returns 圧縮されたファイル配列
 */
export async function compressMultipleImages(
    files: File[],
    onProgress?: (progress: number, currentFile: string) => void
): Promise<File[]> {
    const totalFiles = files.length;
    const MAX_TOTAL_SIZE = 4.2 * 1024 * 1024; // 4.2MB制限
    const originalSize = files.reduce((sum, f) => sum + f.size, 0);
    let baseOptions = getOptimalCompressionOptions(totalFiles);
    
    console.log(`[Compressor] Starting batch: ${totalFiles} files, ${(originalSize/1024/1024).toFixed(2)}MB total`);
    
    // 10枚以上の場合、より厳しい圧縮
    if (totalFiles >= 10) {
        const targetSizePerFile = (MAX_TOTAL_SIZE * 0.8) / totalFiles;
        baseOptions = {
            ...baseOptions,
            maxSizeMB: Math.max(0.12, targetSizePerFile / (1024 * 1024)),
        };
    }
    
    const compressedFiles: File[] = [];
    let currentTotalSize = 0;
    const startTime = Date.now();

    for (let i = 0; i < files.length; i++) {
        // ★重要: ファイル間に遅延を入れてリソース解放を促す
        if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, INTER_FILE_DELAY_MS));
        }
        
        // UIを更新するためのフレーム待機
        await new Promise((resolve) => setTimeout(resolve, 0));

        // 全体タイムアウトチェック
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > MAX_TOTAL_COMPRESSION_MS) {
            console.warn(`[Compressor] Total timeout after ${(elapsedTime / 1000).toFixed(1)}s, returning ${i} processed + ${files.length - i} original`);
            return [...compressedFiles, ...files.slice(i)];
        }

        const file = files[i];
        const progress = Math.round((i / totalFiles) * 100);
        
        if (onProgress) {
            onProgress(progress, file.name);
        }

        // 動的にオプションを調整
        const remainingCount = totalFiles - i;
        const remainingSizeBudget = MAX_TOTAL_SIZE - currentTotalSize;
        const dynamicMaxSizeMB = remainingCount > 0 
            ? Math.min(baseOptions.maxSizeMB, (remainingSizeBudget * 0.8) / (remainingCount * 1024 * 1024))
            : baseOptions.maxSizeMB;
        
        const dynamicOptions = {
            ...baseOptions,
            maxSizeMB: Math.max(0.08, dynamicMaxSizeMB),
        };

        let compressedFile: File;
        try {
            // Canvas APIで圧縮（タイムアウト内蔵）
            compressedFile = await compressImage(
                file,
                dynamicOptions,
                (fileProgress) => {
                    if (onProgress) {
                        const overallProgress = Math.round(((i + fileProgress / 100) / totalFiles) * 100);
                        onProgress(overallProgress, file.name);
                    }
                }
            );
        } catch (err) {
            console.error(`[Compressor] Error for ${file.name}:`, err);
            compressedFile = file;
        }

        currentTotalSize += compressedFile.size;
        
        // サイズ制限チェック
        if (currentTotalSize > MAX_TOTAL_SIZE) {
            console.warn(`[Compressor] Size limit exceeded at file ${i + 1}: ${(currentTotalSize / 1024 / 1024).toFixed(2)}MB`);
            compressedFiles.push(compressedFile);
            return [...compressedFiles, ...files.slice(i + 1)];
        }

        compressedFiles.push(compressedFile);
        console.log(`[Compressor] Progress: ${i + 1}/${totalFiles} done`);
    }

    if (onProgress) {
        onProgress(100, '完了');
    }

    const compressedSize = compressedFiles.reduce((sum, f) => sum + f.size, 0);
    console.log(`[Compressor] Complete: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${Math.round((1 - compressedSize / originalSize) * 100)}% reduced)`);

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
