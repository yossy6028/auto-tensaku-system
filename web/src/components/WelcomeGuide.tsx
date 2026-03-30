'use client';

import React, { useSyncExternalStore } from 'react';
import { X, ArrowRight, Sparkles, FileText, Camera, CheckCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const STORAGE_KEY = 'taskal-welcome-guide-dismissed';
const STORAGE_EVENT = 'taskal-welcome-guide-changed';

const readDismissedSnapshot = (): boolean => {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return true;
  }
};

const subscribeToDismissedState = (callback: () => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleChange = () => callback();
  window.addEventListener('storage', handleChange);
  window.addEventListener(STORAGE_EVENT, handleChange);

  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(STORAGE_EVENT, handleChange);
  };
};

type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    icon: FileText,
    title: '問題番号を入力',
    description: '「問1」「大問1(1)」など、採点したい問題の番号を入力します。',
  },
  {
    icon: Camera,
    title: '答案の写真をアップロード',
    description: 'スマホで撮影した答案画像をアップロード。模範解答も添付するとより正確に。',
  },
  {
    icon: CheckCircle,
    title: 'AIが即座に添削',
    description: '数秒で採点結果とフィードバックが届きます。間違いのポイントも丁寧に解説。',
  },
];

type Props = {
  remainingCount: number;
  onStartTrial: () => void;
};

export function WelcomeGuide({ remainingCount, onStartTrial }: Props) {
  const dismissed = useSyncExternalStore(
    subscribeToDismissedState,
    readDismissedSnapshot,
    () => true
  );

  if (dismissed || steps.length === 0) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch {
      // localStorage が使えない環境では UI を維持するだけに留める
    }
  };

  const handleStart = () => {
    handleDismiss();
    onStartTrial();
  };

  return (
    <div className="relative bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 rounded-3xl border border-indigo-100 shadow-lg shadow-indigo-100/50 p-8 md:p-10 mb-8 overflow-hidden">
      {/* 装飾背景 */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-200/30 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-violet-200/30 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />

      {/* 閉じるボタン */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10"
        aria-label="閉じる"
      >
        <X className="w-5 h-5" />
      </button>

      {/* ヘッダー */}
      <div className="relative text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          無料体験 残り{remainingCount}回
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
          はじめての AI 添削、<span className="text-indigo-600">3ステップ</span>で完了
        </h2>
        <p className="text-slate-500">アカウント作成ありがとうございます！以下の手順で、すぐに AI 添削をお試しいただけます。</p>
      </div>

      {/* ステップ */}
      <div className="relative grid md:grid-cols-3 gap-6 mb-8">
        {steps.map((step, i) => (
          <div key={i} className="relative bg-white/80 backdrop-blur rounded-2xl p-6 border border-white shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-sm font-bold shadow-md">
                {i + 1}
              </div>
              <step.icon className="w-5 h-5 text-indigo-500" />
            </div>
            <h3 className="font-bold text-slate-800 mb-1">{step.title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="relative text-center">
        <button
          onClick={handleStart}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-indigo-300/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          さっそく始める
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
