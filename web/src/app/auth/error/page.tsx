import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

interface AuthErrorPageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { reason } = await searchParams;
  const isConfirmationError = reason === 'confirmation_invalid';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-slate-900">認証リンクを確認できませんでした</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {isConfirmationError
            ? 'リンクが無効か、期限が切れています。新規登録画面から確認メールを再度お申し込みください。'
            : 'ログインリンクが無効か、期限が切れています。ログイン画面からもう一度お試しください。'}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-bold text-white shadow-lg transition hover:shadow-xl"
        >
          ログインに戻る
        </Link>
      </section>
    </main>
  );
}
