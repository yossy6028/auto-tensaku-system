'use client';

import React from 'react';
import { Loader2, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { BatchState, StudentEntry } from '@/lib/types/batch';

interface BatchProgressProps {
  batchState: BatchState;
  students: StudentEntry[];
}

export const BatchProgress: React.FC<BatchProgressProps> = ({
  batchState,
  students,
}) => {
  const { isProcessing, completedCount, successCount, errorCount } = batchState;
  const totalCount = students.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const currentStudent = students.find((s) => s.status === 'processing');

  if (!isProcessing && completedCount === 0) {
    return null;
  }

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          <span className="font-medium">一括採点進捗</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-4 h-4" />
            {successCount}
          </span>
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle className="w-4 h-4" />
              {errorCount}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{completedCount} / {totalCount} 名完了</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full transition-all duration-300 rounded-full',
              errorCount > 0 && successCount === 0
                ? 'bg-red-500'
                : errorCount > 0
                ? 'bg-gradient-to-r from-green-500 to-yellow-500'
                : 'bg-green-500'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Current Processing */}
      {isProcessing && currentStudent && (
        <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>
            処理中: <strong>{currentStudent.name || `生徒${students.indexOf(currentStudent) + 1}`}</strong>
          </span>
        </div>
      )}

      {/* Completion Message */}
      {!isProcessing && completedCount === totalCount && (
        <div
          className={clsx(
            'flex items-center gap-2 text-sm rounded-lg px-3 py-2',
            errorCount === 0
              ? 'text-green-600 bg-green-50'
              : 'text-yellow-600 bg-yellow-50'
          )}
        >
          <CheckCircle className="w-4 h-4" />
          <span>
            {errorCount === 0
              ? `全${totalCount}名の採点が完了しました`
              : `${successCount}名成功、${errorCount}名失敗`}
          </span>
        </div>
      )}

      {/* Student Status List */}
      <div className="mt-3 flex flex-wrap gap-2">
        {students.map((student, idx) => (
          <div
            key={student.id}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
              student.status === 'pending' && 'bg-gray-100 text-gray-500',
              student.status === 'processing' && 'bg-blue-100 text-blue-600',
              student.status === 'success' && 'bg-green-100 text-green-600',
              student.status === 'error' && 'bg-red-100 text-red-600'
            )}
            title={student.name || `生徒${idx + 1}`}
          >
            {student.status === 'processing' && (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            {student.status === 'success' && <CheckCircle className="w-3 h-3" />}
            {student.status === 'error' && <AlertCircle className="w-3 h-3" />}
            <span className="max-w-[60px] truncate">
              {student.name || `生徒${idx + 1}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
