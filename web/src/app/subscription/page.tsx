'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { 
  ArrowLeft, 
  CreditCard, 
  Calendar, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  Crown,
  Sparkles,
  Zap,
  Infinity,
  ExternalLink,
  Loader2,
  Settings,
  Gift,
  Clock
} from 'lucide-react';

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, subscription, usageInfo, freeAccessInfo, systemSettings, isLoading, refreshUsageInfo } = useAuth();
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/?showAuth=true&redirect=/subscription');
    }
  }, [user, isLoading, router]);

  // Stripeカスタマーポータルを開く
  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'ポータルの起動に失敗しました');
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert(error instanceof Error ? error.message : 'エラーが発生しました');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  // プランに応じたアイコンを取得
  const getPlanIcon = (planName: string | null) => {
    if (!planName) return Zap;
    const name = planName.toLowerCase();
    if (name.includes('無制限') || name.includes('unlimited')) return Crown;
    if (name.includes('スタンダード') || name.includes('standard')) return Sparkles;
    return Zap;
  };

  // プランに応じた色を取得
  const getPlanColor = (planName: string | null) => {
    if (!planName) return { bg: 'bg-slate-100', text: 'text-slate-600', gradient: 'from-slate-400 to-slate-500' };
    const name = planName.toLowerCase();
    if (name.includes('無制限') || name.includes('unlimited')) {
      return { bg: 'bg-amber-100', text: 'text-amber-600', gradient: 'from-amber-400 to-orange-500' };
    }
    if (name.includes('スタンダード') || name.includes('standard')) {
      return { bg: 'bg-indigo-100', text: 'text-indigo-600', gradient: 'from-indigo-500 to-violet-500' };
    }
    return { bg: 'bg-emerald-100', text: 'text-emerald-600', gradient: 'from-emerald-400 to-teal-500' };
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const PlanIcon = getPlanIcon(usageInfo?.planName ?? null);
  const planColor = getPlanColor(usageInfo?.planName ?? null);
  const isUnlimited = usageInfo?.usageLimit === null;

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 font-sans text-slate-900">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] rounded-full bg-violet-400/20 blur-[100px] animate-pulse-slow delay-1000"></div>
      </div>

      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium mb-8 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          トップページに戻る
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className={`bg-gradient-to-br ${planColor.gradient} p-4 rounded-2xl shadow-xl`}>
              <CreditCard className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-4">
            サブスクリプション管理
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            現在のプランと利用状況を確認できます
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {/* Current Plan Card */}
          <div className="bg-white/60 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] overflow-hidden border border-white/60 ring-1 ring-white/50">
            <div className="p-8 md:p-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                  <Settings className="w-6 h-6 mr-3 text-indigo-500" />
                  現在のプラン
                </h2>
                {subscription?.status === 'active' && (
                  <span className="px-4 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-bold flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    有効
                  </span>
                )}
              </div>

              {subscription || usageInfo?.accessType === 'admin' ? (
                <div className="space-y-6">
                  {/* Plan Info */}
                  <div className="flex items-center">
                    <div className={`w-16 h-16 rounded-2xl ${planColor.bg} flex items-center justify-center mr-5`}>
                      <PlanIcon className={`w-8 h-8 ${planColor.text}`} />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-800">
                        {usageInfo?.planName || subscription?.plan_id || '不明なプラン'}
                      </h3>
                      <p className="text-slate-500 mt-1">
                        {usageInfo?.accessType === 'admin' ? '管理者アカウント' : 'サブスクリプション'}
                      </p>
                    </div>
                  </div>

                  {/* Usage Stats */}
                  <div className="grid md:grid-cols-2 gap-6 mt-8">
                    {/* Usage Count */}
                    <div className={`${planColor.bg} rounded-2xl p-6`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-600">使用回数</span>
                        {isUnlimited && (
                          <span className="flex items-center text-amber-600 font-bold text-sm">
                            <Infinity className="w-4 h-4 mr-1" />
                            無制限
                          </span>
                        )}
                      </div>
                      {!isUnlimited ? (
                        <>
                          <div className="flex items-baseline">
                            <span className={`text-4xl font-black ${planColor.text}`}>
                              {usageInfo?.usageCount ?? 0}
                            </span>
                            <span className="text-slate-500 ml-2">/ {usageInfo?.usageLimit}回</span>
                          </div>
                          <div className="mt-3 w-full bg-white/50 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${planColor.gradient}`}
                              style={{ width: `${Math.min(((usageInfo?.usageCount ?? 0) / (usageInfo?.usageLimit ?? 1)) * 100, 100)}%` }}
                            />
                          </div>
                          <p className="text-sm text-slate-500 mt-2">
                            残り <span className="font-bold">{usageInfo?.remainingCount ?? 0}回</span>
                          </p>
                        </>
                      ) : (
                        <div className="flex items-center">
                          <Infinity className={`w-10 h-10 ${planColor.text}`} />
                          <span className="text-xl font-bold text-slate-700 ml-3">制限なし</span>
                        </div>
                      )}
                    </div>

                    {/* Billing Period */}
                    {subscription && (
                      <div className="bg-slate-100 rounded-2xl p-6">
                        <div className="flex items-center mb-3">
                          <Calendar className="w-5 h-5 text-slate-500 mr-2" />
                          <span className="text-sm font-medium text-slate-600">請求期間</span>
                        </div>
                        <div className="space-y-2">
                          {subscription.current_period_start && (
                            <p className="text-slate-700">
                              <span className="text-sm text-slate-500">開始:</span>{' '}
                              <span className="font-medium">
                                {new Date(subscription.current_period_start).toLocaleDateString('ja-JP')}
                              </span>
                            </p>
                          )}
                          {subscription.current_period_end && (
                            <p className="text-slate-700">
                              <span className="text-sm text-slate-500">終了:</span>{' '}
                              <span className="font-medium">
                                {new Date(subscription.current_period_end).toLocaleDateString('ja-JP')}
                              </span>
                            </p>
                          )}
                          {subscription.cancel_at_period_end && (
                            <div className="mt-3 p-3 bg-amber-100 rounded-lg">
                              <p className="text-amber-700 text-sm font-medium flex items-center">
                                <AlertCircle className="w-4 h-4 mr-2" />
                                期間終了時にキャンセル予定
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {subscription?.stripe_subscription_id && (
                    <div className="mt-8 pt-8 border-t border-slate-200">
                      <h3 className="text-lg font-bold text-slate-800 mb-4">サブスクリプションの管理</h3>
                      <div className="flex flex-wrap gap-4">
                        <button
                          onClick={handleManageSubscription}
                          disabled={isLoadingPortal}
                          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoadingPortal ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              読み込み中...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-5 h-5 mr-2" />
                              支払い情報・プラン変更
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => refreshUsageInfo()}
                          className="inline-flex items-center px-6 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-all"
                        >
                          <RefreshCw className="w-5 h-5 mr-2" />
                          利用状況を更新
                        </button>
                      </div>
                      <p className="text-sm text-slate-500 mt-4">
                        ※ Stripeのカスタマーポータルで、支払い方法の変更、プランの変更、解約などが行えます。
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* No Subscription */
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-700 mb-3">
                    有効なプランがありません
                  </h3>
                  <p className="text-slate-500 mb-8 max-w-md mx-auto">
                    プランを購入すると、採点機能をご利用いただけます。
                    {usageInfo?.accessType === 'trial' && (
                      <span className="block mt-2 text-indigo-600 font-medium">
                        現在、無料トライアル期間中です。
                      </span>
                    )}
                  </p>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    プランを見る
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Free Trial Section - Enhanced */}
          {(usageInfo?.accessType === 'trial' || freeAccessInfo?.freeAccessType === 'expired') && (
            <div className={`backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] overflow-hidden border ring-1 ring-white/50 ${
              freeAccessInfo?.freeAccessType === 'expired'
                ? 'bg-amber-50/80 border-amber-200'
                : usageInfo?.remainingCount === 0
                  ? 'bg-orange-50/80 border-orange-200'
                  : 'bg-indigo-50/80 border-indigo-200'
            }`}>
              {/* Header */}
              <div className={`p-6 ${
                freeAccessInfo?.freeAccessType === 'expired'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                  : usageInfo?.remainingCount === 0
                    ? 'bg-gradient-to-r from-orange-500 to-red-500'
                    : 'bg-gradient-to-r from-indigo-500 to-violet-500'
              } text-white`}>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                    {freeAccessInfo?.freeAccessType === 'expired' || usageInfo?.remainingCount === 0 ? (
                      <Clock className="w-6 h-6" />
                    ) : (
                      <Gift className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {freeAccessInfo?.freeAccessType === 'expired'
                        ? '無料体験が終了しました'
                        : usageInfo?.remainingCount === 0
                          ? '無料体験の回数を使い切りました'
                          : '無料体験中'}
                    </h2>
                    <p className="text-white/80 text-sm mt-1">
                      {freeAccessInfo?.freeAccessType === 'expired'
                        ? 'プランを購入して引き続きご利用ください'
                        : usageInfo?.remainingCount === 0
                          ? 'プランを購入すると引き続き採点できます'
                          : `最大${systemSettings?.freeTrialUsageLimit || 3}回まで無料でお試しいただけます`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 md:p-8">
                {/* Usage Stats */}
                <div className="bg-white/60 rounded-2xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-slate-600">使用状況</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      freeAccessInfo?.freeAccessType === 'expired' || usageInfo?.remainingCount === 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {freeAccessInfo?.freeAccessType === 'expired' || usageInfo?.remainingCount === 0
                        ? '使用終了'
                        : '利用可能'}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-baseline">
                        <span className="text-3xl font-black text-slate-800">
                          {usageInfo?.usageCount ?? ((systemSettings?.freeTrialUsageLimit || 3) - (freeAccessInfo?.trialUsageRemaining ?? 0))}
                        </span>
                        <span className="text-slate-500 ml-2">/ {systemSettings?.freeTrialUsageLimit || 3}回使用</span>
                      </div>
                      <span className={`font-bold ${
                        usageInfo?.remainingCount === 0 || freeAccessInfo?.freeAccessType === 'expired'
                          ? 'text-red-600'
                          : 'text-indigo-600'
                      }`}>
                        残り {usageInfo?.remainingCount ?? freeAccessInfo?.trialUsageRemaining ?? 0}回
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usageInfo?.remainingCount === 0 || freeAccessInfo?.freeAccessType === 'expired'
                            ? 'bg-gradient-to-r from-red-400 to-orange-500'
                            : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            ((usageInfo?.usageCount ?? ((systemSettings?.freeTrialUsageLimit || 3) - (freeAccessInfo?.trialUsageRemaining ?? 0)))
                            / (systemSettings?.freeTrialUsageLimit || 3)) * 100,
                            100
                          )}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Trial Period Info */}
                  {freeAccessInfo?.trialDaysRemaining !== null && freeAccessInfo?.trialDaysRemaining !== undefined && (
                    <p className="text-sm text-slate-500 flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      体験期間の残り日数: <span className="font-bold text-slate-700 ml-1">{freeAccessInfo.trialDaysRemaining}日</span>
                    </p>
                  )}
                </div>

                {/* CTA */}
                <div className="space-y-4">
                  <Link
                    href="/pricing"
                    className={`flex items-center justify-center w-full py-4 px-6 font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all ${
                      freeAccessInfo?.freeAccessType === 'expired' || usageInfo?.remainingCount === 0
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                        : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 mr-2" />
                    {freeAccessInfo?.freeAccessType === 'expired' || usageInfo?.remainingCount === 0
                      ? 'プランを購入する'
                      : 'プラン一覧を見る'}
                  </Link>

                  {usageInfo?.remainingCount !== 0 && freeAccessInfo?.freeAccessType !== 'expired' && (
                    <p className="text-sm text-center text-slate-500">
                      残り回数を使い切るまで無料でお試しいただけます
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* FAQ Section */}
          <div className="bg-white/60 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] overflow-hidden border border-white/60 ring-1 ring-white/50 p-8 md:p-10">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">よくある質問</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-slate-700 mb-2">回数のリセットはいつですか？</h3>
                <p className="text-slate-600">
                  採点回数は、ご契約日から30日ごとに自動的にリセットされます。
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-700 mb-2">プランの変更はできますか？</h3>
                <p className="text-slate-600">
                  はい、「支払い情報・プラン変更」ボタンからいつでも変更できます。アップグレードは即時反映、ダウングレードは次回更新日から適用されます。
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-700 mb-2">解約するとどうなりますか？</h3>
                <p className="text-slate-600">
                  解約後も現在の請求期間終了までサービスをご利用いただけます。その後、採点機能はご利用いただけなくなります。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <Link
            href="/"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium transition-colors px-6 py-3 rounded-full bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
          >
            トップページに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}

