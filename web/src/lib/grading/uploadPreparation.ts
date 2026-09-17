import { compressMultipleImages, isImageFile } from '../utils/imageCompressor';
import { extractPdfPages } from '../utils/pdfPageExtractor';
import {
  CLIENT_FULL_PIPELINE_TOTAL_SIZE_BYTES,
  CLIENT_MAX_SINGLE_FILE_SIZE_BYTES,
  CLIENT_MAX_TOTAL_SIZE_BYTES,
} from '../security/uploadLimits';

export type FileRole =
  | 'auto'
  | 'answer'
  | 'problem'
  | 'model'
  | 'problem_model'
  | 'answer_problem'
  | 'all'
  | 'other';

export type PdfPageInfo = {
  answerPage?: string;
  problemPage?: string;
  modelAnswerPage?: string;
};

export type PreparedFilesCache = {
  sources: File[];
  rolesKey: string;
  pdfKey: string;
  result: File[];
};

export type PrepareFilesForUploadOptions = {
  fileRoles: Record<number, FileRole>;
  pdfPageInfo: PdfPageInfo;
  onCompressionProgress?: (progress: number, currentFile: string) => void;
};

export type UploadPreparationDependencies = {
  compressMultipleImages: typeof compressMultipleImages;
  extractPdfPages: typeof extractPdfPages;
  isImageFile: typeof isImageFile;
};

const defaultDependencies: UploadPreparationDependencies = {
  compressMultipleImages,
  extractPdfPages,
  isImageFile,
};

const getCompressionTimeout = (fileCount: number) =>
  Math.min(60000, Math.max(15000, fileCount * 6000 + 10000));

const parsePageRange = (input?: string): number[] => {
  if (!input) return [];
  const pages = new Set<number>();
  input.split(',').forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const rangeParts = trimmed.split('-').map((token) => token.trim());
    if (rangeParts.length === 2) {
      const start = parseInt(rangeParts[0], 10);
      const end = parseInt(rangeParts[1], 10);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        const from = Math.min(start, end);
        const to = Math.max(start, end);
        for (let i = from; i <= to; i += 1) pages.add(i);
      }
      return;
    }
    const single = parseInt(trimmed, 10);
    if (Number.isFinite(single)) pages.add(single);
  });
  return Array.from(pages).sort((a, b) => a - b);
};

const mergeUniquePages = (...lists: number[][]): number[] => {
  const merged = new Set<number>();
  lists.forEach((list) => list.forEach((page) => merged.add(page)));
  return Array.from(merged).sort((a, b) => a - b);
};

const getPdfPagesForRole = (role: FileRole | undefined, info: PdfPageInfo): number[] => {
  const answerPages = parsePageRange(info.answerPage);
  const problemPages = parsePageRange(info.problemPage);
  const modelPages = parsePageRange(info.modelAnswerPage);

  switch (role) {
    case 'answer':
      return answerPages;
    case 'problem':
      return problemPages;
    case 'model':
      return modelPages;
    case 'answer_problem':
      return mergeUniquePages(answerPages, problemPages);
    case 'problem_model':
      return mergeUniquePages(problemPages, modelPages);
    case 'all':
      return mergeUniquePages(answerPages, problemPages, modelPages);
    default:
      return [];
  }
};

const shouldCompressImages = (
  files: File[],
  dependencies: UploadPreparationDependencies
): boolean => {
  const imageFiles = files.filter((file) => dependencies.isImageFile(file));
  if (imageFiles.length === 0) return false;

  if (imageFiles.some((file) => file.size > CLIENT_MAX_SINGLE_FILE_SIZE_BYTES)) {
    return true;
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const imageSize = imageFiles.reduce((sum, file) => sum + file.size, 0);
  const nonImageSize = totalSize - imageSize;
  if (nonImageSize >= CLIENT_MAX_TOTAL_SIZE_BYTES) {
    return false;
  }

  const imageBudget = CLIENT_MAX_TOTAL_SIZE_BYTES - nonImageSize;
  if (imageSize > imageBudget) {
    return true;
  }

  return (
    nonImageSize < CLIENT_FULL_PIPELINE_TOTAL_SIZE_BYTES &&
    totalSize > CLIENT_FULL_PIPELINE_TOTAL_SIZE_BYTES
  );
};

export async function compressWithTimeout(
  files: File[],
  onProgress?: (progress: number, currentFile: string) => void,
  dependencies: UploadPreparationDependencies = defaultDependencies
): Promise<File[]> {
  const startTime = Date.now();
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const timeoutMs = getCompressionTimeout(files.length);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  console.log(
    `[Page] Compression start: ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB, timeout: ${timeoutMs}ms`
  );

  try {
    const timeoutPromise = new Promise<File[]>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(`[Page] Compression timeout after ${timeoutMs}ms, using original files`);
        resolve(files);
      }, timeoutMs);
    });

    const result = await Promise.race([
      dependencies.compressMultipleImages(files, onProgress),
      timeoutPromise,
    ]);

    const compressedSize = result.reduce((sum, file) => sum + file.size, 0);
    const elapsed = Date.now() - startTime;
    console.log(
      `[Page] Compression done in ${elapsed}ms: ${(totalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB`
    );
    return result;
  } catch (error) {
    console.error('[Page] Compression error:', error);
    return files;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function prepareFilesForUpload(
  files: File[],
  options: PrepareFilesForUploadOptions,
  cacheRef: { current: PreparedFilesCache | null },
  dependencies: UploadPreparationDependencies = defaultDependencies
): Promise<File[]> {
  const rolesKey = JSON.stringify(options.fileRoles);
  const pdfKey = JSON.stringify(options.pdfPageInfo);
  const cached = cacheRef.current;
  if (
    cached &&
    cached.rolesKey === rolesKey &&
    cached.pdfKey === pdfKey &&
    cached.sources.length === files.length &&
    cached.sources.every((file, index) => file === files[index])
  ) {
    return cached.result;
  }
  const finalize = (result: File[]): File[] => {
    cacheRef.current = { sources: [...files], rolesKey, pdfKey, result };
    return result;
  };

  const hasAutoRole = Object.values(options.fileRoles).some((role) => role === 'auto');
  let processedFiles = files;
  const hasPdf = processedFiles.some((file) => file.type === 'application/pdf');
  const hasPdfPageInfo = Boolean(
    options.pdfPageInfo.answerPage ||
      options.pdfPageInfo.problemPage ||
      options.pdfPageInfo.modelAnswerPage
  );

  if (hasPdf && hasPdfPageInfo && !hasAutoRole) {
    const extractedFiles: File[] = [];
    for (let index = 0; index < processedFiles.length; index += 1) {
      const file = processedFiles[index];
      if (file.type !== 'application/pdf') {
        extractedFiles.push(file);
        continue;
      }
      const pages = getPdfPagesForRole(options.fileRoles[index], options.pdfPageInfo);
      if (pages.length === 0) {
        extractedFiles.push(file);
        continue;
      }
      const { file: extracted } = await dependencies.extractPdfPages(file, pages);
      extractedFiles.push(extracted);
    }
    processedFiles = extractedFiles;
  }

  if (!shouldCompressImages(processedFiles, dependencies)) {
    return finalize(processedFiles);
  }

  return finalize(await compressWithTimeout(processedFiles, options.onCompressionProgress, dependencies));
}
