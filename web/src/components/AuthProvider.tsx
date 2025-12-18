'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { SupabaseClient, User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile, Subscription, PricingPlan, Database, DeviceInfo, DeviceRegistrationResult } from '@/lib/supabase/types';
import { getDeviceInfo, markDeviceAsRegistered, clearDeviceRegistration } from '@/lib/utils/deviceFingerprint';

// デバイス情報の型（RPC関数の戻り値）
type UserDeviceInfo = Database['public']['Functions']['get_user_devices']['Returns'][0];

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

// デバイス制限関連
interface DeviceLimitInfo {
  isLimited: boolean;
  message: string;
  currentDeviceCount: number;
  maxDevices: number;
  devices: UserDeviceInfo[];
}

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
  // デバイス制限関連
  deviceInfo: DeviceInfo | null;
  deviceLimitInfo: DeviceLimitInfo | null;
  showDeviceLimitModal: boolean;
  setShowDeviceLimitModal: (show: boolean) => void;
  removeDevice: (deviceId: string) => Promise<boolean>;
  retryDeviceRegistration: () => Promise<void>;
  // 認証関数
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
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
  
  // デバイス制限関連の状態
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [deviceLimitInfo, setDeviceLimitInfo] = useState<DeviceLimitInfo | null>(null);
  const [showDeviceLimitModal, setShowDeviceLimitModal] = useState(false);

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
        console.warn('[AuthProvider] Failed to fetch user profile:', error.message);
        setProfile(null);
        return;
      }

      if (data) {
        setProfile(data as UserProfile);
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
        console.warn('[AuthProvider] Failed to fetch subscription:', error.message);
        setSubscription(null);
        return;
      }

      if (data) {
        setSubscription(data as Subscription);
      } else {
        // フォールバック: Stripeから同期を試みる
        try {
          const res = await fetch('/api/stripe/sync', { method: 'POST' });
          if (res.ok) {
            const { data: synced } = await supabaseClient
              .from('subscriptions')
              .select('*')
              .eq('user_id', userId)
              .eq('status', 'active')
              .order('purchased_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (synced) {
              setSubscription(synced as Subscription);
              return;
            }
          }
        } catch (syncError) {
          console.warn('[AuthProvider] Stripe sync fallback failed:', syncError);
        }
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

  // デバイス一覧を取得
  const fetchUserDevices = useCallback(async (userId: string): Promise<UserDeviceInfo[]> => {
    if (!supabaseClient) return [];

    try {
      const rpcClient = supabaseClient as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
      };
      const { data, error } = await rpcClient.rpc('get_user_devices', { p_user_id: userId });

      if (error) {
        console.warn('[AuthProvider] Failed to fetch user devices:', error);
        return [];
      }

      if (data && Array.isArray(data)) {
        return data as UserDeviceInfo[];
      }
      return [];
    } catch (error) {
      console.warn('[AuthProvider] fetchUserDevices error:', error);
      return [];
    }
  }, [supabaseClient]);

  // デバイスを登録
  const registerDevice = useCallback(async (userId: string, deviceInfoParam: DeviceInfo): Promise<DeviceRegistrationResult | null> => {
    if (!supabaseClient) return null;

    try {
      const rpcClient = supabaseClient as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
      };
      const { data, error } = await rpcClient.rpc('register_device', {
        p_user_id: userId,
        p_device_fingerprint: deviceInfoParam.fingerprint,
        p_device_name: deviceInfoParam.deviceName,
        p_user_agent: deviceInfoParam.userAgent,
      });

      if (error) {
        console.warn('[AuthProvider] Failed to register device:', error);
        return null;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        const result = data[0] as {
          success: boolean;
          message: string;
          device_id: string | null;
          is_new_device: boolean;
          current_device_count: number;
          max_devices: number | null;
        };
        
        const registrationResult: DeviceRegistrationResult = {
          success: result.success,
          message: result.message,
          deviceId: result.device_id,
          isNewDevice: result.is_new_device,
          currentDeviceCount: result.current_device_count,
          maxDevices: result.max_devices,
        };
        
        return registrationResult;
      }
      return null;
    } catch (error) {
      console.warn('[AuthProvider] registerDevice error:', error);
      return null;
    }
  }, [supabaseClient]);

  // デバイス登録処理（ログイン後に呼ばれる）
  const handleDeviceRegistration = useCallback(async (userId: string) => {
    // デバイス情報を取得
    const info = await getDeviceInfo();
    setDeviceInfo(info);

    // デバイスを登録
    const result = await registerDevice(userId, info);
    
    if (result) {
      if (result.success) {
        // 登録成功
        markDeviceAsRegistered();
        setDeviceLimitInfo(null);
        setShowDeviceLimitModal(false);
      } else {
        // デバイス上限に達している
        
        // デバイス一覧を取得
        const devices = await fetchUserDevices(userId);
        
        setDeviceLimitInfo({
          isLimited: true,
          message: result.message,
          currentDeviceCount: result.currentDeviceCount,
          maxDevices: result.maxDevices || 2,
          devices,
        });
        setShowDeviceLimitModal(true);
      }
    }
  }, [registerDevice, fetchUserDevices]);

  // デバイスを削除
  const removeDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    if (!supabaseClient || !user) return false;

    try {
      const rpcClient = supabaseClient as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
      };
      const { data, error } = await rpcClient.rpc('remove_device', {
        p_user_id: user.id,
        p_device_id: deviceId,
      });

      if (error) {
        console.warn('[AuthProvider] Failed to remove device:', error);
        return false;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        const result = data[0] as { success: boolean; message: string };
        return result.success;
      }
      return false;
    } catch (error) {
      console.warn('[AuthProvider] removeDevice error:', error);
      return false;
    }
  }, [supabaseClient, user]);

  // デバイス登録を再試行
  const retryDeviceRegistration = useCallback(async () => {
    if (!user || !deviceInfo) return;
    await handleDeviceRegistration(user.id);
  }, [user, deviceInfo, handleDeviceRegistration]);

  // 利用可否情報を取得
  // overrideUser: onAuthStateChange等から直接渡す場合に使用（stale closure対策）
  const refreshUsageInfo = useCallback(async (overrideUser?: User | null) => {
    if (!supabaseClient) {
      setUsageInfo(null);
      return;
    }

    // 渡されたユーザーを優先、なければstateのユーザーを使用
    const targetUser = overrideUser !== undefined ? overrideUser : user;

    if (!targetUser) {
      setUsageInfo(null);
      return;
    }

    // プロファイルを直接取得して管理者チェック（profileがまだ取得されていない場合に備える）
    try {
      const { data: profileData, error: profileError } = await supabaseClient
        .from('user_profiles')
        .select('role')
        .eq('id', targetUser.id)
        .maybeSingle();

      if (!profileError && profileData && (profileData as { role?: string }).role === 'admin') {
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

      const { data, error } = await rpcClient.rpc('can_use_service', { p_user_id: targetUser.id });

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
          await fetchFreeAccessInfo(targetUser.id).catch(() => {});
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
          console.warn('[AuthProvider] Initialization timeout (5s)');
          setIsLoading(false);
        }
      }, 5000);

      try {
        // セッション取得を最優先（これが完了すればローディングを解除）
        if (!supabase) {
          clearTimeout(globalTimeout);
          if (isMounted) setIsLoading(false);
          return;
        }

        const sessionPromise = supabase.auth.getSession();
        const sessionTimeout = new Promise((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 2000)
        );

        const { data: { session } } = await Promise.race([sessionPromise, sessionTimeout]) as { data: { session: Session | null } };

        if (isMounted) {
          // セッションがある場合のみ状態を更新
          // タイムアウトでnullが返された場合は、onAuthStateChangeに任せる
          if (session) {
            setSession(session);
            setUser(session.user ?? null);
          }
          // getSession()がnullを返した場合（タイムアウト含む）は、onAuthStateChangeに任せる

          clearTimeout(globalTimeout);
          setIsLoading(false);
        }

        // 以下の処理はバックグラウンドで実行（ローディング解除をブロックしない）

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
          Promise.all([
            fetchProfile(session.user.id).catch(() => {}),
            fetchSubscription(session.user.id).catch(() => {}),
            handleDeviceRegistration(session.user.id).catch(() => {})
          ]).catch(() => {});
        }
      } catch (error) {
        console.error('[AuthProvider] Auth initialization error:', error);
        clearTimeout(globalTimeout);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // 認証状態の変更を監視
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        const user = session?.user ?? null;
        setUser(user);

        if (session?.user) {
          // onAuthStateChangeコールバックを素早く完了させるため、データ取得は遅延実行
          const userId = session.user.id;
          const sessionUser = session.user;

          setTimeout(async () => {
            // プロファイル取得（直接クエリ）
            try {
              const { data: profileData, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single();
              if (!profileError && profileData) {
                setProfile(profileData as UserProfile);
              }
            } catch (e) {
              console.error('[AuthProvider] Profile fetch error:', e);
            }

            // サブスクリプション取得（直接クエリ）
            try {
              const { data: subData, error: subError } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (!subError && subData) {
                setSubscription(subData as Subscription);
              }
            } catch (e) {
              console.error('[AuthProvider] Subscription fetch error:', e);
            }

            // 利用可否情報を更新
            try {
              await refreshUsageInfo(sessionUser);
            } catch (e) {
              console.error('[AuthProvider] refreshUsageInfo error:', e);
            }

            // デバイス登録処理
            handleDeviceRegistration(userId).catch((e) => {
              console.error('[AuthProvider] handleDeviceRegistration error:', e);
            });
          }, 100); // 100ms遅延
        } else {
          // セッションがない場合は、すべてのユーザー関連データをクリア
          setProfile(null);
          setSubscription(null);
          setUsageInfo(null);
          setFreeAccessInfo(null);
          setUser(null); // 念のため明示的にnullに設定
          // デバイス関連の状態もクリア
          setDeviceLimitInfo(null);
          setShowDeviceLimitModal(false);
        }
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // 利用可否情報（usageInfo）の更新は、認証イベント（onAuthStateChange）と明示操作（refreshUsageInfo）で行う。
  // ※ useEffect内でrefreshUsageInfo/setStateを同期呼び出しすると、eslintのreact-hooks/set-state-in-effectに抵触するため。

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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (!error && data?.session) {
      // ログイン成功後、即座にセッションとユーザー情報を設定
      setSession(data.session);
      setUser(data.session.user);
      
      // プロファイルとその他の情報を取得（非同期で実行）
      if (data.session.user) {
        // デバイス登録処理を追加
        handleDeviceRegistration(data.session.user.id).catch((e) => {
          console.warn('[AuthProvider] Device registration failed:', e);
        });
        
        Promise.all([
          fetchProfile(data.session.user.id).catch(() => {}),
          fetchSubscription(data.session.user.id).catch(() => {}),
          refreshUsageInfo(data.session.user).catch(() => {})
        ]).catch(() => {});
      }
    }
    
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

  const resetPassword = async (email: string) => {
    if (!supabase) return { error: new Error('Supabase is not configured') };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
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
    // デバイス関連の状態もクリア
    setDeviceLimitInfo(null);
    setShowDeviceLimitModal(false);
    clearDeviceRegistration();
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
        // デバイス制限関連
        deviceInfo,
        deviceLimitInfo,
        showDeviceLimitModal,
        setShowDeviceLimitModal,
        removeDevice,
        retryDeviceRegistration,
        // 認証関数
        signInWithEmail,
        signInWithPassword,
        signUp,
        resetPassword,
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
