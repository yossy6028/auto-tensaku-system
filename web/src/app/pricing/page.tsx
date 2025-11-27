'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Sparkles, Zap, Crown, RefreshCw, HelpCircle } from 'lucide-react';

const plans = [
  {
    name: 'ライト',
    originalPrice: 1480,
    price: 980,
    period: '月額',
    description: '気軽に始めたい方向け',
    features: [
      '月10回まで採点可能',
      '詳細なフィードバック',
      '書き直し例の提示',
      'メールサポート',
    ],
    limit: '10回/月',
    icon: Zap,
    color: 'emerald',
    popular: false,
    gradient: 'from-emerald-400 to-teal-500',
    shadow: 'shadow-emerald-500/20',
  },
  {
    name: 'スタンダード',
    originalPrice: 2980,
    price: 1980,
    period: '月額',
    description: '定期的に学習したい方に',
    features: [
      '月30回まで採点可能',
      '詳細なフィードバック',
      '書き直し例の提示',
      'メールサポート',
      '優先サポート',
    ],
    limit: '30回/月',
    icon: Sparkles,
    color: 'indigo',
    popular: true,
    gradient: 'from-indigo-500 via-purple-500 to-violet-500',
    shadow: 'shadow-indigo-500/30',
  },
  {
    name: '無制限',
    originalPrice: 5980,
    price: 3980,
    period: '月額',
    description: '本格的に受験対策したい方に',
    features: [
      '採点回数無制限',
      '詳細なフィードバック',
      '書き直し例の提示',
      '優先サポート',
      '専用サポートライン',
    ],
    limit: '無制限',
    icon: Crown,
    color: 'amber',
    popular: false,
    gradient: 'from-amber-400 to-orange-500',
    shadow: 'shadow-amber-500/20',
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-950 relative overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200 font-sans text-slate-100">
      {/* Dynamic Background */}
      <div className="absolute inset-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black"></div>
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/10 blur-[120px] animate-pulse-slow delay-1000"></div>
        <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] rounded-full bg-blue-500/5 blur-[100px] animate-pulse-slow delay-2000"></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10"></div>
      </div>

      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center text-slate-400 hover:text-white font-medium mb-12 transition-all group hover:bg-white/5 px-4 py-2 rounded-full backdrop-blur-sm border border-transparent hover:border-white/10"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          トップページに戻る
        </Link>

        {/* Header */}
        <div className="text-center mb-20 relative">
          {/* 期間限定バナー */}
          <div className="mb-8 inline-block animate-bounce-slow">
            <div className="relative group cursor-default">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
              <div className="relative px-8 py-3 bg-black rounded-full leading-none flex items-center">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-pink-400 to-purple-400 font-bold text-lg">
                  🎊 期間限定キャンペーン実施中！ 🎊
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight mb-6 drop-shadow-2xl">
            料金プラン
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            あなたの学習スタイルに合わせて、<br className="hidden sm:block" />
            最適なプランをお選びください
          </p>

          {/* 特価強調 */}
          <div className="mt-8 inline-block relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-500/20 blur-xl rounded-2xl transform group-hover:scale-110 transition-transform duration-500"></div>
            <div className="relative bg-white/5 backdrop-blur-xl border border-yellow-500/30 rounded-2xl px-8 py-4 shadow-2xl">
              <p className="text-yellow-200 font-bold text-lg">
                ✨ 今だけ全プラン <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-300 text-2xl font-black">最大34%OFF</span> でご提供中！ ✨
              </p>
            </div>
          </div>
        </div>

        {/* Reset Notice */}
        <div className="max-w-3xl mx-auto mb-16">
          <div className="bg-blue-900/20 backdrop-blur-md border border-blue-500/30 rounded-2xl p-6 flex items-start shadow-lg shadow-blue-900/10">
            <div className="bg-blue-500/20 rounded-full p-3 mr-5 flex-shrink-0">
              <RefreshCw className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-blue-200 mb-2 text-lg">回数リセットについて</h3>
              <p className="text-blue-100/80 leading-relaxed">
                ライト・スタンダードプランの採点回数は、<strong className="text-white border-b border-blue-400/50">ご契約日から30日ごとに自動的にリセット</strong>されます。
                未使用分の翌月繰り越しはありませんので、ご了承ください。
                <span className="block mt-2 text-sm opacity-70">※ 無制限プランは回数制限がないため、リセットの対象外です。</span>
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 mb-24 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;

            return (
              <div
                key={plan.name}
                className={`relative group flex flex-col h-full rounded-[2.5rem] transition-all duration-500 ${plan.popular
                    ? 'bg-slate-900/80 border-2 border-indigo-500/50 shadow-2xl shadow-indigo-500/20 scale-105 z-10'
                    : 'bg-slate-900/40 border border-white/10 hover:bg-slate-800/60 hover:border-white/20 hover:shadow-xl hover:-translate-y-2'
                  } backdrop-blur-xl overflow-hidden`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500"></div>
                )}
                {plan.popular && (
                  <div className="absolute top-5 right-5">
                    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-indigo-500/30 flex items-center">
                      <Crown className="w-3 h-3 mr-1" />
                      人気No.1
                    </div>
                  </div>
                )}

                <div className="p-8 flex-grow">
                  {/* Icon & Name */}
                  <div className="flex items-center mb-6">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.gradient} p-0.5 shadow-lg`}>
                      <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                        <Icon className={`w-7 h-7 text-white`} />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h2 className="text-2xl font-bold text-white">{plan.name}</h2>
                      <p className="text-sm text-slate-400">{plan.description}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-8">
                    {/* 期間限定特価バッジ */}
                    <div className="mb-3">
                      <span className="inline-block bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                        🎉 期間限定特価
                      </span>
                    </div>

                    {/* 本来価格 */}
                    <div className="mb-1">
                      <span className="text-slate-500 text-lg relative">
                        ¥{plan.originalPrice.toLocaleString()}
                        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-500 rotate-[-10deg]"></div>
                      </span>
                    </div>

                    {/* 特価 */}
                    <div className="flex items-baseline">
                      <span className="text-2xl text-white font-bold mr-1">¥</span>
                      <span className={`text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br ${plan.gradient}`}>
                        {plan.price.toLocaleString()}
                      </span>
                      <span className="text-slate-400 ml-2">/{plan.period}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">（税込）</p>

                    {/* 割引率 */}
                    <div className="mt-4">
                      <span className="inline-block bg-white/5 text-white text-sm font-bold px-4 py-1.5 rounded-full border border-white/10">
                        {Math.round((1 - plan.price / plan.originalPrice) * 100)}%OFF
                      </span>
                    </div>
                  </div>

                  {/* Limit Badge */}
                  <div className={`bg-white/5 rounded-xl px-5 py-3 text-sm font-bold inline-flex items-center mb-8 border border-white/5 w-full justify-center`}>
                    <span className="text-slate-400 mr-2">採点回数:</span>
                    <span className="text-white text-lg">{plan.limit}</span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start group/item">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${plan.gradient} p-[1px] mr-3 flex-shrink-0 mt-0.5 opacity-80 group-hover/item:opacity-100 transition-opacity`}>
                          <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                        <span className="text-slate-300 group-hover/item:text-white transition-colors">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="p-8 pt-0">
                  <button
                    className={`w-full py-4 px-6 rounded-xl font-bold text-white transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 bg-gradient-to-r ${plan.gradient} ${plan.shadow}`}
                  >
                    このプランを選択
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12 flex items-center justify-center">
            <HelpCircle className="w-8 h-8 mr-3 text-indigo-400" />
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
                a: "初回ご登録の方には、3回分の無料採点をプレゼントしております。まずはお試しいただき、サービスの品質をご確認ください。"
              }
            ].map((item, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:bg-white/10 transition-colors">
                <h3 className="font-bold text-white text-lg mb-3 flex items-start">
                  <span className="text-indigo-400 mr-3 text-xl">Q.</span>
                  {item.q}
                </h3>
                <p className="text-slate-400 leading-relaxed pl-8">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <div className="text-center mt-24 pb-12">
          <p className="text-slate-500 mb-6">
            ご不明な点がございましたら、お気軽にお問い合わせください
          </p>
          <a
            href="mailto:katsu.yoshii@gmail.com"
            className="inline-flex items-center text-indigo-400 hover:text-indigo-300 font-medium transition-colors px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/5"
          >
            katsu.yoshii@gmail.com
          </a>
        </div>
      </div>
    </main>
  );
}
