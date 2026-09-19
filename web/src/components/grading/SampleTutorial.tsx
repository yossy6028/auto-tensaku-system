import Image from 'next/image';
import type { TutorialStep } from '@/lib/grading/tutorial';
import { SAMPLE_TRIAL } from '@/lib/sampleTrial';

type SampleTutorialProps = {
  step: TutorialStep;
  paused: boolean;
  completed: boolean;
  busy: boolean;
  error?: string | null;
  remainingCount: number | null;
  hasOwnFiles: boolean;
  onStart: () => void;
  onRead: () => void;
  onNext: () => void;
  onSkip: () => void;
  onResume: () => void;
  onUseOwn: () => void;
};

const stepProgress: Record<TutorialStep, { current: number; label: string }> = {
  intro: { current: 1, label: '問題を確認' },
  select: { current: 1, label: '問題を確認' },
  confirm: { current: 2, label: '文字を確認' },
  score: { current: 3, label: '結果を確認' },
  deductions: { current: 3, label: '結果を確認' },
  rewrite: { current: 3, label: '結果を確認' },
  complete: { current: 4, label: '完了' },
};

function Progress({ step }: { step: TutorialStep }) {
  const progress = stepProgress[step];

  return (
    <p className="text-sm font-semibold text-slate-600" aria-label={`チュートリアルの進行状況: ${progress.current} / 4 ${progress.label}`}>
      {progress.current} / 4　{progress.label}
    </p>
  );
}

function ContinueLater({ onSkip }: Pick<SampleTutorialProps, 'onSkip'>) {
  return (
    <button
      type="button"
      onClick={onSkip}
      className="text-sm font-semibold text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-indigo-700"
    >
      あとで続ける
    </button>
  );
}

export function SampleTutorial({
  step,
  paused,
  completed,
  busy,
  error,
  remainingCount,
  hasOwnFiles,
  onStart,
  onRead,
  onNext,
  onSkip,
  onResume,
  onUseOwn,
}: SampleTutorialProps) {
  const cannotReplaceCurrentWork = hasOwnFiles;
  const primaryDisabled = busy || cannotReplaceCurrentWork;
  const remainingCopy = remainingCount === null ? null : `体験の残り回数: ${remainingCount}`;

  if (completed || step === 'complete') {
    return (
      <section aria-labelledby="sample-tutorial-complete" className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5">
        <h2 id="sample-tutorial-complete" className="text-base font-bold text-indigo-950">
          使い方の体験が完了しました
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onUseOwn}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            自分の答案をアップロード
          </button>
          {remainingCopy && <p aria-live="polite" className="text-sm font-medium text-slate-600">{remainingCopy}</p>}
        </div>
      </section>
    );
  }

  if (paused) {
    return (
      <section aria-labelledby="sample-tutorial-paused" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 id="sample-tutorial-paused" className="text-base font-bold text-slate-900">
          チュートリアルを再開
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">中断したところから、実際の採点画面を見ながら続けられます。</p>
        {cannotReplaceCurrentWork && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">
            入力中の答案があります。現在の作業を終えてから体験できます。
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onResume}
            disabled={primaryDisabled}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            チュートリアルを再開
          </button>
          <button
            type="button"
            onClick={onUseOwn}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            自分の答案を使う
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="sample-tutorial-title" className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
      <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="sample-tutorial-title" className="text-lg font-extrabold tracking-tight text-indigo-950">
              はじめての採点ガイド
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">画面上の実際の項目を順に確認します。</p>
          </div>
          <Progress step={step} />
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold leading-6 text-red-800">
            {error}
          </p>
        )}

        {busy && (
          <p role="status" aria-live="polite" className="mb-4 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-900">
            処理中です。
          </p>
        )}

        {cannotReplaceCurrentWork && (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">
            入力中の答案があります。現在の作業を終えてから体験できます。
          </p>
        )}

        {step === 'intro' && (
          <div>
            <h3 className="text-xl font-extrabold tracking-tight text-slate-950">資料なしで使い方を体験</h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-700">
              サンプルの手書き答案で、文字の確認から採点結果の見方までを一通り試せます。サンプルの採点が成功すると、利用回数を1回分消費します。
            </p>
            {remainingCopy && <p aria-live="polite" className="mt-3 text-sm font-semibold text-slate-600">{remainingCopy}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onStart}
                disabled={primaryDisabled}
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                サンプルで体験を始める
              </button>
              <button
                type="button"
                onClick={onUseOwn}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                自分の答案を使う
              </button>
            </div>
          </div>
        )}

        {step === 'select' && (
          <div>
            <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-start">
              <Image
                src={SAMPLE_TRIAL.imagePath}
                alt="問五の問題文と手書き答案が写ったサンプル画像"
                width={815}
                height={1530}
                className="mx-auto h-64 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain sm:h-80"
              />
              <div>
                <p className="text-sm font-bold text-indigo-700">採点する問題</p>
                <h3 className="mt-1 text-xl font-extrabold text-slate-950">サンプル問5・10点</h3>
                <p className="mt-3 text-sm leading-7 text-slate-700">{SAMPLE_TRIAL.problemCondition}</p>
                <button
                  type="button"
                  onClick={onRead}
                  disabled={primaryDisabled}
                  className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  この問題の文字を読み取る
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div>
            <h3 className="text-xl font-extrabold text-slate-950">読み取り結果を確認</h3>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              下の読み取り結果を確認し、必要なら文字を直してから、画面にある「採点を開始」を押します。
            </p>
            <a
              href="#tutorial-confirm"
              className="mt-4 inline-flex text-sm font-bold text-indigo-700 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              読み取り結果へ移動
            </a>
          </div>
        )}

        {step === 'score' && (
          <div>
            <h3 className="text-xl font-extrabold text-slate-950">点数を見る</h3>
            <p className="mt-2 text-sm leading-7 text-slate-700">採点後、画面の点数とコメントを確認します。</p>
            <a href="#tutorial-score" className="mt-4 inline-flex text-sm font-bold text-indigo-700 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              点数の表示へ移動
            </a>
          </div>
        )}

        {step === 'deductions' && (
          <div>
            <h3 className="text-xl font-extrabold text-slate-950">減点理由を確認</h3>
            <p className="mt-2 text-sm leading-7 text-slate-700">どの内容が足りなかったかを、画面の減点理由で確かめます。</p>
            <a href="#tutorial-deductions" className="mt-4 inline-flex text-sm font-bold text-indigo-700 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              減点理由の表示へ移動
            </a>
          </div>
        )}

        {step === 'rewrite' && (
          <div>
            <h3 className="text-xl font-extrabold text-slate-950">書き直しを見る</h3>
            <p className="mt-2 text-sm leading-7 text-slate-700">画面の書き直し例を参考にして、次の答案で補う内容を考えます。</p>
            <a href="#tutorial-rewrite" className="mt-4 inline-flex text-sm font-bold text-indigo-700 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              書き直し例の表示へ移動
            </a>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          {(step === 'score' || step === 'deductions' || step === 'rewrite') && (
            <button
              type="button"
              onClick={onNext}
              disabled={busy}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              次へ
            </button>
          )}
          {step === 'confirm' && <span className="text-sm font-semibold text-slate-500">採点が終わると次の案内へ進みます。</span>}
          {step === 'intro' && <span aria-hidden="true" />}
          <ContinueLater onSkip={onSkip} />
        </div>
      </div>
    </section>
  );
}
