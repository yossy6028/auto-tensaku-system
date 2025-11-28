/**
 * 画像圧縮ユーティリティ
 * 
 * スマホで撮影した大きな画像を自動的に圧縮し、
 * Vercelのペイロード制限（4.5MB）内に収める
 */

import imageCompression from 'browser-image-compression';

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
 */
export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.8,              // 800KB以下に圧縮（複数ファイル対応）
    maxWidthOrHeight: 2048,      // 2048px以下にリサイズ（テキスト可読性維持）
    useWebWorker: true,          // バックグラウンド処理
    initialQuality: 0.8,         // 80%品質
};

/**
 * 高品質圧縮設定（文字の多い資料向け）
 */
export const HIGH_QUALITY_OPTIONS: CompressionOptions = {
    maxSizeMB: 1.2,
    maxWidthOrHeight: 2560,
    useWebWorker: true,
    initialQuality: 0.85,
};

/**
 * 低品質圧縮設定（ファイル数が多い場合）
 */
export const LOW_QUALITY_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    initialQuality: 0.7,
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
        const compressedBlob = await imageCompression(file, {
            maxSizeMB: options.maxSizeMB,
            maxWidthOrHeight: options.maxWidthOrHeight,
            useWebWorker: options.useWebWorker,
            initialQuality: options.initialQuality,
            onProgress: onProgress,
        });

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
        // 圧縮失敗時は元のファイルを返す
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
    } else if (fileCount <= 8) {
        // 中程度: デフォルト
        return DEFAULT_COMPRESSION_OPTIONS;
    } else {
        // 多数ファイル: 低品質（合計サイズ制限対応）
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
    const options = getOptimalCompressionOptions(totalFiles);
    const compressedFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = Math.round((i / totalFiles) * 100);
        
        if (onProgress) {
            onProgress(progress, file.name);
        }

        const compressedFile = await compressImage(
            file,
            options,
            // 個別ファイルの進捗（全体進捗に加算）
            (fileProgress) => {
                if (onProgress) {
                    const overallProgress = Math.round(
                        ((i + fileProgress / 100) / totalFiles) * 100
                    );
                    onProgress(overallProgress, file.name);
                }
            }
        );

        compressedFiles.push(compressedFile);
    }

    if (onProgress) {
        onProgress(100, '完了');
    }

    // 圧縮結果のサマリーをログ出力
    const originalSize = files.reduce((sum, f) => sum + f.size, 0);
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

