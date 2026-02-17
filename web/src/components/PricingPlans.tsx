'use client';

import React from 'react';
import { Check, Sparkles, Infinity } from 'lucide-react';
import { useAuth } from './AuthProvider';
import type { PricingPlan } from '@/lib/supabase/types';

interface PricingPlansProps {
  onSelectPlan?: (plan: PricingPlan) => void;
  showCurrent?: boolean;
}

export function PricingPlans({ onSelectPlan, showCurrent = true }: PricingPlansProps) {
  const { plans, subscription, user } = useAuth();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(price);
  };

  const isCurrentPlan = (planId: string) => {
    return subscription?.plan_id === planId && subscription?.status === 'active';
  };

  const getFeatures = (plan: PricingPlan) => {
    const features = [];

    if (plan.usage_limit === null) {
      features.push('無制限で利用可能');
    } else {
      features.push(`${plan.usage_limit}回まで採点可能`);
    }

    features.push('AIによる詳細フィードバック');
    features.push('改善アドバイス付き');
    features.push('模範解答の提示');

    return features;
  };

  if (plans.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        プラン情報を読み込み中...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {plans.map((plan, index) => {
        const isCurrent = isCurrentPlan(plan.id);
        const isPopular = index === 2; // 100回プランを人気に
        const isUnlimited = plan.usage_limit === null;

        return (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all hover:shadow-xl ${
              isCurrent ? 'ring-2 ring-indigo-500' : ''
            } ${isPopular ? 'md:-mt-4 md:mb-4' : ''}`}
          >
            {/* Popular badge */}
            {isPopular && (
              <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                <Sparkles className="w-3 h-3 inline mr-1" />
                人気
              </div>
            )}

            {/* Current badge */}
            {isCurrent && showCurrent && (
              <div className="absolute top-0 left-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-br-lg">
                現在のプラン
              </div>
            )}

            <div className={`p-6 ${isPopular ? 'bg-gradient-to-br from-indigo-50 to-violet-50' : ''}`}>
              {/* Plan name */}
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                {isUnlimited && <Infinity className="w-5 h-5 mr-2 text-indigo-500" />}
                {plan.name}
              </h3>
              
              {plan.description && (
                <p className="text-sm text-slate-500 mt-1">{plan.description}</p>
              )}

              {/* Price */}
              <div className="mt-4">
                <span className="text-4xl font-black text-slate-900">
                  {formatPrice(plan.price_yen)}
                </span>
                <span className="text-slate-500 text-sm ml-1">/ 買い切り</span>
              </div>

              {/* Usage limit */}
              <div className="mt-2 text-sm font-medium text-indigo-600">
                {plan.usage_limit === null ? (
                  <span className="flex items-center">
                    <Infinity className="w-4 h-4 mr-1" />
                    無制限
                  </span>
                ) : (
                  `${plan.usage_limit}回まで`
                )}
              </div>

              {/* Features */}
              <ul className="mt-6 space-y-3">
                {getFeatures(plan).map((feature, i) => (
                  <li key={i} className="flex items-start text-sm text-slate-600">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => onSelectPlan?.(plan)}
                disabled={isCurrent || !user}
                className={`mt-6 w-full py-3 px-4 rounded-xl font-bold transition-all ${
                  isCurrent
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : isPopular
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:shadow-lg'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isCurrent ? '現在のプラン' : !user ? 'ログインが必要です' : '選択する'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}



