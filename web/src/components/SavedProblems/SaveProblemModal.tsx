'use client';

import { useState, useEffect } from 'react';

interface SaveProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string) => Promise<void>;
  defaultTitle: string;
  selectedProblems: string[];
  fileCount: number;
}

export function SaveProblemModal({
  isOpen,
  onClose,
  onSave,
  defaultTitle,
  selectedProblems,
  fileCount,
}: SaveProblemModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle);
      setError(null);
    }
  }, [isOpen, defaultTitle]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(title.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          問題を保存
        </h3>

        <div className="space-y-4">
          {/* タイトル入力 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              タイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例: ○○中学 2024年 第1回"
              autoFocus
            />
          </div>

          {/* 保存内容のプレビュー */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">保存内容:</p>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>
                問題数: <span className="font-medium">{selectedProblems.length}</span>
                {selectedProblems.length > 0 && (
                  <span className="text-gray-500 ml-1">
                    ({selectedProblems.slice(0, 3).join(', ')}
                    {selectedProblems.length > 3 && '...'})
                  </span>
                )}
              </li>
              <li>
                ファイル数: <span className="font-medium">{fileCount}</span>
              </li>
            </ul>
          </div>

          {/* エラー表示 */}
          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* ボタン */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
