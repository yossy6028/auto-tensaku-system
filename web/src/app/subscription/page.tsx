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
  Settings
} from 'lucide-react';

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, subscription, usageInfo, isLoading, refreshUsageInfo } = useAuth();
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

          {/* Trial Info Card (if applicable) */}
          {usageInfo?.accessType === 'trial' && (
            <div className="bg-indigo-50/80 backdrop-blur-md border border-indigo-200 rounded-2xl p-6">
              <div className="flex items-start">
                <div className="bg-indigo-100 rounded-full p-3 mr-5 flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-indigo-800 mb-2 text-lg">無料トライアル中</h3>
                  <p className="text-indigo-700 leading-relaxed">
                    現在、無料トライアル期間中です。残り <strong>{usageInfo.remainingCount}回</strong> ご利用いただけます。
                    トライアル期間終了後も引き続きご利用いただくには、プランをご購入ください。
                  </p>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    プランを見る
                    <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                  </Link>
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

