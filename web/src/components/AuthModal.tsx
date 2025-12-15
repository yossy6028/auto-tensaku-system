'use client';

import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

type AuthMode = 'signin' | 'signup' | 'magic' | 'reset';

export function AuthModal({ isOpen, onClose, initialMode = 'signin' }: AuthModalProps) {
  const { signInWithEmail, signInWithPassword, signUp, resetPassword, user } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ログイン成功時にモーダルを自動的に閉じる
  useEffect(() => {
    if (user && isOpen && mode === 'signin') {
      // ユーザーがログインしたら少し待ってからモーダルを閉じる
      const timer = setTimeout(() => {
        onClose();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, isOpen, mode, onClose]);

  // initialModeが変更されたらmodeを更新
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setMessage(null);
      setEmail('');
      setPassword('');
    }
  }, [isOpen, initialMode]);

  // パスワードリセット成功時にメッセージを表示
  useEffect(() => {
    if (mode === 'reset' && message?.type === 'success') {
      // 成功メッセージ表示後、3秒後にログインモードに戻す
      const timer = setTimeout(() => {
        setMode('signin');
        setMessage(null);
        setEmail('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [mode, message]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      let result;

      if (mode === 'magic') {
        result = await signInWithEmail(email);
        if (!result.error) {
          setMessage({ type: 'success', text: 'ログインリンクをメールで送信しました。メールをご確認ください。' });
          setEmail('');
        }
      } else if (mode === 'reset') {
        result = await resetPassword(email);
        if (!result.error) {
          setMessage({ type: 'success', text: 'パスワードリセットリンクをメールで送信しました。メールをご確認ください。' });
          setEmail('');
        }
      } else if (mode === 'signin') {
        result = await signInWithPassword(email, password);
        // ログイン成功時はuseEffectで自動的にモーダルが閉じられる
      } else {
        result = await signUp(email, password);
        if (!result.error) {
          setMessage({ type: 'success', text: '確認メールを送信しました。メールをご確認ください。' });
          setEmail('');
          setPassword('');
        }
      }

      if (result?.error) {
        setMessage({ type: 'error', text: result.error.message });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'エラーが発生しました';
      setMessage({ type: 'error', text: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold">
            {mode === 'signin' ? 'ログイン' : 
             mode === 'signup' ? '新規登録' : 
             mode === 'reset' ? 'パスワードリセット' :
             'マジックリンク'}
          </h2>
          <p className="text-indigo-100 mt-1">
            {mode === 'signin' ? 'アカウントにログインしてください' : 
             mode === 'signup' ? '新しいアカウントを作成' : 
             mode === 'reset' ? 'メールアドレスを入力してパスワードリセットリンクを受け取る' :
             'メールでログインリンクを受け取る'}
          </p>
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                メールアドレス
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="email@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {mode !== 'magic' && mode !== 'reset' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  パスワード
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
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  処理中...
                </>
              ) : (
                mode === 'signin' ? 'ログイン' : 
                mode === 'signup' ? '登録する' : 
                mode === 'reset' ? 'リセットリンクを送信' :
                'リンクを送信'
              )}
            </button>
          </form>

          {/* Mode switchers */}
          <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
            {mode === 'signin' && (
              <>
                <button
                  onClick={() => { setMode('magic'); setMessage(null); }}
                  className="w-full text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  パスワードなしでログイン（マジックリンク）
                </button>
                <button
                  onClick={() => { setMode('reset'); setMessage(null); }}
                  className="w-full text-center text-sm text-slate-600 hover:text-slate-800"
                >
                  パスワードを忘れた場合
                </button>
                <p className="text-center text-sm text-slate-600">
                  アカウントをお持ちでない方は{' '}
                  <button
                    onClick={() => { setMode('signup'); setMessage(null); }}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    新規登録
                  </button>
                </p>
              </>
            )}
            {mode === 'signup' && (
              <p className="text-center text-sm text-slate-600">
                すでにアカウントをお持ちの方は{' '}
                <button
                  onClick={() => { setMode('signin'); setMessage(null); }}
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  ログイン
                </button>
              </p>
            )}
            {mode === 'magic' && (
              <>
                <p className="text-center text-sm text-slate-600">
                  <button
                    onClick={() => { setMode('signin'); setMessage(null); }}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    パスワードでログイン
                  </button>
                </p>
                <button
                  onClick={() => { setMode('reset'); setMessage(null); }}
                  className="w-full text-center text-sm text-slate-600 hover:text-slate-800"
                >
                  パスワードを忘れた場合
                </button>
              </>
            )}
            {mode === 'reset' && (
              <p className="text-center text-sm text-slate-600">
                <button
                  onClick={() => { setMode('signin'); setMessage(null); }}
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  ログインに戻る
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


