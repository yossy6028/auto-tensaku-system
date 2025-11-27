'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { SupabaseClient, User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile, Subscription, PricingPlan, Database } from '@/lib/supabase/types';

interface UsageInfo {
  canUse: boolean;
  message: string;
  usageCount: number | null;
  usageLimit: number | null;
  remainingCount: number | null;
  planName: string | null;
  accessType: 'subscription' | 'trial' | 'promo' | 'none';
}

interface FreeAccessInfo {
  hasFreeAccess: boolean;
  freeAccessType: 'trial' | 'promo' | 'new' | 'expired' | 'none';
  message: string;
  trialDaysRemaining: number | null;
  trialUsageRemaining: number | null;
  promoEndDate: string | null;
}

interface SystemSettings {
  freeTrialDays: number;
  freeTrialUsageLimit: number;
  freeAccessEnabled: boolean;
  freeAccessUntil: string | null;
  freeAccessMessage: string;
}

type SystemSettingRow = Database['public']['Tables']['system_settings']['Row'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  subscription: Subscription | null;
  usageInfo: UsageInfo | null;
  freeAccessInfo: FreeAccessInfo | null;
  systemSettings: SystemSettings | null;
  plans: PricingPlan[];
  isLoading: boolean;
  isConfigured: boolean;
  showTrialEndedModal: boolean;
  setShowTrialEndedModal: (show: boolean) => void;
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUsageInfo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isSupabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState<SupabaseClient<Database> | null>(() => {
    if (!isSupabaseConfigured || typeof window === 'undefined') return null;
    return createClient();
  });
  const supabaseClient = supabase;
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [freeAccessInfo, setFreeAccessInfo] = useState<FreeAccessInfo | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTrialEndedModal, setShowTrialEndedModal] = useState(false);

  // システム設定を取得
  const fetchSystemSettings = useCallback(async () => {
    if (!supabaseClient) return;

    const { data } = await supabaseClient
      .from('system_settings')
      .select('key, value');

    if (data) {
      const settings: SystemSettings = {
        freeTrialDays: 7,
        freeTrialUsageLimit: 3,
        freeAccessEnabled: false,
        freeAccessUntil: null,
        freeAccessMessage: '',
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
            settings.freeAccessUntil = item.value === 'null' ? null : item.value;
            break;
          case 'free_access_message':
            settings.freeAccessMessage = typeof item.value === 'string' ? item.value : '';
            break;
        }
      });

      setSystemSettings(settings);
    }
  }, [supabaseClient]);

  // プラン一覧を取得
  const fetchPlans = useCallback(async () => {
    if (!supabaseClient) return;

    const { data } = await supabaseClient
      .from('pricing_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (data) {
      setPlans(data as PricingPlan[]);
    }
  }, [supabaseClient]);

  // ユーザープロファイルを取得
  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabaseClient) return;

    const { data } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data as UserProfile);
    }
  }, [supabaseClient]);

  // アクティブなサブスクリプションを取得
  const fetchSubscription = useCallback(async (userId: string) => {
    if (!supabaseClient) return;

    const { data } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('purchased_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setSubscription(data as Subscription);
    } else {
      setSubscription(null);
    }
  }, [supabaseClient]);

  // 無料アクセス情報を取得
  const fetchFreeAccessInfo = useCallback(async (userId: string) => {
    if (!supabaseClient) return;

    const rpcClient = supabaseClient as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
    };
    const { data } = await rpcClient.rpc('check_free_access', { p_user_id: userId });

    if (data && Array.isArray(data) && data.length > 0) {
      const info = data[0];
      const freeInfo: FreeAccessInfo = {
        hasFreeAccess: info.has_free_access,
        freeAccessType: info.free_access_type,
        message: info.message,
        trialDaysRemaining: info.trial_days_remaining,
        trialUsageRemaining: info.trial_usage_remaining,
        promoEndDate: info.promo_end_date,
      };
      setFreeAccessInfo(freeInfo);

      // 無料体験終了時にモーダル表示
      if (info.free_access_type === 'expired') {
        setShowTrialEndedModal(true);
      }
    }
  }, [supabaseClient]);

  // 利用可否情報を取得
  const refreshUsageInfo = useCallback(async () => {
    if (!supabaseClient || !user) {
      setUsageInfo(null);
      return;
    }

    const rpcClient = supabaseClient as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
    };

    const { data } = await rpcClient.rpc('can_use_service', { p_user_id: user.id });

    if (data && Array.isArray(data) && data.length > 0) {
      const info = data[0];
      setUsageInfo({
        canUse: info.can_use,
        message: info.message,
        usageCount: info.usage_count,
        usageLimit: info.usage_limit,
        remainingCount: info.remaining_count,
        planName: info.plan_name,
        accessType: info.access_type || 'none',
      });

      // 無料体験終了チェック
      if (!info.can_use && info.access_type === 'none') {
        await fetchFreeAccessInfo(user.id);
      }
    } else {
      setUsageInfo({
        canUse: false,
        message: '利用可能なプランがありません。プランを購入してください。',
        usageCount: null,
        usageLimit: null,
        remainingCount: null,
        planName: null,
        accessType: 'none',
      });
    }
  }, [supabaseClient, user, fetchFreeAccessInfo]);

  // 初期化
  useEffect(() => {
    const initAuth = async () => {
      if (!supabase) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // これらは失敗しても続行（テーブルが存在しない場合など）
        console.log('[AuthProvider] Fetching system settings...');
        await fetchSystemSettings().catch((e) => console.log('[AuthProvider] system_settings error', e));

        console.log('[AuthProvider] Fetching plans...');
        await fetchPlans().catch((e) => console.log('[AuthProvider] pricing_plans error', e));

        console.log('[AuthProvider] Getting session...');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[AuthProvider] Session retrieved:', session ? 'Found' : 'Null');

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('[AuthProvider] Fetching user specific data...');
          await fetchProfile(session.user.id).catch((e) => console.error('[AuthProvider] fetchProfile error', e));
          await fetchSubscription(session.user.id).catch((e) => console.error('[AuthProvider] fetchSubscription error', e));
          await fetchFreeAccessInfo(session.user.id).catch((e) => console.error('[AuthProvider] fetchFreeAccessInfo error', e));
        }
      } catch (error) {
        console.error('[AuthProvider] Auth initialization error:', error);
      } finally {
        console.log('[AuthProvider] initAuth finished, setting isLoading to false');
        setIsLoading(false);
      }
    };

    initAuth();

    if (!supabase) return;

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id);
          await fetchSubscription(session.user.id);
          await fetchFreeAccessInfo(session.user.id);
        } else {
          setProfile(null);
          setSubscription(null);
          setUsageInfo(null);
          setFreeAccessInfo(null);
        }
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, [supabase, fetchSystemSettings, fetchPlans, fetchProfile, fetchSubscription, fetchFreeAccessInfo]);

  useEffect(() => {
    if (user) {
      refreshUsageInfo();
    }
  }, [user, refreshUsageInfo]);

  const signInWithEmail = async (email: string) => {
    if (!supabase) return { error: new Error('Supabase is not configured') };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error };
  };

  const signInWithPassword = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase is not configured') };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase is not configured') };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setSubscription(null);
    setUsageInfo(null);
    setFreeAccessInfo(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        subscription,
        usageInfo,
        freeAccessInfo,
        systemSettings,
        plans,
        isLoading,
        isConfigured: isSupabaseConfigured,
        showTrialEndedModal,
        setShowTrialEndedModal,
        signInWithEmail,
        signInWithPassword,
        signUp,
        signOut,
        refreshUsageInfo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
