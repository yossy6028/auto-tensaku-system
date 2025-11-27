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
  accessType: 'subscription' | 'trial' | 'promo' | 'none' | 'admin';
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

    try {
      const { data, error } = await supabaseClient
        .from('system_settings')
        .select('key, value');

      if (error) {
        console.warn('[AuthProvider] Failed to fetch system settings:', error.message);
        // デフォルト値を設定
        setSystemSettings({
          freeTrialDays: 7,
          freeTrialUsageLimit: 3,
          freeAccessEnabled: false,
          freeAccessUntil: null,
          freeAccessMessage: '',
        });
        return;
      }

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
    } catch (error) {
      console.warn('[AuthProvider] fetchSystemSettings error:', error);
      // デフォルト値を設定
      setSystemSettings({
        freeTrialDays: 7,
        freeTrialUsageLimit: 3,
        freeAccessEnabled: false,
        freeAccessUntil: null,
        freeAccessMessage: '',
      });
    }
  }, [supabaseClient]);

  // プラン一覧を取得
  const fetchPlans = useCallback(async () => {
    if (!supabaseClient) return;

    try {
      const { data, error } = await supabaseClient
        .from('pricing_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        console.warn('[AuthProvider] Failed to fetch plans:', error.message);
        setPlans([]);
        return;
      }

      if (data) {
        setPlans(data as PricingPlan[]);
      } else {
        setPlans([]);
      }
    } catch (error) {
      console.warn('[AuthProvider] fetchPlans error:', error);
      setPlans([]);
    }
  }, [supabaseClient]);

  // ユーザープロファイルを取得
  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabaseClient) return;

    try {
      const { data, error } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // テーブルが存在しない、またはRLSポリシーでアクセスできない場合
        console.warn('[AuthProvider] Failed to fetch user profile:', error.message);
        setProfile(null);
        return;
      }

      if (data) {
        const userProfile = data as UserProfile;
        setProfile(userProfile);
        // プロファイルが取得されたら、利用可否情報を更新（管理者チェックのため）
        if (userProfile.role === 'admin') {
          console.log('[AuthProvider] Admin profile detected, will update usage info');
        }
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.warn('[AuthProvider] fetchProfile error:', error);
      setProfile(null);
    }
  }, [supabaseClient]);

  // アクティブなサブスクリプションを取得
  const fetchSubscription = useCallback(async (userId: string) => {
    if (!supabaseClient) return;

    try {
      const { data, error } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('purchased_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        // テーブルが存在しない、またはRLSポリシーでアクセスできない場合
        console.warn('[AuthProvider] Failed to fetch subscription:', error.message);
        setSubscription(null);
        return;
      }

      if (data) {
        setSubscription(data as Subscription);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.warn('[AuthProvider] fetchSubscription error:', error);
      setSubscription(null);
    }
  }, [supabaseClient]);

  // 無料アクセス情報を取得
  const fetchFreeAccessInfo = useCallback(async (userId: string) => {
    if (!supabaseClient) return;

    try {
      const rpcClient = supabaseClient as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
      };
      const { data, error } = await rpcClient.rpc('check_free_access', { p_user_id: userId });

      if (error) {
        console.warn('[AuthProvider] Failed to fetch free access info:', error);
        setFreeAccessInfo(null);
        return;
      }

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
      } else {
        setFreeAccessInfo(null);
      }
    } catch (error) {
      console.warn('[AuthProvider] fetchFreeAccessInfo error:', error);
      setFreeAccessInfo(null);
    }
  }, [supabaseClient]);

  // 利用可否情報を取得
  const refreshUsageInfo = useCallback(async () => {
    if (!supabaseClient || !user) {
      setUsageInfo(null);
      return;
    }

    // プロファイルを直接取得して管理者チェック（profileがまだ取得されていない場合に備える）
    try {
      const { data: profileData, error: profileError } = await supabaseClient
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileError && profileData && (profileData as { role?: string }).role === 'admin') {
        console.log('[AuthProvider] Admin user detected, setting unlimited access');
        setUsageInfo({
          canUse: true,
          message: '管理者アカウント: 無制限で利用可能です',
          usageCount: null,
          usageLimit: null,
          remainingCount: null,
          planName: '管理者プラン',
          accessType: 'admin',
        });
        return;
      }
    } catch (error) {
      console.warn('[AuthProvider] Failed to check admin status:', error);
      // エラーが発生しても続行（通常の利用可否チェックへ）
    }

    // 管理者でない場合、または管理者チェックに失敗した場合は通常の利用可否チェック

    try {
      const rpcClient = supabaseClient as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
      };

      const { data, error } = await rpcClient.rpc('can_use_service', { p_user_id: user.id });

      if (error) {
        console.warn('[AuthProvider] Failed to fetch usage info:', error);
        setUsageInfo({
          canUse: true, // エラー時は利用可能として扱う
          message: '利用制限の確認に失敗しました。',
          usageCount: null,
          usageLimit: null,
          remainingCount: null,
          planName: null,
          accessType: 'none',
        });
        return;
      }

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
          await fetchFreeAccessInfo(user.id).catch(() => {});
        }
      } else {
        setUsageInfo({
          canUse: true, // データがない場合は利用可能として扱う
          message: '利用可能です。',
          usageCount: null,
          usageLimit: null,
          remainingCount: null,
          planName: null,
          accessType: 'none',
        });
      }
    } catch (error) {
      console.warn('[AuthProvider] refreshUsageInfo error:', error);
      setUsageInfo({
        canUse: true, // エラー時は利用可能として扱う
        message: '利用制限の確認に失敗しました。',
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
    let isMounted = true;
    const initAuth = async () => {
      if (!supabase) {
        if (isMounted) setIsLoading(false);
        return;
      }

      setIsLoading(true);

      // 全体のタイムアウトを設定（5秒後には必ずローディングを解除）
      const globalTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('[AuthProvider] Initialization timeout (5s), forcing loading to false');
          setIsLoading(false);
        }
      }, 5000);

      try {
        // セッション取得を最優先（これが完了すればローディングを解除）
        console.log('[AuthProvider] Getting session...');
        if (!supabase) {
          clearTimeout(globalTimeout);
          if (isMounted) setIsLoading(false);
          return;
        }
        
        const sessionPromise = supabase.auth.getSession();
        const sessionTimeout = new Promise((resolve) => 
          setTimeout(() => resolve({ data: { session: null } }), 2000)
        );
        
        const { data: { session } } = await Promise.race([sessionPromise, sessionTimeout]) as { data: { session: any } };
        console.log('[AuthProvider] Session retrieved:', session ? 'Found' : 'Null');

        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          // セッション取得が完了したら、すぐにローディングを解除
          console.log('[AuthProvider] Session set, clearing loading state');
          clearTimeout(globalTimeout);
          setIsLoading(false);
        }

        // 以下の処理はバックグラウンドで実行（ローディング解除をブロックしない）
        console.log('[AuthProvider] Starting background data fetch...');
        
        // システム設定とプランを並列で取得（タイムアウト付き）
        Promise.all([
          Promise.race([
            fetchSystemSettings().catch(() => {}),
            new Promise(resolve => setTimeout(resolve, 2000))
          ]),
          Promise.race([
            fetchPlans().catch(() => {}),
            new Promise(resolve => setTimeout(resolve, 2000))
          ])
        ]).catch(() => {});

        // ユーザー固有のデータ取得（セッションがある場合のみ）
        if (session?.user && isMounted) {
          console.log('[AuthProvider] Fetching user specific data in background...');
          Promise.all([
            fetchProfile(session.user.id).catch(() => {}),
            fetchSubscription(session.user.id).catch(() => {}),
            fetchFreeAccessInfo(session.user.id).catch(() => {})
          ]).catch(() => {});
        }
      } catch (error) {
        console.error('[AuthProvider] Auth initialization error:', error);
        clearTimeout(globalTimeout);
        if (isMounted) {
          console.log('[AuthProvider] Error occurred, setting isLoading to false');
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [supabase, fetchSystemSettings, fetchPlans, fetchProfile, fetchSubscription, fetchFreeAccessInfo]);

  // 認証状態の変更を監視
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // エラーは各関数内で処理されるため、ここでは静かに失敗させる
          await fetchProfile(session.user.id).catch(() => {});
          await fetchSubscription(session.user.id).catch(() => {});
          await fetchFreeAccessInfo(session.user.id).catch(() => {});
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
  }, [supabase, fetchProfile, fetchSubscription, fetchFreeAccessInfo]);

  useEffect(() => {
    if (user) {
      refreshUsageInfo();
    }
  }, [user, refreshUsageInfo]);

  // プロファイルが変更されたときにも利用可否情報を更新
  useEffect(() => {
    if (user && profile) {
      refreshUsageInfo();
    }
  }, [user, profile, refreshUsageInfo]);

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
