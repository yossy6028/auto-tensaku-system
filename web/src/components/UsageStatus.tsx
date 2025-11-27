'use client';

import React from 'react';
import { useAuth } from './AuthProvider';
import { Loader2, AlertCircle, CheckCircle, Infinity, TrendingUp } from 'lucide-react';

interface UsageStatusProps {
  compact?: boolean;
  className?: string;
}

export function UsageStatus({ compact = false, className = '' }: UsageStatusProps) {
  const { usageInfo, subscription, isLoading, user, profile, session } = useAuth();

  // ユーザーまたはセッションがない場合は何も表示しない
  if (!user || !session) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`flex items-center text-slate-500 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  // 管理者アカウントのチェック（usageInfoが取得される前でも判定できるように）
  const isAdmin = profile?.role === 'admin' || usageInfo?.accessType === 'admin';
  
  // usageInfoがまだ取得されていない場合は、読み込み中として扱う（管理者の場合は特に待つ）
  if (!usageInfo) {
    // 管理者の場合は取得されるまで待つ
    if (isAdmin) {
      return null;
    }
    // 通常ユーザーの場合も、まだ読み込み中の可能性があるため表示しない
    return null;
  }

  // 管理者アカウントの場合はsubscriptionチェックをスキップ
  if (!subscription && !isAdmin) {
    return (
      <div className={`flex items-center text-amber-600 ${className}`}>
        <AlertCircle className="w-4 h-4 mr-2" />
        <span className="text-sm">プランを購入してください</span>
      </div>
    );
  }

  const isUnlimited = usageInfo.usageLimit === null;
  const usagePercent = isUnlimited 
    ? 0 
    : ((usageInfo.usageCount ?? 0) / (usageInfo.usageLimit ?? 1)) * 100;
  const isLowRemaining = !isUnlimited && (usageInfo.remainingCount ?? 0) <= 3;

  if (compact) {
    return (
      <div className={`flex items-center ${className}`}>
        {usageInfo.canUse ? (
          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
        ) : (
          <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
        )}
        <span className={`text-sm font-medium ${isLowRemaining ? 'text-amber-600' : 'text-slate-600'}`}>
          {isUnlimited ? (
            <span className="flex items-center">
              <Infinity className="w-4 h-4 mr-1" />
              無制限
            </span>
          ) : (
            `残り ${usageInfo.remainingCount}回`
          )}
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800">利用状況</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          usageInfo.canUse 
            ? 'bg-green-100 text-green-700' 
            : 'bg-red-100 text-red-700'
        }`}>
          {usageInfo.canUse ? '利用可能' : '利用不可'}
        </span>
      </div>

      {/* Plan name */}
      <div className="mb-4">
        <span className="text-sm text-slate-500">現在のプラン</span>
        <p className="text-xl font-bold text-slate-800">{usageInfo.planName}</p>
      </div>

      {/* Usage bar */}
      {!isUnlimited && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">使用回数</span>
            <span className={`font-medium ${isLowRemaining ? 'text-amber-600' : 'text-slate-700'}`}>
              {usageInfo.usageCount} / {usageInfo.usageLimit}回
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                usagePercent >= 90 
                  ? 'bg-red-500' 
                  : usagePercent >= 70 
                  ? 'bg-amber-500' 
                  : 'bg-gradient-to-r from-indigo-500 to-violet-500'
              }`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Remaining or unlimited */}
      <div className={`flex items-center justify-center p-4 rounded-xl ${
        isUnlimited 
          ? 'bg-indigo-50' 
          : isLowRemaining 
          ? 'bg-amber-50' 
          : 'bg-slate-50'
      }`}>
        {isUnlimited ? (
          <>
            <Infinity className="w-6 h-6 text-indigo-500 mr-2" />
            <span className="text-lg font-bold text-indigo-700">無制限でご利用いただけます</span>
          </>
        ) : (
          <>
            <TrendingUp className={`w-6 h-6 mr-2 ${isLowRemaining ? 'text-amber-500' : 'text-slate-500'}`} />
            <div>
              <span className={`text-2xl font-black ${isLowRemaining ? 'text-amber-600' : 'text-slate-800'}`}>
                {usageInfo.remainingCount}
              </span>
              <span className="text-slate-500 ml-1">回残り</span>
            </div>
          </>
        )}
      </div>

      {/* Warning for low remaining */}
      {isLowRemaining && !isUnlimited && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              残り回数が少なくなっています。継続してご利用される場合は、プランの追加購入をご検討ください。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}



