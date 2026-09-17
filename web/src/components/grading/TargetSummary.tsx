import { Trash2 } from 'lucide-react';
import type { EffectiveTargetSelection } from '@/lib/grading/effectiveTargets';

type TargetSummaryProps = {
  selection: EffectiveTargetSelection;
  mode: 'single' | 'batch';
  disabled?: boolean;
  locked?: boolean;
  onRemove?: (index: number) => void;
  onClear?: () => void;
};

export function TargetSummary({ selection, mode, disabled = false, locked = false, onRemove, onClear }: TargetSummaryProps) {
  const hasTargets = selection.targets.length > 0;

  return (
    <section
      aria-label="今回の採点対象"
      className="rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-white to-indigo-50 p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold tracking-wide text-indigo-900">今回の採点対象</h3>
        <span className="rounded-full bg-indigo-600 px-3 py-1 text-sm font-bold text-white">
          {selection.targets.length}問
        </span>
      </div>

      {hasTargets ? (
        <div className="mt-4 space-y-3">
          {selection.targets.map((target, index) => (
            <div key={`${target.label}-${index}`} className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="break-words text-2xl font-black leading-tight text-slate-900 sm:text-[30px]">
                  {target.label}
                </p>
                <p className="mt-1 text-sm font-bold text-indigo-700">
                  {target.points === null ? '配点未設定' : `配点 ${Math.floor(target.points)}点`}
                </p>
              </div>
              {selection.source === 'selected' && onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  disabled={disabled}
                  aria-label={`${target.label}を採点対象から削除`}
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="font-medium text-slate-600">
              {selection.source === 'draft'
                ? 'この入力内容を採点します。追加操作は不要です。'
                : '追加済みの問題だけを採点します。'}
            </p>
            {selection.source === 'selected' && onClear && (
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                className="font-bold text-slate-500 underline hover:text-red-600 disabled:opacity-50"
              >
                {mode === 'single' ? '追加済みの問題を解除' : '採点対象をすべてクリア'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-white px-4 py-5 text-center text-base font-bold text-amber-700">
          {mode === 'batch'
            ? '採点対象はまだありません。「採点対象に追加」を押してください。'
            : '採点対象はまだありません。問題番号を入力してください。'}
        </p>
      )}

      {selection.draftIsPending && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
          入力欄を変えても、追加済みの問題・配点は変わりません。配点を直す場合は、対象を削除して追加し直してください。
        </p>
      )}
      {locked && (
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
          読み取り開始時に確定した対象です。入力欄を変更しても、今回の送信対象は変わりません。
        </p>
      )}
    </section>
  );
}
