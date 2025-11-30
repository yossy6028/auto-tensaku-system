'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, CheckCircle, Loader2, Edit2, X, Infinity, Users, BarChart3, Gift, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PricingPlan, Database } from '@/lib/supabase/types';
import { getSupabaseClient } from '@/lib/supabase/client';

interface UserStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalUsage: number;
}

interface SystemSettingsState {
  freeTrialDays: number;
  freeTrialUsageLimit: number;
  freeAccessEnabled: boolean;
  freeAccessUntil: string;
}

type SystemSettingRow = Database['public']['Tables']['system_settings']['Row'];
const SYSTEM_SETTINGS_TABLE = 'system_settings' as const;

const isSupabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AdminPage() {
  const { profile, isLoading: authLoading, isConfigured } = useAuth();
  const [supabase] = useState<SupabaseClient<Database> | null>(() => {
    if (!isSupabaseConfigured || typeof window === 'undefined') return null;
    return getSupabaseClient();
  });
  const supabaseClient = supabase;
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // システム設定
  const [systemSettings, setSystemSettings] = useState<SystemSettingsState>({
    freeTrialDays: 7,
    freeTrialUsageLimit: 3,
    freeAccessEnabled: false,
    freeAccessUntil: '',
  });
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);

  // プラン一覧を取得
  const fetchPlans = async () => {
    if (!supabaseClient) return;
    
    const { data } = await supabaseClient
      .from('pricing_plans')
      .select('*')
      .order('sort_order');
    
    if (data) {
      setPlans(data as PricingPlan[]);
    }
  };

  // 統計情報を取得
  const fetchStats = async () => {
    if (!supabaseClient) return;
    
    try {
      // ユーザー数
      const { count: userCount, error: userError } = await supabaseClient
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      // アクティブサブスクリプション数
      const { count: subCount, error: subError } = await supabaseClient
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // 総利用回数
      const { count: usageCount, error: usageError } = await supabaseClient
        .from('usage_logs')
        .select('*', { count: 'exact', head: true });

      // エラーが発生した場合は0を設定
      if (userError) console.warn('[Admin] Failed to fetch user count:', userError.message);
      if (subError) console.warn('[Admin] Failed to fetch subscription count:', subError.message);
      if (usageError) console.warn('[Admin] Failed to fetch usage count:', usageError.message);

      setStats({
        totalUsers: userCount || 0,
        activeSubscriptions: subCount || 0,
        totalUsage: usageCount || 0,
      });
    } catch (error) {
      console.warn('[Admin] fetchStats error:', error);
      setStats({
        totalUsers: 0,
        activeSubscriptions: 0,
        totalUsage: 0,
      });
    }
  };

  // システム設定を取得
  const fetchSystemSettings = async () => {
    if (!supabaseClient) return;
    
    const { data } = await supabaseClient
      .from(SYSTEM_SETTINGS_TABLE)
      .select('key, value');
    
      if (data) {
        const settings: SystemSettingsState = {
          freeTrialDays: 7,
          freeTrialUsageLimit: 3,
          freeAccessEnabled: false,
          freeAccessUntil: '',
        };
        
        data.forEach((item: SystemSettingRow) => {
          const valueString = item.value ?? '';
          switch (item.key) {
            case 'free_trial_days':
              settings.freeTrialDays = parseInt(valueString, 10) || 7;
              break;
            case 'free_trial_usage_limit':
              settings.freeTrialUsageLimit = parseInt(valueString, 10) || 3;
              break;
            case 'free_access_enabled':
              settings.freeAccessEnabled = String(item.value) === 'true';
              break;
            case 'free_access_until':
              settings.freeAccessUntil = item.value === 'null' || !item.value ? '' : item.value.replace(/"/g, '');
              break;
        }
      });
      
      setSystemSettings(settings);
    }
  };

  // システム設定を保存
  const saveSystemSettings = async () => {
    if (!supabaseClient) return;
    
    setIsSettingsSaving(true);
    setMessage(null);

    try {
      const updates: Array<{ key: SystemSettingRow['key']; value: string }> = [
        { key: 'free_trial_days', value: systemSettings.freeTrialDays.toString() },
        { key: 'free_trial_usage_limit', value: systemSettings.freeTrialUsageLimit.toString() },
        { key: 'free_access_enabled', value: systemSettings.freeAccessEnabled.toString() },
        { key: 'free_access_until', value: systemSettings.freeAccessUntil ? `"${systemSettings.freeAccessUntil}"` : 'null' },
      ];

      for (const update of updates) {
        const updatePayload: Database['public']['Tables']['system_settings']['Update'] = {
          value: update.value,
          updated_at: new Date().toISOString(),
        };
        const { error } = await (supabaseClient as unknown as {
          from: (table: string) => {
            update: (payload: Record<string, unknown>) => {
              eq: (column: string, value: string) => Promise<{ error: unknown }>;
            };
          };
        })
          .from(SYSTEM_SETTINGS_TABLE)
          .update(updatePayload)
          .eq('key', update.key);
        
        if (error) {
          throw error instanceof Error ? error : new Error('Failed to update system setting');
        }
      }

      setMessage({ type: 'success', text: 'システム設定を保存しました。' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '設定の保存中にエラーが発生しました。';
      setMessage({ type: 'error', text: message });
    } finally {
      setIsSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (!supabaseClient) return;
    fetchPlans();
    fetchStats();
    fetchSystemSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseClient]);

  // 管理者チェック
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!isConfigured || profile?.role !== 'admin') {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">アクセス権限がありません</h1>
          <p className="text-slate-600 mb-6">このページは管理者のみアクセスできます。</p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            ホームに戻る
          </Link>
        </div>
      </main>
    );
  }

  const handleSavePlan = async (plan: Partial<PricingPlan> & { id: string }) => {
    if (!supabaseClient) return;
    
    setIsSaving(true);
    setMessage(null);

    try {
      const pricingTable = supabaseClient as unknown as {
        from: (table: 'pricing_plans') => {
          insert: (payload: Database['public']['Tables']['pricing_plans']['Insert']) => Promise<{ error: unknown }>;
          update: (payload: Database['public']['Tables']['pricing_plans']['Update']) => { eq: (column: string, value: string) => Promise<{ error: unknown }> };
        };
      };

      if (isCreating) {
        const insertPayload: Database['public']['Tables']['pricing_plans']['Insert'] = {
          id: plan.id,
          name: plan.name ?? '',
          description: plan.description ?? null,
          usage_limit: plan.usage_limit ?? null,
          price_yen: plan.price_yen ?? 0,
          is_active: plan.is_active ?? true,
          sort_order: plan.sort_order ?? plans.length + 1,
        };
        const { error } = await pricingTable
          .from('pricing_plans')
          .insert(insertPayload);

        if (error) throw error;
        setMessage({ type: 'success', text: '新しいプランを作成しました。' });
      } else {
        const updatePayload: Database['public']['Tables']['pricing_plans']['Update'] = {
          name: plan.name,
          description: plan.description ?? null,
          usage_limit: plan.usage_limit ?? null,
          price_yen: plan.price_yen,
          is_active: plan.is_active,
          sort_order: plan.sort_order,
        };
        const { error } = await pricingTable
          .from('pricing_plans')
          .update(updatePayload)
          .eq('id', plan.id);

        if (error) throw error;
        setMessage({ type: 'success', text: 'プランを更新しました。' });
      }

      await fetchPlans();
      setEditingPlan(null);
      setIsCreating(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'エラーが発生しました。';
      setMessage({ type: 'error', text: message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!supabaseClient) return;
    
    if (!confirm('このプランを削除しますか？既存のサブスクリプションには影響しません。')) {
      return;
    }

    try {
      const { error } = await supabaseClient
        .from('pricing_plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'プランを削除しました。' });
      await fetchPlans();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '削除中にエラーが発生しました。';
      setMessage({ type: 'error', text: message });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(price);
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center text-slate-600 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="font-medium">戻る</span>
          </Link>
          <h1 className="text-lg font-bold text-slate-800">管理者設定</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mr-4">
                  <Users className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">総ユーザー数</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.totalUsers}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">アクティブ契約</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.activeSubscriptions}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mr-4">
                  <BarChart3 className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">総利用回数</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.totalUsage}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-start ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Plans Management */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">料金プラン管理</h2>
            <button
              onClick={() => {
                setIsCreating(true);
                setEditingPlan({
                  id: `plan_${Date.now()}`,
                  name: '',
                  description: '',
                  usage_limit: 10,
                  price_yen: 1000,
                  is_active: true,
                  sort_order: plans.length + 1,
                  created_at: '',
                  updated_at: '',
                });
              }}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              新規プラン
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">プラン名</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">回数上限</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">料金</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ステータス</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">表示順</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{plan.name}</p>
                        <p className="text-sm text-slate-500">{plan.description}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {plan.usage_limit === null ? (
                        <span className="flex items-center text-indigo-600 font-medium">
                          <Infinity className="w-4 h-4 mr-1" />
                          無制限
                        </span>
                      ) : (
                        <span className="font-medium text-slate-800">{plan.usage_limit}回</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {formatPrice(plan.price_yen)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                        plan.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {plan.is_active ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {plan.sort_order}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setEditingPlan(plan)}
                        className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Modal */}
        {editingPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => !isSaving && (setEditingPlan(null), setIsCreating(false))}
            />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">
                  {isCreating ? '新規プラン作成' : 'プラン編集'}
                </h3>
                <button
                  onClick={() => { setEditingPlan(null); setIsCreating(false); }}
                  disabled={isSaving}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSavePlan(editingPlan);
                }}
                className="p-6 space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    プランID（変更不可）
                  </label>
                  <input
                    type="text"
                    value={editingPlan.id}
                    disabled
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    プラン名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    説明
                  </label>
                  <input
                    type="text"
                    value={editingPlan.description || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    利用回数上限
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      value={editingPlan.usage_limit ?? ''}
                      onChange={(e) => setEditingPlan({ 
                        ...editingPlan, 
                        usage_limit: e.target.value === '' ? null : parseInt(e.target.value) 
                      })}
                      placeholder="空欄で無制限"
                      min="1"
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={editingPlan.usage_limit === null}
                        onChange={(e) => setEditingPlan({ 
                          ...editingPlan, 
                          usage_limit: e.target.checked ? null : 10 
                        })}
                        className="rounded"
                      />
                      無制限
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    料金（円）<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editingPlan.price_yen}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price_yen: parseInt(e.target.value) })}
                    required
                    min="0"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      表示順
                    </label>
                    <input
                      type="number"
                      value={editingPlan.sort_order}
                      onChange={(e) => setEditingPlan({ ...editingPlan, sort_order: parseInt(e.target.value) })}
                      min="1"
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      ステータス
                    </label>
                    <select
                      value={editingPlan.is_active ? 'active' : 'inactive'}
                      onChange={(e) => setEditingPlan({ ...editingPlan, is_active: e.target.value === 'active' })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="active">有効</option>
                      <option value="inactive">無効</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setEditingPlan(null); setIsCreating(false); }}
                    disabled={isSaving}
                    className="flex-1 py-3 px-4 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        保存
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 無料体験・無料開放設定 */}
        <div className="mt-12 bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg border border-white/60 p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
            <Gift className="w-6 h-6 mr-3 text-amber-500" />
            無料体験・無料開放設定
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 無料体験設定 */}
            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
              <h3 className="text-lg font-bold text-amber-800 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                無料体験期間設定
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    体験期間（日数）
                  </label>
                  <input
                    type="number"
                    value={systemSettings.freeTrialDays}
                    onChange={(e) => setSystemSettings({ 
                      ...systemSettings, 
                      freeTrialDays: parseInt(e.target.value) || 7 
                    })}
                    min="1"
                    max="30"
                    className="w-full px-4 py-2 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                  <p className="text-xs text-amber-600 mt-1">新規登録から何日間無料体験を提供するか</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    体験利用回数上限
                  </label>
                  <input
                    type="number"
                    value={systemSettings.freeTrialUsageLimit}
                    onChange={(e) => setSystemSettings({ 
                      ...systemSettings, 
                      freeTrialUsageLimit: parseInt(e.target.value) || 3 
                    })}
                    min="1"
                    max="100"
                    className="w-full px-4 py-2 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                  <p className="text-xs text-amber-600 mt-1">無料体験中の最大利用回数</p>
                </div>
              </div>
            </div>

            {/* 期間限定無料開放設定 */}
            <div className={`rounded-2xl p-6 border ${systemSettings.freeAccessEnabled ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}`}>
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                期間限定無料開放
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">無料開放を有効にする</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={systemSettings.freeAccessEnabled}
                      onChange={(e) => setSystemSettings({ 
                        ...systemSettings, 
                        freeAccessEnabled: e.target.checked 
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>

                {systemSettings.freeAccessEnabled && (
                  <div className="p-3 bg-green-100 rounded-xl border border-green-200">
                    <p className="text-sm text-green-800 font-medium flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      現在、すべてのユーザーに無料で提供中
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    無料開放終了日時（空欄で無期限）
                  </label>
                  <input
                    type="datetime-local"
                    value={systemSettings.freeAccessUntil}
                    onChange={(e) => setSystemSettings({ 
                      ...systemSettings, 
                      freeAccessUntil: e.target.value 
                    })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  />
                  <p className="text-xs text-slate-500 mt-1">この日時を過ぎると自動的に無料開放が終了します</p>
                </div>
              </div>
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={saveSystemSettings}
              disabled={isSettingsSaving}
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg hover:shadow-xl"
            >
              {isSettingsSaving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  設定を保存
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
