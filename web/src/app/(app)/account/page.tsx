'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, User, Mail, Calendar, Shield, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function AccountPage() {
  const { user, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">ログインが必要です</p>
          <Link href="/grading" className="text-indigo-600 hover:underline">
            トップページに戻る
          </Link>
        </div>
      </main>
    );
  }

  const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : '不明';

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]"></div>
      </div>

      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link
          href="/grading"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium mb-8 transition-all group"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          トップページに戻る
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">アカウント設定</h1>
          <p className="text-slate-600">アカウント情報を確認できます</p>
        </div>

        {/* Account Info Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 space-y-6">
            {/* Email */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500 mb-1">メールアドレス</p>
                <p className="text-slate-800 font-medium">{user.email}</p>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* User ID */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500 mb-1">ユーザーID</p>
                <p className="text-slate-800 font-mono text-sm break-all">{user.id}</p>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Created At */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500 mb-1">登録日</p>
                <p className="text-slate-800 font-medium">{createdAt}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100">
            <Link
              href="/subscription"
              className="block w-full text-center py-3 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              サブスクリプション管理
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

