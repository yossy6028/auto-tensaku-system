'use client';

import React, { useCallback, useState } from 'react';
import { User, Trash2, Plus, FileText, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { clsx } from 'clsx';
import { StudentEntry, FileRole, MAX_FILES_PER_STUDENT } from '@/lib/types/batch';
import { formatFileSize } from '@/lib/utils/imageCompressor';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'pdf'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

interface StudentCardProps {
  student: StudentEntry;
  index: number;
  onUpdate: (id: string, updates: Partial<StudentEntry>) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

const FILE_ROLE_OPTIONS: { value: FileRole; label: string }[] = [
  { value: 'answer', label: '答案' },
  { value: 'problem', label: '問題' },
  { value: 'model', label: '模範解答' },
  { value: 'problem_model', label: '問題+模範解答' },
  { value: 'answer_problem', label: '答案+問題' },
  { value: 'all', label: '全部' },
  { value: 'other', label: 'その他' },
];

const detectFileRole = (filename: string): FileRole => {
  const lower = filename.toLowerCase();
  if (/answer|ans|student|解答|答案|生徒/.test(lower)) return 'answer';
  if (/problem|問題|mondai/.test(lower)) return 'problem';
  if (/model|sample|模範|解答例|正答/.test(lower)) return 'model';
  return 'other';
};

const getStatusIcon = (status: StudentEntry['status']) => {
  switch (status) {
    case 'processing':
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    default:
      return <User className="w-5 h-5 text-gray-400" />;
  }
};

const getStatusBorderColor = (status: StudentEntry['status']) => {
  switch (status) {
    case 'processing':
      return 'border-blue-400 bg-blue-50';
    case 'success':
      return 'border-green-400 bg-green-50';
    case 'error':
      return 'border-red-400 bg-red-50';
    default:
      return 'border-gray-200 bg-white';
  }
};

export const StudentCard: React.FC<StudentCardProps> = ({
  student,
  index,
  onUpdate,
  onRemove,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return false;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      return false;
    }
    return true;
  };

  const processFiles = useCallback(
    (newFiles: File[]) => {
      const validFiles = newFiles.filter(validateFile);
      const currentCount = student.files.length;
      const availableSlots = MAX_FILES_PER_STUDENT - currentCount;
      const filesToAdd = validFiles.slice(0, availableSlots);

      if (filesToAdd.length === 0) return;

      const newFileRoles: Record<number, FileRole> = { ...student.fileRoles };
      filesToAdd.forEach((file, i) => {
        newFileRoles[currentCount + i] = detectFileRole(file.name);
      });

      onUpdate(student.id, {
        files: [...student.files, ...filesToAdd],
        fileRoles: newFileRoles,
      });
    },
    [student, onUpdate]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    [disabled, processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled || !e.target.files) return;
      const files = Array.from(e.target.files);
      processFiles(files);
      e.target.value = '';
    },
    [disabled, processFiles]
  );

  const handleRemoveFile = (fileIndex: number) => {
    if (disabled) return;
    const newFiles = student.files.filter((_, i) => i !== fileIndex);
    const newFileRoles: Record<number, FileRole> = {};
    newFiles.forEach((_, i) => {
      const oldIndex = i >= fileIndex ? i + 1 : i;
      newFileRoles[i] = student.fileRoles[oldIndex] || 'other';
    });
    onUpdate(student.id, { files: newFiles, fileRoles: newFileRoles });
  };

  const handleRoleChange = (fileIndex: number, role: FileRole) => {
    if (disabled) return;
    onUpdate(student.id, {
      fileRoles: { ...student.fileRoles, [fileIndex]: role },
    });
  };

  const handleNameChange = (name: string) => {
    if (disabled) return;
    onUpdate(student.id, { name });
  };

  return (
    <div
      className={clsx(
        'rounded-lg border-2 p-4 transition-all',
        getStatusBorderColor(student.status),
        disabled && 'opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon(student.status)}
          <span className="text-sm font-medium text-gray-500">生徒 {index + 1}</span>
        </div>
        <button
          onClick={() => onRemove(student.id)}
          disabled={disabled}
          className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          title="この生徒を削除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Name Input */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="生徒名を入力"
          value={student.name}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={disabled}
          className={clsx(
            'w-full px-3 py-2 border rounded-lg text-sm',
            'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'disabled:bg-gray-100 disabled:cursor-not-allowed',
            !student.name && student.status === 'pending' && 'border-orange-300'
          )}
        />
        {!student.name && student.status === 'pending' && (
          <p className="text-xs text-orange-500 mt-1">生徒名は必須です</p>
        )}
      </div>

      {/* Error Message */}
      {student.status === 'error' && student.errorMessage && (
        <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-700">
          {student.errorMessage}
        </div>
      )}

      {/* File Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={clsx(
          'border-2 border-dashed rounded-lg p-3 transition-colors',
          isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300',
          disabled && 'cursor-not-allowed'
        )}
      >
        {student.files.length === 0 ? (
          <div className="text-center">
            <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 mb-2">
              ファイルをドラッグ&ドロップ
            </p>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                ファイルを選択
              </span>
              <input
                type="file"
                multiple
                accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
                onChange={handleFileInput}
                disabled={disabled}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-2">
            {student.files.map((file, fileIndex) => (
              <div
                key={fileIndex}
                className="flex items-center gap-2 p-2 bg-white rounded border"
              >
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <select
                  value={student.fileRoles[fileIndex] || 'other'}
                  onChange={(e) => handleRoleChange(fileIndex, e.target.value as FileRole)}
                  disabled={disabled}
                  className="text-xs border rounded px-1 py-0.5 bg-white"
                >
                  {FILE_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleRemoveFile(fileIndex)}
                  disabled={disabled}
                  className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {student.files.length < MAX_FILES_PER_STUDENT && (
              <label className="cursor-pointer block">
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  <Plus className="w-3 h-3" />
                  ファイルを追加 ({student.files.length}/{MAX_FILES_PER_STUDENT})
                </span>
                <input
                  type="file"
                  multiple
                  accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
                  onChange={handleFileInput}
                  disabled={disabled}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}
      </div>

      {/* File Count Info */}
      {student.files.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          {student.files.length}件のファイル / 合計{' '}
          {formatFileSize(student.files.reduce((sum, f) => sum + f.size, 0))}
        </p>
      )}
    </div>
  );
};
