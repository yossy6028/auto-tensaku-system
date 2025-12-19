'use client';

import React from 'react';
import { useAuth } from './AuthProvider';
import { Loader2, AlertCircle, CheckCircle, Infinity, TrendingUp, Gift } from 'lucide-react';
import Link from 'next/link';

interface UsageStatusProps {
  compact?: boolean;
  className?: string;
}

export function UsageStatus({ compact = false, className = '' }: UsageStatusProps) {
  const { usageInfo, subscription, isLoading, user, profile, session, freeAccessInfo, systemSettings } = useAuth();

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

  // 無料体験中のユーザー
  const isTrial = usageInfo.accessType === 'trial';
  const isTrialExpired = freeAccessInfo?.freeAccessType === 'expired';
  const trialUsageLimit = systemSettings?.freeTrialUsageLimit || 3;

  // 管理者アカウントの場合はsubscriptionチェックをスキップ
  // 無料体験中のユーザーもsubscriptionチェックをスキップ
  if (!subscription && !isAdmin && !isTrial && !isTrialExpired) {
    return (
      <div className={`flex items-center text-amber-600 ${className}`}>
        <AlertCircle className="w-4 h-4 mr-2" />
        <span className="text-sm">プランを購入してください</span>
      </div>
    );
  }

  // 無料体験終了（回数使い切り or 期間終了）
  if (isTrialExpired || (isTrial && usageInfo.remainingCount === 0)) {
    if (compact) {
      return (
        <Link href="/pricing" className={`flex items-center text-red-600 hover:text-red-700 ${className}`}>
          <AlertCircle className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium">無料体験終了 - プランを購入</span>
        </Link>
      );
    }

    return (
      <div className={`bg-white rounded-2xl shadow-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">利用状況</h3>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
            無料体験終了
          </span>
        </div>

        <div className="mb-4">
          <span className="text-sm text-slate-500">ステータス</span>
          <p className="text-xl font-bold text-red-600">無料体験が終了しました</p>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">使用回数</span>
            <span className="font-medium text-slate-700">
              {trialUsageLimit} / {trialUsageLimit}回（全て使用済み）
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full bg-red-500 w-full" />
          </div>
        </div>

        <Link
          href="/pricing"
          className="flex items-center justify-center w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg transition-all"
        >
          プランを購入する
        </Link>
      </div>
    );
  }

  const isUnlimited = usageInfo.usageLimit === null;
  const usagePercent = isUnlimited 
    ? 0 
    : ((usageInfo.usageCount ?? 0) / (usageInfo.usageLimit ?? 1)) * 100;
  const isLowRemaining = !isUnlimited && (usageInfo.remainingCount ?? 0) <= 3;

  if (compact) {
    // 無料体験中のcompact表示
    if (isTrial) {
      return (
        <div className={`flex items-center ${className}`}>
          <Gift className="w-4 h-4 text-amber-500 mr-2" />
          <span className="text-sm font-medium text-amber-600">
            無料体験 {usageInfo.usageCount ?? 0}/{trialUsageLimit}回使用
          </span>
        </div>
      );
    }

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

  // 無料体験中の通常表示
  if (isTrial) {
    const trialUsageCount = usageInfo.usageCount ?? 0;
    const trialRemaining = usageInfo.remainingCount ?? 0;
    const trialPercent = (trialUsageCount / trialUsageLimit) * 100;

    return (
      <div className={`bg-white rounded-2xl shadow-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">利用状況</h3>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
            無料体験中
          </span>
        </div>

        <div className="mb-4">
          <span className="text-sm text-slate-500">ステータス</span>
          <p className="text-xl font-bold text-amber-600 flex items-center">
            <Gift className="w-5 h-5 mr-2" />
            無料体験
          </p>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">使用回数</span>
            <span className="font-medium text-slate-700">
              {trialUsageCount} / {trialUsageLimit}回
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                trialPercent >= 100
                  ? 'bg-red-500'
                  : trialPercent >= 66
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-amber-400 to-orange-500'
              }`}
              style={{ width: `${Math.min(trialPercent, 100)}%` }}
            />
          </div>
        </div>

        <div className={`flex items-center justify-center p-4 rounded-xl ${
          trialRemaining <= 1 ? 'bg-amber-50' : 'bg-amber-50/50'
        }`}>
          <Gift className={`w-6 h-6 mr-2 ${trialRemaining <= 1 ? 'text-amber-500' : 'text-amber-400'}`} />
          <div>
            <span className={`text-2xl font-black ${trialRemaining <= 1 ? 'text-amber-600' : 'text-amber-500'}`}>
              {trialRemaining}
            </span>
            <span className="text-slate-500 ml-1">回残り</span>
          </div>
        </div>

        {freeAccessInfo?.trialDaysRemaining !== null && freeAccessInfo?.trialDaysRemaining !== undefined && (
          <p className="text-sm text-slate-500 text-center mt-3">
            体験期間残り: <span className="font-bold">{freeAccessInfo.trialDaysRemaining}日</span>
          </p>
        )}

        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
          <p className="text-sm text-indigo-700 text-center">
            無料体験後も引き続きご利用いただくには、
            <Link href="/pricing" className="font-bold underline ml-1 hover:text-indigo-900">
              プランを購入
            </Link>
            してください
          </p>
        </div>
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



