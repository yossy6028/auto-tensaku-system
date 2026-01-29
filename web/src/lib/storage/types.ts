/**
 * 保存済み問題の型定義
 * IndexedDBに保存する問題データの構造を定義
 */

// 保存可能なファイルの役割（問題・模範解答のみ）
export type SavedFileRole = 'problem' | 'model' | 'problem_model';

// 保存済みファイル
export interface SavedProblemFile {
  id: string;
  name: string;
  type: string;
  size: number;
  role: SavedFileRole;
  blob: Blob;
}

// 保存済み問題（完全データ）
export interface SavedProblem {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  // 問題設定
  selectedProblems: string[];
  problemPoints: Record<string, number>;
  problemFormat: 'big-small' | 'small-only' | 'free';
  smallFormat: 'number' | 'paren-number' | 'paren-alpha' | 'number-sub';
  // ファイルデータ
  files: SavedProblemFile[];
  // 模範解答テキスト（オプション）
  modelAnswerText?: string;
}

// 一覧表示用（ファイルなし、軽量）
export interface SavedProblemSummary {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  problemCount: number;
  fileCount: number;
  totalSize: number;
}

// 保存時の入力型
export interface SavedProblemInput {
  title: string;
  selectedProblems: string[];
  problemPoints: Record<string, number>;
  problemFormat: 'big-small' | 'small-only' | 'free';
  smallFormat: 'number' | 'paren-number' | 'paren-alpha' | 'number-sub';
  files: File[];
  fileRoles: Record<number, SavedFileRole>;
  modelAnswerText?: string;
}

// IndexedDB内での保存形式（Dateをnumberに変換）
export interface SavedProblemRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  selectedProblems: string[];
  problemPoints: Record<string, number>;
  problemFormat: 'big-small' | 'small-only' | 'free';
  smallFormat: 'number' | 'paren-number' | 'paren-alpha' | 'number-sub';
  files: SavedProblemFile[];
  modelAnswerText?: string;
}
