/**
 * 画像圧縮ユーティリティ
 * 
 * スマホで撮影した大きな画像を自動的に圧縮し、
 * Vercelのペイロード制限（4.5MB）内に収める
 */

import imageCompression from 'browser-image-compression';

// 圧縮が固まらないようにするためのタイムアウト
const PER_FILE_TIMEOUT_MS = 15000;        // 1ファイルあたり最大15秒で打ち切り
const MAX_TOTAL_COMPRESSION_MS = 45000;   // 全体で45秒を超えたら打ち切り

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
    maxSizeMB: 0.8,              // 800KB以下に圧縮（複数ファイル対応）
    maxWidthOrHeight: 2048,      // 2048px以下にリサイズ（テキスト可読性維持）
    useWebWorker: false,         // メインスレッドで処理（WebWorker問題回避）
    initialQuality: 0.8,         // 80%品質
};

/**
 * 高品質圧縮設定（文字の多い資料向け）
 */
export const HIGH_QUALITY_OPTIONS: CompressionOptions = {
    maxSizeMB: 1.2,
    maxWidthOrHeight: 2560,
    useWebWorker: false,         // メインスレッドで処理
    initialQuality: 0.85,
};

/**
 * 低品質圧縮設定（ファイル数が多い場合）
 */
export const LOW_QUALITY_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.18,             // 10枚対応: 0.18MB × 10 = 1.8MB（3.5MB制限内、より安全なマージン）
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
 * 単一画像を圧縮
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

    // 圧縮不要の場合はそのまま返す
    if (!needsCompression(file, options.maxSizeMB)) {
        return file;
    }

    try {
        console.log(`[ImageCompressor] Starting compression: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        // 圧縮を実行（タイムアウト付き）
        const compressionPromise = imageCompression(file, {
            maxSizeMB: options.maxSizeMB,
            maxWidthOrHeight: options.maxWidthOrHeight,
            useWebWorker: options.useWebWorker,
            initialQuality: options.initialQuality,
            onProgress: onProgress,
        });

        // タイムアウト（固まるケースの防止）
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Compression timeout')), PER_FILE_TIMEOUT_MS);
        });

        const compressedBlob = await Promise.race([compressionPromise, timeoutPromise]);

        // Blobを元のファイル名でFileに変換
        const compressedFile = new File(
            [compressedBlob],
            file.name,
            { type: compressedBlob.type || file.type }
        );

        console.log(
            `[ImageCompressor] ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`
        );

        return compressedFile;
    } catch (error) {
        console.error('[ImageCompressor] Compression failed:', error);
        // 圧縮失敗時は元のファイルを返す（ただしログを出力）
        console.warn(`[ImageCompressor] Using original file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        return file;
    }
}

/**
 * ファイル数に応じて最適な圧縮設定を選択
 */
