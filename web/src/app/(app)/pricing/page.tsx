'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Sparkles, Zap, Crown, RefreshCw, HelpCircle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { AuthModal } from '@/components/AuthModal';

const plans = [
  {
    name: 'ライト',
    originalPrice: 1480,
    price: 980,
    period: '月額',
    description: '家庭での自己採点向け',
    features: [
      'AI自動添削',
      '詳細なフィードバック',
      '書き直し例の提示',
    ],
    limit: '10回/月',
    icon: Zap,
    color: 'emerald',
    popular: false,
    gradient: 'from-emerald-400 to-teal-500',
    shadow: 'shadow-emerald-500/20',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
    planKey: 'light',
  },
  {
    name: 'スタンダード',
    originalPrice: 3980,
    price: 1980,
    period: '月額',
    description: '中小規模の個人塾・フリーランス講師向け',
    features: [
      'AI自動添削',
      '詳細なフィードバック',
      '書き直し例の提示',
    ],
    limit: '30回/月',
    icon: Sparkles,
    color: 'indigo',
    popular: true,
    gradient: 'from-indigo-500 via-purple-500 to-violet-500',
    shadow: 'shadow-indigo-500/30',
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    text: 'text-indigo-600',
    badge: 'bg-indigo-100 text-indigo-700',
    planKey: 'standard',
  },
  {
    name: '無制限',
    originalPrice: 9800,
    price: 4980,
    period: '月額',
    description: '中規模・大規模の集団塾向け',
    features: [
      'AI自動添削',
      '詳細なフィードバック',
      '書き直し例の提示',
    ],
    limit: '無制限',
    icon: Crown,
    color: 'amber',
    popular: false,
    gradient: 'from-amber-400 to-orange-500',
    shadow: 'shadow-amber-500/20',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
    planKey: 'unlimited',
  },
];

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<'success' | 'cancelled' | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{ key: string; name: string } | null>(null);

  // AuthProviderから認証状態を取得
  const { user, isLoading: authLoading } = useAuth();

  // ログイン成功後にpendingPlanのcheckoutを自動実行
  useEffect(() => {
    if (user && pendingPlan) {
      setIsAuthModalOpen(false);
      const { key, name } = pendingPlan;
      setPendingPlan(null);
      handleSelectPlan(key, name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingPlan]);

  // Checkoutの結果をチェック
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      setCheckoutStatus('success');
      // 3秒後にサブスクリプション管理ページにリダイレクト
      setTimeout(() => {
        router.push('/subscription');
      }, 3000);
    } else if (checkout === 'cancelled') {
      setCheckoutStatus('cancelled');
      // 5秒後にステータスをクリア
      setTimeout(() => {
        setCheckoutStatus(null);
        // URLパラメータをクリア
        router.replace('/pricing');
      }, 5000);
    }
  }, [searchParams, router]);

  // プラン選択ハンドラー
  const handleSelectPlan = async (planKey: string, planName: string) => {
    console.log('[Pricing] handleSelectPlan called:', { planKey, planName, user, authLoading });
    
    // 認証ローディング中は待機
    if (authLoading) {
      console.log('[Pricing] Auth still loading, waiting...');
      return;
    }
    
    // 未ログインの場合はAuthModalを表示
    if (!user) {
      console.log('[Pricing] User is null, showing auth modal');
      setPendingPlan({ key: planKey, name: planName });
      setIsAuthModalOpen(true);
      return;
    }

    console.log('[Pricing] User is logged in, proceeding to checkout');
    setLoadingPlan(planKey);

    try {
      console.log('[Pricing] Calling /api/stripe/checkout with planName:', planName);
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planName: planName,
        }),
      });

      const data = await response.json();
      console.log('[Pricing] API response:', { status: response.status, data });

      if (!response.ok) {
        throw new Error(data.error || '決済セッションの作成に失敗しました');
      }

      // Stripeの決済ページ/ポータルにリダイレクト
      if (data.redirectUrl) {
        console.log('[Pricing] Redirecting to:', data.redirectUrl);
        window.location.href = data.redirectUrl;
      }
    } catch (error) {
      console.error('[Pricing] Checkout error:', error);
      alert(error instanceof Error ? error.message : '決済処理中にエラーが発生しました');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 font-sans text-slate-900">
      {/* Background Decoration (Same as Top Page) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[100px] animate-pulse-slow"></div>
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-violet-400/20 blur-[100px] animate-pulse-slow delay-1000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] rounded-full bg-blue-400/20 blur-[100px] animate-pulse-slow delay-2000"></div>
      </div>

      {/* Checkout Status Banner */}
      {checkoutStatus === 'success' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white py-4 px-6 flex items-center justify-center shadow-lg animate-slide-down">
          <CheckCircle className="w-6 h-6 mr-3" />
          <span className="font-bold">お申し込みが完了しました！利用状況ページに移動します...</span>
        </div>
      )}
      {checkoutStatus === 'cancelled' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white py-4 px-6 flex items-center justify-center shadow-lg animate-slide-down">
          <XCircle className="w-6 h-6 mr-3" />
          <span className="font-bold">決済がキャンセルされました。いつでも再度お申し込みいただけます。</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Back Link */}
        <Link
          href="/grading"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium mb-12 transition-all group hover:bg-indigo-50 px-4 py-2 rounded-full"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          トップページに戻る
        </Link>

        {/* Header */}
        <div className="text-center mb-20 relative">
          {/* 期間限定バナー */}
          <div className="mb-8 inline-block animate-bounce-slow">
            <div className="relative group cursor-default">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
              <div className="relative px-8 py-3 bg-white rounded-full leading-none flex items-center shadow-lg">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 font-bold text-lg">
                  🎊 期間限定キャンペーン実施中！ 🎊
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-slate-800 tracking-tight mb-6 drop-shadow-sm">
            料金プラン
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            あなたの学習スタイルに合わせて、<br className="hidden sm:block" />
            最適なプランをお選びください
          </p>

          {/* 特価強調 */}
          <div className="mt-8 inline-block relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/40 to-orange-500/40 blur-xl rounded-2xl transform group-hover:scale-110 transition-transform duration-500"></div>
            <div className="relative bg-white/80 backdrop-blur-xl border border-yellow-400 rounded-2xl px-8 py-4 shadow-xl">
              <p className="text-yellow-800 font-bold text-lg">
                ✨ 今だけ全プラン <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-600 text-2xl font-black">期間限定特価</span> でご提供中！ ✨
              </p>
            </div>
          </div>
        </div>

        {/* Reset Notice */}
        <div className="max-w-3xl mx-auto mb-16 space-y-6">
          <div className="bg-blue-50/80 backdrop-blur-md border border-blue-200 rounded-2xl p-6 flex items-start shadow-lg shadow-blue-100">
            <div className="bg-blue-100 rounded-full p-3 mr-5 flex-shrink-0">
              <RefreshCw className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-blue-800 mb-2 text-lg">回数リセットについて</h3>
              <p className="text-blue-700 leading-relaxed">
                ライト・スタンダードプランの採点回数は、<strong className="text-blue-900 border-b border-blue-300">ご契約日から30日ごとに自動的にリセット</strong>されます。
                未使用分の翌月繰り越しはありませんので、ご了承ください。
                <span className="block mt-2 text-sm opacity-80">※ 無制限プランは回数制限がないため、リセットの対象外です。</span>
              </p>
            </div>
          </div>
          
          <div className="bg-amber-50/80 backdrop-blur-md border border-amber-200 rounded-2xl p-6 flex items-start shadow-lg shadow-amber-100">
            <div className="bg-amber-100 rounded-full p-3 mr-5 flex-shrink-0">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-amber-800 mb-2 text-lg">デバイス制限について</h3>
              <p className="text-amber-700 leading-relaxed">
                すべてのプランにおいて、<strong className="text-amber-900 border-b border-amber-300">1アカウントあたり最大2台のデバイス</strong>でのみご利用いただけます。
                塾や学校で複数の教室でアカウントを共有することは利用規約で禁止されています。
                <span className="block mt-2 text-sm opacity-80">※ デバイス制限の詳細については、<Link href="/privacy" className="underline hover:text-amber-900">利用規約・プライバシーポリシー</Link>をご確認ください。</span>
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 mb-24 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isLoading = loadingPlan === plan.planKey;

            return (
              <div
                key={plan.name}
                className={`relative group flex flex-col h-full rounded-[2.5rem] transition-all duration-500 ${plan.popular
                    ? 'bg-white border-2 border-indigo-400 shadow-2xl shadow-indigo-200 scale-105 z-10'
                    : 'bg-white/80 border border-slate-200 hover:bg-white hover:border-indigo-200 hover:shadow-xl hover:-translate-y-2'
                  } backdrop-blur-xl overflow-hidden`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500"></div>
                )}
                {plan.popular && (
                  <div className="absolute top-5 right-5">
                    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-indigo-200 flex items-center">
                      <Crown className="w-3 h-3 mr-1" />
                      人気No.1
                    </div>
                  </div>
                )}

                <div className="p-8 flex-grow">
                  {/* Icon & Name */}
                  <div className="flex items-center mb-6">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.gradient} p-0.5 shadow-lg`}>
                      <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                        <Icon className={`w-7 h-7 ${plan.text}`} />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h2 className="text-2xl font-bold text-slate-800">{plan.name}</h2>
                      <p className="text-sm text-slate-500">{plan.description}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-8">
                    {/* 期間限定特価バッジ */}
                    <div className="mb-3">
                      <span className="inline-block bg-red-100 text-red-600 border border-red-200 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                        🎉 期間限定特価
                      </span>
                    </div>

                    {/* 本来価格 */}
                    <div className="mb-1">
                      <span className="text-slate-400 text-lg relative">
                        ¥{plan.originalPrice.toLocaleString()}
                        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-400 rotate-[-10deg]"></div>
                      </span>
                    </div>

                    {/* 特価 */}
                    <div className="flex items-baseline">
                      <span className="text-2xl text-slate-700 font-bold mr-1">¥</span>
                      <span className={`text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br ${plan.gradient}`}>
                        {plan.price.toLocaleString()}
                      </span>
                      <span className="text-slate-500 ml-2">/{plan.period}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">（税込）</p>

                    {/* 割引率 */}
                    <div className="mt-4">
                      <span className="inline-block bg-slate-100 text-slate-600 text-sm font-bold px-4 py-1.5 rounded-full border border-slate-200">
                        {Math.round((1 - plan.price / plan.originalPrice) * 100)}%OFF
                      </span>
                    </div>
                  </div>

                  {/* Limit Badge */}
                  <div className={`${plan.badge} rounded-xl px-5 py-3 text-sm font-bold inline-flex items-center mb-8 w-full justify-center`}>
                    <span className="mr-2 opacity-80">採点回数:</span>
                    <span className={`text-2xl font-black ${plan.text} drop-shadow-sm`}>{plan.limit}</span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start group/item">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${plan.gradient} p-[1px] mr-3 flex-shrink-0 mt-0.5 opacity-80 group-hover/item:opacity-100 transition-opacity`}>
                          <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                            <Check className={`w-3.5 h-3.5 ${plan.text}`} />
                          </div>
                        </div>
                        <span className="text-slate-600 group-hover/item:text-slate-900 transition-colors">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="p-8 pt-0">
                  <button
                    onClick={() => handleSelectPlan(plan.planKey, plan.name)}
                    disabled={isLoading || loadingPlan !== null || authLoading}
                    className={`w-full py-4 px-6 rounded-xl font-bold text-white transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 bg-gradient-to-r ${plan.gradient} ${plan.shadow} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center`}
                  >
                    {isLoading || authLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        処理中...
                      </>
                    ) : (
                      'このプランを選択'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-800 text-center mb-12 flex items-center justify-center">
            <HelpCircle className="w-8 h-8 mr-3 text-indigo-500" />
            よくあるご質問
          </h2>

          <div className="grid gap-6">
            {[
              {
                q: "途中でプラン変更はできますか？",
                a: "はい、いつでもプラン変更が可能です。アップグレードの場合は即時反映され、ダウングレードの場合は次回更新日から適用されます。"
              },
              {
                q: "解約はいつでもできますか？",
                a: "はい、いつでも解約可能です。解約後も、現在の契約期間終了まではサービスをご利用いただけます。"
              },
              {
                q: "回数を使い切った場合はどうなりますか？",
                a: "月の採点回数を使い切った場合、次のリセット日まで採点機能はご利用いただけません。上位プランへのアップグレードをご検討いただくか、次回リセット日までお待ちください。"
              },
              {
                q: "無料トライアルはありますか？",
                a: "初回ご登録の方には、5回分の無料採点をプレゼントしております。まずはお試しいただき、サービスの品質をご確認ください。"
              },
              {
                q: "支払い方法は何がありますか？",
                a: "クレジットカード（Visa、Mastercard、American Express、JCB）でのお支払いに対応しております。決済は安全なStripeシステムを使用しています。"
              }
            ].map((item, i) => (
              <div key={i} className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-slate-200 hover:bg-white hover:shadow-md transition-all">
                <h3 className="font-bold text-slate-800 text-lg mb-3 flex items-start">
                  <span className="text-indigo-500 mr-3 text-xl">Q.</span>
                  {item.q}
                </h3>
                <p className="text-slate-600 leading-relaxed pl-8">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingPlan(null);
        }}
      />
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </main>
    }>
      <PricingContent />
    </Suspense>
  );
}
