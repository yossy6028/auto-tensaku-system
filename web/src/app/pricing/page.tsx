'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Sparkles, Zap, Crown, RefreshCw } from 'lucide-react';

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
  },
];

const colorClasses = {
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-600',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    icon: 'bg-emerald-100 text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    text: 'text-indigo-600',
    button: 'bg-indigo-600 hover:bg-indigo-700',
    icon: 'bg-indigo-100 text-indigo-600',
    badge: 'bg-indigo-100 text-indigo-700',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-600',
    button: 'bg-amber-600 hover:bg-amber-700',
    icon: 'bg-amber-100 text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
  },
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 font-sans text-slate-900">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] rounded-full bg-violet-400/20 blur-[100px]"></div>
      </div>

      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8 relative z-10">
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
          {/* 期間限定バナー */}
          <div className="mb-6">
            <div className="inline-block bg-gradient-to-r from-red-500 via-pink-500 to-red-500 text-white px-6 py-3 rounded-full shadow-lg animate-pulse">
              <span className="text-lg font-bold">🎊 期間限定キャンペーン実施中！ 🎊</span>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-4">
            料金プラン
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            あなたの学習スタイルに合わせて、最適なプランをお選びください
          </p>
          
          {/* 特価強調 */}
          <div className="mt-6 inline-block bg-yellow-100 border-2 border-yellow-400 rounded-2xl px-6 py-3">
            <p className="text-yellow-800 font-bold">
              ✨ 今だけ全プラン <span className="text-red-600 text-xl">最大34%OFF</span> でご提供中！ ✨
            </p>
          </div>
        </div>

        {/* Reset Notice */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start">
            <div className="bg-blue-100 rounded-full p-2 mr-4 flex-shrink-0">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-blue-800 mb-1">回数リセットについて</h3>
              <p className="text-sm text-blue-700">
                ライト・スタンダードプランの採点回数は、<strong>ご契約日から30日ごとに自動的にリセット</strong>されます。
                未使用分の翌月繰り越しはありませんので、ご了承ください。
                無制限プランは回数制限がないため、リセットの対象外です。
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => {
            const colors = colorClasses[plan.color as keyof typeof colorClasses];
            const Icon = plan.icon;
            
            return (
              <div
                key={plan.name}
                className={`relative bg-white rounded-3xl shadow-lg border-2 ${
                  plan.popular ? 'border-indigo-400 ring-4 ring-indigo-100' : 'border-slate-200'
                } overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
                      人気No.1
                    </div>
                  </div>
                )}

                <div className="p-8">
                  {/* Icon & Name */}
                  <div className="flex items-center mb-4">
                    <div className={`${colors.icon} rounded-xl p-3 mr-4`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800">{plan.name}</h2>
                      <p className="text-sm text-slate-500">{plan.description}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {/* 期間限定特価バッジ */}
                    <div className="mb-2">
                      <span className="inline-block bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                        🎉 期間限定特価
                      </span>
                    </div>
                    
                    {/* 本来価格（二重取り消し線） */}
                    <div className="mb-1">
                      <span className="text-slate-400 text-lg" style={{ textDecoration: 'line-through', textDecorationStyle: 'double' }}>
                        ¥{plan.originalPrice.toLocaleString()}
                      </span>
                    </div>
                    
                    {/* 特価 */}
                    <div className="flex items-baseline">
                      <span className="text-lg text-red-500 font-bold">¥</span>
                      <span className="text-5xl font-black text-red-500 mx-1">
                        {plan.price.toLocaleString()}
                      </span>
                      <span className="text-slate-500">/{plan.period}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">（税込）</p>
                    
                    {/* 割引率 */}
                    <div className="mt-2">
                      <span className="inline-block bg-red-100 text-red-600 text-sm font-bold px-3 py-1 rounded-full">
                        {Math.round((1 - plan.price / plan.originalPrice) * 100)}%OFF
                      </span>
                    </div>
                  </div>

                  {/* Limit Badge */}
                  <div className={`${colors.badge} rounded-full px-4 py-2 text-sm font-bold inline-block mb-6`}>
                    採点回数: {plan.limit}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className={`w-5 h-5 ${colors.text} mr-3 flex-shrink-0 mt-0.5`} />
                        <span className="text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    className={`w-full ${colors.button} text-white font-bold py-4 px-6 rounded-xl transition-colors shadow-lg`}
                  >
                    このプランを選択
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 text-center mb-8">
            よくあるご質問
          </h2>
          
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">Q. 途中でプラン変更はできますか？</h3>
              <p className="text-slate-600">
                はい、いつでもプラン変更が可能です。アップグレードの場合は即時反映され、
                ダウングレードの場合は次回更新日から適用されます。
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">Q. 解約はいつでもできますか？</h3>
              <p className="text-slate-600">
                はい、いつでも解約可能です。解約後も、現在の契約期間終了まではサービスをご利用いただけます。
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">Q. 回数を使い切った場合はどうなりますか？</h3>
              <p className="text-slate-600">
                月の採点回数を使い切った場合、次のリセット日まで採点機能はご利用いただけません。
                上位プランへのアップグレードをご検討いただくか、次回リセット日までお待ちください。
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">Q. 無料トライアルはありますか？</h3>
              <p className="text-slate-600">
                初回ご登録の方には、3回分の無料採点をプレゼントしております。
                まずはお試しいただき、サービスの品質をご確認ください。
              </p>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="text-center mt-16">
          <p className="text-slate-600 mb-4">
            ご不明な点がございましたら、お気軽にお問い合わせください
          </p>
          <a 
            href="mailto:katsu.yoshii@gmail.com"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            katsu.yoshii@gmail.com
          </a>
        </div>
      </div>
    </main>
  );
}
