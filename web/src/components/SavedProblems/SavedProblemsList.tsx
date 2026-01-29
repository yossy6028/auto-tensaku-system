'use client';

import { useState } from 'react';
import type { SavedProblemSummary } from '@/lib/storage/types';
import { formatFileSize } from '@/lib/storage/savedProblems';

interface SavedProblemsListProps {
  isOpen: boolean;
  onClose: () => void;
  problems: SavedProblemSummary[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
}

export function SavedProblemsList({
  isOpen,
  onClose,
  problems,
  onSelect,
  onDelete,
  disabled = false,
}: SavedProblemsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            保存済み問題
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 一覧 */}
        <div className="flex-1 overflow-y-auto p-4">
          {problems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-gray-500 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                保存済みの問題はありません
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                問題をアップロード後「この問題を保存」から保存できます
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {problems.map((problem) => (
                <div
                  key={problem.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-800 dark:text-white truncate">
                        {problem.title}
                      </h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>問題数: {problem.problemCount}</span>
                        <span>ファイル: {problem.fileCount}</span>
                        <span>{formatFileSize(problem.totalSize)}</span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        更新: {formatDate(problem.updatedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {confirmDeleteId === problem.id ? (
                        <>
                          <button
                            onClick={() => handleDelete(problem.id)}
                            disabled={deletingId === problem.id}
                            className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50"
                          >
                            {deletingId === problem.id ? '削除中...' : '削除する'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
                          >
                            キャンセル
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              onSelect(problem.id);
                              onClose();
                            }}
                            disabled={disabled}
                            className="px-3 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg disabled:opacity-50"
                          >
                            読み込み
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(problem.id)}
                            disabled={disabled}
                            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50"
                            title="削除"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            問題データはこのブラウザにのみ保存されます
          </p>
        </div>
      </div>
    </div>
  );
}
