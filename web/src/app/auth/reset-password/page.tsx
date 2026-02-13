'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isValidSession, setIsValidSession] = useState(false);

  useEffect(() => {
    // パスワードリセットセッションが有効か確認
    const checkSession = async () => {
      const supabase = createClient();
      const code = searchParams.get('code');
      const queryType = searchParams.get('type');
      const invalidLinkText = 'パスワードリセットリンクが無効または期限切れです。再度パスワードリセットを申請してください。';

      // クエリパラメータでのPKCEコードを優先して処理（/auth/callback経由のnext遷移用）
      if (code && queryType === 'recovery') {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            setIsValidSession(true);
            return;
          }
          setMessage({ type: 'error', text: invalidLinkText });
          return;
        } catch (err) {
          console.error('Session exchange error:', err);
          setMessage({ type: 'error', text: invalidLinkText });
          return;
        }
      }
      
      // パスワードリセットトークンが含まれているか確認
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      if (accessToken && type === 'recovery') {
        // フラグメントからトークンが取得できた場合
        // Supabaseクライアントが自動的にフラグメントを処理するのを待つ
        try {
          // 少し待ってからセッションを確認（Supabaseがフラグメントを処理する時間を確保）
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (session && !error) {
            setIsValidSession(true);
          } else {
            // セッションが確立されていない場合、エラーメッセージを表示
            setMessage({ 
              type: 'error', 
              text: invalidLinkText 
            });
          }
        } catch (err) {
          console.error('Session check error:', err);
          setMessage({ 
            type: 'error', 
            text: 'パスワードリセットリンクの処理中にエラーが発生しました。再度パスワードリセットを申請してください。' 
          });
        }
      } else {
        // フラグメントがない場合、既存のセッションを確認
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsValidSession(true);
        } else {
          setMessage({ 
            type: 'error', 
            text: invalidLinkText 
          });
        }
      }
    };

    checkSession();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    // バリデーション
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'パスワードは6文字以上で入力してください。' });
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'パスワードが一致しません。' });
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      
      // パスワードを更新
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ 
          type: 'success', 
          text: 'パスワードが正常に変更されました。ログインページにリダイレクトします...' 
        });
        
        // 3秒後にログインページにリダイレクト
        setTimeout(() => {
          router.push('/?password_reset=success');
        }, 3000);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'エラーが発生しました';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
            <h1 className="text-2xl font-bold">パスワードリセット</h1>
            <p className="text-indigo-100 mt-1">新しいパスワードを設定してください</p>
          </div>

          {/* Content */}
          <div className="p-6">
            {message && (
              <div className={`mb-4 p-4 rounded-xl flex items-start ${
                message.type === 'success' 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                )}
                <span className="text-sm">{message.text}</span>
              </div>
            )}

            {isValidSession ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    新しいパスワード
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      minLength={6}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">6文字以上で入力してください</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    パスワード（確認）
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      minLength={6}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      更新中...
                    </>
                  ) : (
                    'パスワードを更新'
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-600 mb-4">
                  パスワードリセットリンクが無効または期限切れです。
                </p>
                <Link
                  href="/grading"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  トップページに戻る
                </Link>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-center text-sm text-slate-600">
                <Link
                  href="/grading"
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  ログインページに戻る
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
            <p className="text-slate-600">読み込み中...</p>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

