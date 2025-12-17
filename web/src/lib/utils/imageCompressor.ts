/**
 * 画像圧縮ユーティリティ
 * 
 * スマホで撮影した大きな画像を自動的に圧縮し、
 * Vercelのペイロード制限（4.5MB）内に収める
 * 
 * 安定性向上: Canvas APIベースのフォールバック圧縮を追加
 */

import imageCompression from 'browser-image-compression';

// 圧縮が固まらないようにするためのタイムアウト（短縮して早めにフォールバック）
const PER_FILE_TIMEOUT_MS = 8000;         // 1ファイルあたり最大8秒で打ち切り（15秒→8秒に短縮）
const MAX_TOTAL_COMPRESSION_MS = 30000;   // 全体で30秒を超えたら打ち切り（45秒→30秒に短縮）
const CANVAS_FALLBACK_TIMEOUT_MS = 5000;  // Canvas APIフォールバックのタイムアウト

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
 * Canvas APIを使ったシンプルな画像圧縮（フォールバック用）
 * browser-image-compressionがハングした場合の代替手段
 */
async function compressWithCanvas(
    file: File,
    maxWidthOrHeight: number = 2048,
    quality: number = 0.7
): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            try {
                URL.revokeObjectURL(url);
                
                // リサイズ計算
                let { width, height } = img;
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
                    reject(new Error('Canvas context not available'));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                
                // JPEG出力
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
                            console.log(`[Canvas Fallback] ${file.name}: ${(file.size/1024/1024).toFixed(2)}MB → ${(compressedFile.size/1024/1024).toFixed(2)}MB`);
                            resolve(compressedFile);
                        } else {
                            reject(new Error('Canvas toBlob failed'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            } catch (err) {
                reject(err);
            }
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load failed'));
        };
        
        img.src = url;
    });
}

/**
 * 単一画像を圧縮
 * ライブラリ失敗時はCanvas APIフォールバックを使用
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:compressImage:skip',message:'Compression skipped - file already small',data:{fileName:file.name,sizeMB:(file.size/1024/1024).toFixed(2),maxSizeMB:options.maxSizeMB},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return file;
    }

    // #region agent log
    const startTime = Date.now();
    fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:compressImage:start',message:'Starting single image compression',data:{fileName:file.name,sizeMB:(file.size/1024/1024).toFixed(2),options:{maxSizeMB:options.maxSizeMB,maxWidthOrHeight:options.maxWidthOrHeight,useWebWorker:options.useWebWorker}},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    // まずライブラリで圧縮を試行
    try {
        console.log(`[ImageCompressor] Starting compression: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        // 圧縮を実行（タイムアウト付き）
        const compressionPromise = imageCompression(file, {
            maxSizeMB: options.maxSizeMB,
            maxWidthOrHeight: options.maxWidthOrHeight,
            useWebWorker: options.useWebWorker,
            initialQuality: options.initialQuality,
            onProgress: (p) => {
                // #region agent log
                if (p % 25 === 0 || p >= 99) {
                    fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:compressImage:progress',message:'imageCompression onProgress',data:{fileName:file.name,progress:p,elapsedMs:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,C'})}).catch(()=>{});
                }
                // #endregion
                if (onProgress) onProgress(p);
            },
        });

        // タイムアウト（固まるケースの防止）- タイムアウト時はCanvasフォールバックへ
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:compressImage:timeout',message:'Per-file timeout - trying Canvas fallback',data:{fileName:file.name,elapsedMs:Date.now()-startTime,timeoutMs:PER_FILE_TIMEOUT_MS},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                reject(new Error('Compression timeout'));
            }, PER_FILE_TIMEOUT_MS);
        });

        const compressedBlob = await Promise.race([compressionPromise, timeoutPromise]);

        // Blobを元のファイル名でFileに変換
        const compressedFile = new File(
            [compressedBlob],
            file.name,
            { type: compressedBlob.type || file.type }
        );

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:compressImage:success',message:'Image compression succeeded (library)',data:{fileName:file.name,originalMB:(file.size/1024/1024).toFixed(2),compressedMB:(compressedFile.size/1024/1024).toFixed(2),elapsedMs:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        console.log(
            `[ImageCompressor] ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`
        );

        return compressedFile;
    } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:compressImage:libraryFailed',message:'Library compression failed - trying Canvas fallback',data:{fileName:file.name,error:String(error),elapsedMs:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,F'})}).catch(()=>{});
        // #endregion
        console.warn(`[ImageCompressor] Library failed for ${file.name}, trying Canvas fallback...`);
        
        // Canvas APIフォールバックを試行
        try {
            const canvasPromise = compressWithCanvas(
                file,
                options.maxWidthOrHeight,
                options.initialQuality || 0.7
            );
            
            const canvasTimeoutPromise = new Promise<File>((resolve) => {
                setTimeout(() => {
                    console.warn(`[ImageCompressor] Canvas fallback timeout for ${file.name}, using original`);
                    resolve(file);
                }, CANVAS_FALLBACK_TIMEOUT_MS);
            });
            
            const canvasResult = await Promise.race([canvasPromise, canvasTimeoutPromise]);
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:compressImage:canvasSuccess',message:'Canvas fallback succeeded',data:{fileName:file.name,originalMB:(file.size/1024/1024).toFixed(2),compressedMB:(canvasResult.size/1024/1024).toFixed(2),elapsedMs:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            
            return canvasResult;
        } catch (canvasError) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:compressImage:allFailed',message:'All compression methods failed - using original',data:{fileName:file.name,canvasError:String(canvasError),elapsedMs:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            console.error('[ImageCompressor] All compression methods failed:', canvasError);
            console.warn(`[ImageCompressor] Using original file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
            return file;
        }
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
    const MAX_TOTAL_SIZE = 4.2 * 1024 * 1024; // 4.2MB制限（Vercel 4.5MB上限に対してFormDataオーバーヘッドを考慮）
    let baseOptions = getOptimalCompressionOptions(totalFiles);
    
    // #region agent log
    const loopStartTime = Date.now();
    const originalSize = files.reduce((sum, f) => sum + f.size, 0);
    fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:compressMultipleImages:start',message:'Starting multiple image compression',data:{totalFiles,originalSizeMB:(originalSize/1024/1024).toFixed(2),baseOptions},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
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

    for (let i = 0; i < files.length; i++) {
        // UIを固めないように1フレーム待機
        await new Promise((resolve) => setTimeout(resolve, 0));

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:compressMultipleImages:loopIteration',message:`Processing file ${i+1}/${files.length}`,data:{index:i,fileName:files[i].name,sizeMB:(files[i].size/1024/1024).toFixed(2),elapsedMs:Date.now()-loopStartTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
        // #endregion

        // タイムアウトチェック
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > MAX_COMPRESSION_TIME) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageCompressor.ts:compressMultipleImages:totalTimeout',message:'Total compression timeout triggered',data:{elapsedMs:elapsedTime,timeoutMs:MAX_COMPRESSION_TIME,processedCount:i},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
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
        
        // サイズ制限を超えた場合の警告と処理
        if (currentTotalSize > MAX_TOTAL_SIZE) {
            console.warn(`[ImageCompressor] Warning: Total size exceeded after ${i + 1} files: ${(currentTotalSize / 1024 / 1024).toFixed(2)}MB`);
            // 残りのファイルは元のまま返す（欠落させない）
            compressedFiles.push(compressedFile);
            const remainingFiles = files.slice(i + 1);
            return [...compressedFiles, ...remainingFiles];
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
