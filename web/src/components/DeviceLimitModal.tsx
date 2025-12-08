'use client';

import React, { useState } from 'react';
import type { Database } from '@/lib/supabase/types';

type UserDevice = Database['public']['Functions']['get_user_devices']['Returns'][0];

interface DeviceLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: UserDevice[];
  currentFingerprint: string;
  maxDevices: number;
  onRemoveDevice: (deviceId: string) => Promise<boolean>;
  onRetryRegistration: () => Promise<void>;
}

export function DeviceLimitModal({
  isOpen,
  onClose,
  devices,
  currentFingerprint,
  maxDevices,
  onRemoveDevice,
  onRetryRegistration,
}: DeviceLimitModalProps) {
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRemoveDevice = async (deviceId: string) => {
    setRemovingDeviceId(deviceId);
    setError(null);
    
    try {
      const success = await onRemoveDevice(deviceId);
      if (success) {
        // デバイス削除成功後、再登録を試みる
        await onRetryRegistration();
      } else {
        setError('デバイスの削除に失敗しました。');
      }
    } catch (e) {
      setError('エラーが発生しました。もう一度お試しください。');
      console.error('Device removal error:', e);
    } finally {
      setRemovingDeviceId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* バックドロップ */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* モーダル本体 */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">デバイス上限に達しました</h2>
              <p className="text-white/80 text-sm">最大{maxDevices}台のデバイスで利用可能です</p>
            </div>
          </div>
        </div>
        
        {/* コンテンツ */}
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            このアカウントは既に{maxDevices}台のデバイスで使用されています。
            新しいデバイスで使用するには、既存のデバイスを削除してください。
          </p>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
          
          {/* デバイス一覧 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              登録済みデバイス
            </h3>
            
            {devices.map((device) => {
              const isCurrentDevice = device.device_fingerprint === currentFingerprint;
              const isRemoving = removingDeviceId === device.device_id;
              
              return (
                <div 
                  key={device.device_id}
                  className={`
                    p-4 rounded-xl border-2 transition-all
                    ${isCurrentDevice 
                      ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30' 
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {device.device_name?.includes('Chrome') ? '🌐' :
                           device.device_name?.includes('Safari') ? '🧭' :
                           device.device_name?.includes('Firefox') ? '🦊' :
                           device.device_name?.includes('Edge') ? '🔷' : '💻'}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {device.device_name || 'Unknown Device'}
                        </span>
                        {isCurrentDevice && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200 rounded-full">
                            このデバイス
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        最終アクセス: {formatDate(device.last_active_at)}
                      </div>
                    </div>
                    
                    {!isCurrentDevice && (
                      <button
                        onClick={() => handleRemoveDevice(device.device_id)}
                        disabled={isRemoving}
                        className={`
                          px-3 py-1.5 text-sm font-medium rounded-lg transition-all
                          ${isRemoving 
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                            : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900'
                          }
                        `}
                      >
                        {isRemoving ? (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            削除中
                          </span>
                        ) : '削除'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* 注意書き */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">ご注意</p>
                <p>
                  塾や学校で複数の教室でアカウントを共有することは利用規約で禁止されています。
                  1アカウントは個人での利用を想定しています。
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* フッター */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}





