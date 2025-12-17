/**
 * 画像圧縮ユーティリティ
 * 
 * スマホで撮影した大きな画像を自動的に圧縮し、
 * Vercelのペイロード制限（4.5MB）内に収める
 * 
 * 安定性最優先: toDataURL（同期）ベースの実装
 * - toBlob（非同期コールバック）は不安定なため廃止
 * - 同期的な処理で確実にPromiseを解決
 * - 短いタイムアウトで即座にフォールバック
 */

// 圧縮タイムアウト設定（短縮して早めにフォールバック）
const PER_FILE_TIMEOUT_MS = 4000;         // 1ファイルあたり最大4秒
const MAX_TOTAL_COMPRESSION_MS = 20000;   // 全体で20秒を超えたら打ち切り
const INTER_FILE_DELAY_MS = 50;           // ファイル間の遅延（リソース解放用）

/**
 * 圧縮オプション
 */
export type CompressionOptions = {
    maxSizeMB: number;           // 最大ファイルサイズ（MB）
    maxWidthOrHeight: number;    // 最大幅または高さ（px）
    useWebWorker: boolean;       // WebWorkerを使用するか（未使用、互換性のため残す）
    initialQuality?: number;     // 初期品質（0-1）
};

/**
 * デフォルトの圧縮設定
 */
export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.6,
    maxWidthOrHeight: 1600,      // 2048→1600に縮小（処理速度向上）
    useWebWorker: false,
    initialQuality: 0.75,
};

/**
 * 高品質圧縮設定（文字の多い資料向け）
 */
export const HIGH_QUALITY_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.85,
    maxWidthOrHeight: 1800,      // 2560→1800に縮小
    useWebWorker: false,
    initialQuality: 0.8,
};

/**
 * 低品質圧縮設定（ファイル数が多い場合）
 */
export const LOW_QUALITY_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.25,
    maxWidthOrHeight: 1000,      // 1100→1000に縮小
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
 * 画像を読み込む（Promise版）
 */
function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load timeout'));
        }, 3000); // 3秒で画像読み込みタイムアウト
        
        img.onload = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            resolve(img);
        };
        
        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            reject(new Error('Image load failed'));
        };
        
        img.src = url;
    });
}

/**
 * 同期的なCanvas圧縮（toDataURL使用）
 * toBlob（非同期コールバック）は不安定なためtoDataURL（同期）を使用
 */
function compressSync(
    img: HTMLImageElement,
    maxWidthOrHeight: number,
    quality: number,
    fileName: string
): File {
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
        throw new Error('Canvas context not available');
    }
    
    ctx.drawImage(img, 0, 0, width, height);
    
    // toDataURL（同期的に実行）
    const dataURL = canvas.toDataURL('image/jpeg', quality);
    
    // DataURLをBlobに変換
    const blob = dataURLtoBlob(dataURL);
    
    // メモリ解放
    canvas.width = 0;
    canvas.height = 0;
    
    return new File([blob], fileName, { type: 'image/jpeg' });
}

/**
 * 単一画像を圧縮（安定性最優先）
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = DEFAULT_COMPRESSION_OPTIONS,
    onProgress?: (progress: number) => void
): Promise<File> {
    // 画像でない場合はそのまま返す
    if (!isImageFile(file)) {
        if (onProgress) onProgress(100);
        return file;
    }

    const fileSizeMB = file.size / 1024 / 1024;
    
    // 小さいファイルはスキップ
    if (fileSizeMB <= options.maxSizeMB && fileSizeMB < 0.8) {
        console.log(`[Compress] Skip: ${file.name} (${fileSizeMB.toFixed(2)}MB)`);
        if (onProgress) onProgress(100);
        return file;
    }

    console.log(`[Compress] Start: ${file.name} (${fileSizeMB.toFixed(2)}MB)`);
    if (onProgress) onProgress(20);

    try {
        // タイムアウト付きで画像読み込み
        const img = await Promise.race([
            loadImage(file),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Load timeout')), PER_FILE_TIMEOUT_MS)
            )
        ]);
        
        if (onProgress) onProgress(50);
        
        // 同期的に圧縮（ここはブロックするが、確実に完了する）
        const compressedFile = compressSync(
            img,
            options.maxWidthOrHeight,
            options.initialQuality || 0.75,
            file.name
        );
        
        console.log(`[Compress] Done: ${file.name} ${fileSizeMB.toFixed(2)}MB → ${(compressedFile.size/1024/1024).toFixed(2)}MB`);
        if (onProgress) onProgress(100);
        
        return compressedFile;
    } catch (error) {
        console.warn(`[Compress] Failed: ${file.name}, using original. Error:`, error);
        if (onProgress) onProgress(100);
        return file; // エラー時は元ファイルで続行
    }
}

/**
 * ファイル数に応じて最適な圧縮設定を選択
 */
