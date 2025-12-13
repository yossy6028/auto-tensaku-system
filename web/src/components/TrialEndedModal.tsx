'use client';

import React from 'react';
import { X, Clock, CreditCard, Sparkles, Gift } from 'lucide-react';
import { useAuth } from './AuthProvider';
import Link from 'next/link';

export function TrialEndedModal() {
  const { showTrialEndedModal, setShowTrialEndedModal, freeAccessInfo, systemSettings, plans } = useAuth();

  if (!showTrialEndedModal) return null;

  const isExpired = freeAccessInfo?.freeAccessType === 'expired';
  const recommendedPlan = plans.find(p => p.id === 'plan_15') || plans[0];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(price);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setShowTrialEndedModal(false)}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in my-auto max-h-[90vh] flex flex-col">
        {/* Close button */}
        <button
          onClick={() => setShowTrialEndedModal(false)}
          className="absolute top-4 right-4 z-10 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {isExpired ? '無料体験期間が終了しました' : '無料体験をご利用いただきありがとうございます'}
            </h2>
            <p className="text-amber-100">
              {isExpired 
                ? 'プランを購入して引き続きご利用ください'
                : `${systemSettings?.freeTrialDays || 7}日間の無料体験をお楽しみいただけます`
              }
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto flex-1">
          {/* Trial stats */}
          {isExpired && (
            <div className="bg-slate-50 rounded-2xl p-4 mb-6">
              <p className="text-sm text-slate-600 text-center">
                無料体験期間（{systemSettings?.freeTrialDays || 7}日間）での利用回数：
                <span className="font-bold text-slate-800 ml-1">
                  {systemSettings?.freeTrialUsageLimit || 3}回
                </span>
              </p>
            </div>
          )}

          {/* Benefits */}
          <div className="mb-6">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center">
              <Gift className="w-5 h-5 text-indigo-500 mr-2" />
              有料プランでできること
            </h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center">
                <Sparkles className="w-4 h-4 text-amber-500 mr-2" />
                無制限の詳細フィードバック
              </li>
              <li className="flex items-center">
                <Sparkles className="w-4 h-4 text-amber-500 mr-2" />
                具体的な改善アドバイス
              </li>
              <li className="flex items-center">
                <Sparkles className="w-4 h-4 text-amber-500 mr-2" />
                模範解答の提示
              </li>
              <li className="flex items-center">
                <Sparkles className="w-4 h-4 text-amber-500 mr-2" />
                PDFレポート出力
              </li>
            </ul>
          </div>

          {/* Recommended plan */}
          {recommendedPlan && (
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-5 mb-6 border border-indigo-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-indigo-600">おすすめプラン</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                  人気
                </span>
              </div>
              <p className="text-lg font-bold text-slate-800 mb-1">{recommendedPlan.name}</p>
              <div className="flex items-baseline">
                <span className="text-3xl font-black text-indigo-600">
                  {formatPrice(recommendedPlan.price_yen)}
                </span>
                <span className="text-slate-500 text-sm ml-2">
                  {recommendedPlan.usage_limit ? `${recommendedPlan.usage_limit}回` : '無制限'}
                </span>
              </div>
            </div>
          )}

          {/* CTA buttons */}
          <div className="space-y-3">
            <Link
              href="/pricing"
              onClick={() => setShowTrialEndedModal(false)}
              className="block w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-2xl text-center shadow-lg hover:shadow-xl transition-all"
            >
              <CreditCard className="w-5 h-5 inline mr-2" />
              プランを見る
            </Link>
            <button
              onClick={() => setShowTrialEndedModal(false)}
              className="block w-full py-3 px-6 text-slate-500 font-medium rounded-xl text-center hover:bg-slate-50 transition-colors"
            >
              あとで
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



