'use client';

import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Settings, CreditCard, ChevronDown, Infinity, BookOpen, Receipt } from 'lucide-react';
import { useAuth } from './AuthProvider';
import Link from 'next/link';

interface UserMenuProps {
  onAuthClick?: () => void;
}

export function UserMenu({ onAuthClick }: UserMenuProps) {
  const { user, profile, usageInfo, signOut, isLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 外部クリックでメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <button
        onClick={onAuthClick}
        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
      >
        ログイン
      </button>
    );
  }

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'ユーザー';
  const isAdmin = profile?.role === 'admin';
  const isUnlimited = usageInfo?.usageLimit === null;

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
          {displayName.charAt(0).toUpperCase()}
        </div>
        
        {/* Usage info (desktop only) */}
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-slate-700 truncate max-w-[120px]">
            {displayName}
          </p>
          {usageInfo && (
            <p className="text-xs text-slate-500">
              {isUnlimited ? (
                <span className="flex items-center">
                  <Infinity className="w-3 h-3 mr-1" />
                  無制限
                </span>
              ) : usageInfo.canUse ? (
                `残り ${usageInfo.remainingCount}回`
              ) : (
                <span className="text-amber-600">プラン購入が必要</span>
              )}
            </p>
          )}
        </div>
        
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
          {/* User Info Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <p className="font-medium text-slate-800">{displayName}</p>
            <p className="text-sm text-slate-500 truncate">{user.email}</p>
            {isAdmin && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">
                管理者
              </span>
            )}
          </div>

          {/* Usage Info */}
          {usageInfo && (
            <div className="p-4 border-b border-slate-100">
              <p className="text-xs text-slate-500 mb-1">現在のプラン</p>
              <p className="font-medium text-slate-800">{usageInfo.planName || 'プランなし'}</p>
              {usageInfo.canUse && !isUnlimited && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">残り回数</span>
                    <span className="font-medium text-slate-700">
                      {usageInfo.remainingCount} / {usageInfo.usageLimit}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full"
                      style={{
                        width: `${((usageInfo.usageLimit! - (usageInfo.remainingCount ?? 0)) / usageInfo.usageLimit!) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}
              {isUnlimited && (
                <p className="mt-1 text-sm text-indigo-600 flex items-center">
                  <Infinity className="w-4 h-4 mr-1" />
                  無制限
                </p>
              )}
            </div>
          )}

          {/* Menu Items */}
          <div className="p-2">
            <Link
              href="/usage"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-700"
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-sm">使い方</span>
            </Link>
            
            <Link
              href="/pricing"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-700"
            >
              <CreditCard className="w-4 h-4" />
              <span className="text-sm">プラン・料金</span>
            </Link>
            
            <Link
              href="/subscription"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-700"
            >
              <Receipt className="w-4 h-4" />
              <span className="text-sm">サブスクリプション管理</span>
            </Link>
            
            <Link
              href="/account"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-700"
            >
              <User className="w-4 h-4" />
              <span className="text-sm">アカウント設定</span>
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-700"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">管理者設定</span>
              </Link>
            )}

            <hr className="my-2 border-slate-100" />

            <button
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors text-red-600"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">ログアウト</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