export function getOptimalCompressionOptions(fileCount: number): CompressionOptions {
    if (fileCount <= 3) {
        // 少数ファイル: 高品質
        return HIGH_QUALITY_OPTIONS;
    } else if (fileCount <= 7) {
        // 中程度: デフォルト
        return DEFAULT_COMPRESSION_OPTIONS;
    } else {
        // 多数ファイル（8枚以上）: 低品質（合計サイズ制限対応、10枚でも処理可能）
        return LOW_QUALITY_OPTIONS;
    }
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
    const MAX_TOTAL_SIZE = 3.5 * 1024 * 1024; // 3.5MB制限
    let baseOptions = getOptimalCompressionOptions(totalFiles);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:165',message:'compressMultipleImages START',data:{totalFiles,originalSizes:files.map(f=>({name:f.name,size:f.size}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // 10枚以上の場合、合計サイズを考慮して目標サイズを動的に調整
    if (totalFiles >= 10) {
        const targetSizePerFile = (MAX_TOTAL_SIZE * 0.8) / totalFiles; // 80%の安全マージン（より厳しく）
        baseOptions = {
            ...baseOptions,
            maxSizeMB: Math.max(0.12, targetSizePerFile / (1024 * 1024)), // 最小0.12MBを保証
        };
    }
    
    const compressedFiles: File[] = [];
    let currentTotalSize = 0;
    const startTime = Date.now();
    const MAX_COMPRESSION_TIME = MAX_TOTAL_COMPRESSION_MS; // 全体タイムアウト（45秒）
    const originalSize = files.reduce((sum, f) => sum + f.size, 0);

    for (let i = 0; i < files.length; i++) {
        // UIを固めないように1フレーム待機
        await new Promise((resolve) => setTimeout(resolve, 0));

        // タイムアウトチェック
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > MAX_COMPRESSION_TIME) {
            console.warn(`[ImageCompressor] Compression timeout after ${(elapsedTime / 1000).toFixed(1)}s, using compressed files so far`);
            // 圧縮済みのファイルと残りの元のファイルを結合
            const remainingFiles = files.slice(i);
            return [...compressedFiles, ...remainingFiles];
        }

        const file = files[i];
        const progress = Math.round((i / totalFiles) * 100);
        
        if (onProgress) {
            onProgress(progress, file.name);
        }

        // 残りのファイル数を考慮して、目標サイズを動的に調整
        const remainingFiles = totalFiles - i;
        const remainingSizeBudget = MAX_TOTAL_SIZE - currentTotalSize;
        // より厳しい制限: 残り予算の80%を残りファイル数で割る（安全マージン）
        const dynamicMaxSizeMB = remainingFiles > 0 
            ? Math.min(baseOptions.maxSizeMB, (remainingSizeBudget * 0.8) / (remainingFiles * 1024 * 1024))
            : baseOptions.maxSizeMB;
        
        const dynamicOptions = {
            ...baseOptions,
            maxSizeMB: Math.max(0.08, dynamicMaxSizeMB), // 最小0.08MBを保証（より厳しく）
        };

        let compressedFile: File;
        try {
            const perFileTimeout = Math.max(5000, Math.min(PER_FILE_TIMEOUT_MS, MAX_COMPRESSION_TIME - elapsedTime));

            // 圧縮を実行（時間がかかる場合は元ファイルにフォールバック）
            compressedFile = await Promise.race([
                compressImage(
                    file,
                    dynamicOptions,
                    // 個別ファイルの進捗（全体進捗に加算）
                    (fileProgress) => {
                        if (onProgress) {
                            const overallProgress = Math.round(
                                ((i + fileProgress / 100) / totalFiles) * 100
                            );
                            onProgress(overallProgress, file.name);
                        }
                    }
                ),
                new Promise<File>((resolve) => {
                    setTimeout(() => {
                        console.warn(`[ImageCompressor] Per-file timeout (${(perFileTimeout / 1000).toFixed(1)}s) for ${file.name}, using original`);
                        resolve(file);
                    }, perFileTimeout);
                }),
            ]);
        } catch (err) {
            console.error(`[ImageCompressor] Error compressing ${file.name}:`, err);
            // エラー時は元のファイルを使用
            compressedFile = file;
        }

        currentTotalSize += compressedFile.size;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:240',message:'File compressed',data:{index:i,fileName:file.name,originalSize:file.size,compressedSize:compressedFile.size,currentTotalSize,maxTotalSize:MAX_TOTAL_SIZE,willExceed:currentTotalSize>MAX_TOTAL_SIZE},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // サイズ制限を超えた場合の警告と処理
        if (currentTotalSize > MAX_TOTAL_SIZE) {
            console.warn(`[ImageCompressor] Warning: Total size exceeded after ${i + 1} files: ${(currentTotalSize / 1024 / 1024).toFixed(2)}MB`);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:248',message:'SIZE LIMIT EXCEEDED - RETURNING EARLY',data:{processedCount:compressedFiles.length,totalFiles,currentTotalSize},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            // 残りのファイルは圧縮せずにスキップ
            // ただし、既に圧縮済みのファイルだけを返す（元のファイルは含めない）
            return compressedFiles;
        }

        compressedFiles.push(compressedFile);
    }

    if (onProgress) {
        onProgress(100, '完了');
    }

    // 圧縮結果のサマリーをログ出力
    const compressedSize = compressedFiles.reduce((sum, f) => sum + f.size, 0);
    console.log(
        `[ImageCompressor] Total: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${Math.round((1 - compressedSize / originalSize) * 100)}% reduced)`
    );

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
