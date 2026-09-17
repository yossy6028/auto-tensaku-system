'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/components/AuthProvider';

/** 既存の認証モーダルをログイン専用の入口として開く。 */
export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/grading');
    }
  }, [isLoading, router, user]);

  if (isLoading || user) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600"
        aria-busy="true"
      >
        ログイン情報を確認中…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <AuthModal
        isOpen
        onClose={() => router.push('/')}
        initialMode="signin"
      />
    </main>
  );
}
