'use client';

import React from 'react';
import { useAuth } from './AuthProvider';
import { Gift, Clock, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

export function FreeAccessBanner() {
  const { usageInfo, freeAccessInfo } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;
  
  // 期間限定無料開放中
  if (usageInfo?.accessType === 'promo') {
    const endDate = freeAccessInfo?.promoEndDate 
      ? new Date(freeAccessInfo.promoEndDate).toLocaleDateString('ja-JP', {
          month: 'long',
          day: 'numeric',
        })
      : null;

    return (
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-4 relative">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-3">
          <Gift className="w-5 h-5 animate-bounce" />
          <span className="font-bold">🎉 期間限定無料開放中！</span>
          <span className="text-green-100">
            {endDate ? `${endDate}まで` : ''}無料でご利用いただけます
          </span>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // 無料体験中
  if (usageInfo?.accessType === 'trial') {
    const daysRemaining = freeAccessInfo?.trialDaysRemaining ?? 0;
    const usageRemaining = usageInfo.remainingCount ?? 0;
    
    return (
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 px-4 relative">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-3 flex-wrap">
          <Sparkles className="w-5 h-5" />
          <span className="font-bold">無料体験中</span>
          <div className="flex items-center gap-4 text-amber-100 text-sm">
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              残り{daysRemaining}日
            </span>
            <span>|</span>
            <span>あと{usageRemaining}回利用可能</span>
          </div>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}


