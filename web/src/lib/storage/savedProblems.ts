/**
 * 保存済み問題のCRUD操作
 * IndexedDBを使用した問題データの永続化
 */

import { getAll, getById, put, deleteById, STORES, isIndexedDBAvailable } from './indexedDb';
import type {
  SavedProblem,
  SavedProblemSummary,
  SavedProblemInput,
  SavedProblemFile,
  SavedProblemRecord,
  SavedFileRole,
} from './types';

/**
 * UUIDを生成
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 自動タイトルを生成
 */
export function generateDefaultTitle(problems: string[]): string {
  const date = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const problemStr =
    problems.length > 0
      ? problems.slice(0, 2).join('・') + (problems.length > 2 ? '他' : '')
      : '問題';
  return `${date} ${problemStr}`;
}

/**
 * ファイルサイズをフォーマット
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * File → SavedProblemFile に変換
 */
async function fileToSavedFile(file: File, role: SavedFileRole): Promise<SavedProblemFile> {
  return {
    id: generateId(),
    name: file.name,
    type: file.type,
    size: file.size,
    role,
    blob: file,
  };
}

/**
 * SavedProblemFile → File に復元
 */
export function savedFileToFile(savedFile: SavedProblemFile): File {
  return new File([savedFile.blob], savedFile.name, {
    type: savedFile.type,
    lastModified: Date.now(),
  });
}

/**
 * SavedProblemRecord → SavedProblem に変換（Date復元）
 */
function recordToProblem(record: SavedProblemRecord): SavedProblem {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

/**
 * SavedProblem → SavedProblemRecord に変換（Date→number）
 */
function problemToRecord(problem: SavedProblem): SavedProblemRecord {
  return {
    ...problem,
    createdAt: problem.createdAt.getTime(),
    updatedAt: problem.updatedAt.getTime(),
  };
}

/**
 * 問題を保存
 */
export async function saveProblem(input: SavedProblemInput): Promise<string> {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDBが利用できません');
  }

  const now = new Date();
  const id = generateId();

  // ファイルを変換（問題・模範解答のみ）
  const savedFiles: SavedProblemFile[] = [];
  for (let i = 0; i < input.files.length; i++) {
    const role = input.fileRoles[i];
    // 答案以外（問題・模範解答）のみ保存
    if (role === 'problem' || role === 'model' || role === 'problem_model') {
      const savedFile = await fileToSavedFile(input.files[i], role);
      savedFiles.push(savedFile);
    }
  }

  const problem: SavedProblem = {
    id,
    title: input.title,
    createdAt: now,
    updatedAt: now,
    selectedProblems: input.selectedProblems,
    problemPoints: input.problemPoints,
    problemFormat: input.problemFormat,
    smallFormat: input.smallFormat,
    files: savedFiles,
    modelAnswerText: input.modelAnswerText,
  };

  await put(STORES.SAVED_PROBLEMS, problemToRecord(problem));
  return id;
}

/**
 * 問題を更新
 */
export async function updateProblem(
  id: string,
  input: Partial<SavedProblemInput>
): Promise<void> {
  const existing = await getProblem(id);
  if (!existing) {
    throw new Error('問題が見つかりません');
  }

  const updated: SavedProblem = {
    ...existing,
    updatedAt: new Date(),
  };

  if (input.title !== undefined) updated.title = input.title;
  if (input.selectedProblems !== undefined) updated.selectedProblems = input.selectedProblems;
  if (input.problemPoints !== undefined) updated.problemPoints = input.problemPoints;
  if (input.problemFormat !== undefined) updated.problemFormat = input.problemFormat;
  if (input.smallFormat !== undefined) updated.smallFormat = input.smallFormat;
  if (input.modelAnswerText !== undefined) updated.modelAnswerText = input.modelAnswerText;

  // ファイルが指定された場合は更新
  if (input.files && input.fileRoles) {
    const savedFiles: SavedProblemFile[] = [];
    for (let i = 0; i < input.files.length; i++) {
      const role = input.fileRoles[i];
      if (role === 'problem' || role === 'model' || role === 'problem_model') {
        const savedFile = await fileToSavedFile(input.files[i], role);
        savedFiles.push(savedFile);
      }
    }
    updated.files = savedFiles;
  }

  await put(STORES.SAVED_PROBLEMS, problemToRecord(updated));
}

/**
 * 全問題の一覧を取得（軽量、ファイルデータは含まない）
 */
export async function getAllProblems(): Promise<SavedProblemSummary[]> {
  if (!isIndexedDBAvailable()) {
    return [];
  }

  const records = await getAll<SavedProblemRecord>(STORES.SAVED_PROBLEMS);

  return records
    .map((record) => ({
      id: record.id,
      title: record.title,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      problemCount: record.selectedProblems.length,
      fileCount: record.files.length,
      totalSize: record.files.reduce((sum, f) => sum + f.size, 0),
    }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * IDで問題を取得（ファイルデータ含む）
 */
export async function getProblem(id: string): Promise<SavedProblem | null> {
  if (!isIndexedDBAvailable()) {
    return null;
  }

  const record = await getById<SavedProblemRecord>(STORES.SAVED_PROBLEMS, id);
  if (!record) return null;

  return recordToProblem(record);
}

/**
 * 問題を削除
 */
export async function deleteProblem(id: string): Promise<void> {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDBが利用できません');
  }

  await deleteById(STORES.SAVED_PROBLEMS, id);
}

/**
 * 保存済み問題からファイルと役割を復元
 */
export function restoreFilesFromProblem(problem: SavedProblem): {
  files: File[];
  fileRoles: Record<number, SavedFileRole>;
} {
  const files: File[] = [];
  const fileRoles: Record<number, SavedFileRole> = {};

  problem.files.forEach((savedFile, index) => {
    files.push(savedFileToFile(savedFile));
    fileRoles[index] = savedFile.role;
  });

  return { files, fileRoles };
}