export function getOptimalCompressionOptions(fileCount: number): CompressionOptions {
    if (fileCount <= 2) return HIGH_QUALITY_OPTIONS;
    if (fileCount <= 7) return DEFAULT_COMPRESSION_OPTIONS;
    return LOW_QUALITY_OPTIONS;
}

/**
 * 複数ファイルを一括圧縮
 */
export async function compressMultipleImages(
    files: File[],
    onProgress?: (progress: number, currentFile: string) => void
): Promise<File[]> {
    const totalFiles = files.length;
    const MAX_TOTAL_SIZE = 4.2 * 1024 * 1024;
    const originalSize = files.reduce((sum, f) => sum + f.size, 0);
    let baseOptions = getOptimalCompressionOptions(totalFiles);
    
    console.log(`[Compress] Batch start: ${totalFiles} files, ${(originalSize/1024/1024).toFixed(2)}MB`);
    
    // ファイル数が多い場合、より厳しい圧縮
    if (totalFiles >= 8) {
        const targetSizePerFile = (MAX_TOTAL_SIZE * 0.7) / totalFiles;
        baseOptions = {
            ...baseOptions,
            maxSizeMB: Math.max(0.1, targetSizePerFile / (1024 * 1024)),
            maxWidthOrHeight: Math.min(baseOptions.maxWidthOrHeight, 1200),
        };
    }
    
    const compressedFiles: File[] = [];
    let currentTotalSize = 0;
    const startTime = Date.now();

    for (let i = 0; i < files.length; i++) {
        // 進捗を即座に更新
        const progress = Math.round((i / totalFiles) * 100);
        if (onProgress) {
            onProgress(progress, files[i].name);
        }
        
        // UIフレーム待機（必ず実行）
        await new Promise(resolve => setTimeout(resolve, INTER_FILE_DELAY_MS));

        // 全体タイムアウトチェック
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_TOTAL_COMPRESSION_MS) {
            console.warn(`[Compress] Total timeout at ${i}/${totalFiles}, ${(elapsed/1000).toFixed(1)}s`);
            // 残りは元ファイルをそのまま追加
            for (let j = i; j < files.length; j++) {
                compressedFiles.push(files[j]);
            }
            break;
        }

        const file = files[i];

        // 動的にオプション調整
        const remainingCount = totalFiles - i;
        const remainingBudget = MAX_TOTAL_SIZE - currentTotalSize;
        const dynamicMaxSizeMB = remainingCount > 0 
            ? Math.min(baseOptions.maxSizeMB, (remainingBudget * 0.7) / (remainingCount * 1024 * 1024))
            : baseOptions.maxSizeMB;
        
        const dynamicOptions = {
            ...baseOptions,
            maxSizeMB: Math.max(0.08, dynamicMaxSizeMB),
        };

        let compressedFile: File;
        try {
            // 個別ファイルのタイムアウト付き圧縮
            compressedFile = await Promise.race([
                compressImage(file, dynamicOptions, (p) => {
                    if (onProgress) {
                        const overall = Math.round(((i + p / 100) / totalFiles) * 100);
                        onProgress(overall, file.name);
                    }
                }),
                new Promise<File>(resolve => {
                    setTimeout(() => {
                        console.warn(`[Compress] File timeout: ${file.name}`);
                        resolve(file); // タイムアウト時は元ファイル
                    }, PER_FILE_TIMEOUT_MS);
                })
            ]);
        } catch (err) {
            console.error(`[Compress] Error: ${file.name}`, err);
            compressedFile = file;
        }

        currentTotalSize += compressedFile.size;
        compressedFiles.push(compressedFile);
        
        // サイズ制限チェック
        if (currentTotalSize > MAX_TOTAL_SIZE && i < files.length - 1) {
            console.warn(`[Compress] Size limit at ${i + 1}/${totalFiles}: ${(currentTotalSize/1024/1024).toFixed(2)}MB`);
            // 残りは元ファイルをそのまま追加
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
    console.log(`[Compress] Done: ${(originalSize/1024/1024).toFixed(2)}MB → ${(compressedSize/1024/1024).toFixed(2)}MB (${reduction}% reduced)`);

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
