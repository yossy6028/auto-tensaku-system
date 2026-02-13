'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-slate-300 mb-4">500</h1>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          エラーが発生しました
        </h2>
        <p className="text-slate-600 mb-8">
          申し訳ございません。しばらく時間をおいてから再度お試しください。
        </p>
        <button
          onClick={reset}
          className="inline-block px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          再試行する
        </button>
      </div>
    </div>
  );
}
