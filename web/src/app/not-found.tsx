import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-slate-300 mb-4">404</h1>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          ページが見つかりません
        </h2>
        <p className="text-slate-600 mb-8">
          お探しのページは移動または削除された可能性があります。
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          トップページに戻る
        </Link>
      </div>
    </div>
  );
}
