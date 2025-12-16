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
        // テーブルが存在しない、またはRLSポリシーでアクセスできない場合
        console.warn('[AuthProvider] Failed to fetch user profile:', error.message);
        setProfile(null);
        return;
      }

      if (data) {
        const userProfile = data as UserProfile;
        console.log('[AuthProvider] Profile fetched:', {
          userId: userProfile.id,
          role: userProfile.role,
          email: userProfile.email || 'no email'
        });
        setProfile(userProfile);
        // プロファイルが取得されたら、利用可否情報を更新（管理者チェックのため）
        if (userProfile.role === 'admin') {
          console.log('[AuthProvider] ✅ Admin profile detected, will update usage info');
        } else {
          console.log('[AuthProvider] ❌ Profile role is not admin:', userProfile.role);
        }
      } else {
        console.log('[AuthProvider] ❌ No profile data found');
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
      console.log('[AuthProvider] Registering device for user:', userId);
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
        
        console.log('[AuthProvider] Device registration result:', registrationResult);
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
        console.log('[AuthProvider] ✅ Device registered successfully:', result.message);
      } else {
        // デバイス上限に達している
        console.log('[AuthProvider] ⚠️ Device limit reached:', result.message);
        
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
      console.log('[AuthProvider] Removing device:', deviceId);
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
        console.log('[AuthProvider] Device removal result:', result);
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
  const refreshUsageInfo = useCallback(async () => {
    if (!supabaseClient) {
      console.log('[AuthProvider] refreshUsageInfo: supabaseClient is null');
      setUsageInfo(null);
      return;
    }
    
    if (!user) {
      console.log('[AuthProvider] refreshUsageInfo: user is null');
      setUsageInfo(null);
      return;
    }

    // セッションが存在することを確認
    if (!session) {
      console.log('[AuthProvider] refreshUsageInfo: session is null, skipping');
      setUsageInfo(null);
      return;
    }

    console.log('[AuthProvider] refreshUsageInfo called for user:', user.id);

    // プロファイルを直接取得して管理者チェック（profileがまだ取得されていない場合に備える）
    try {
      console.log('[AuthProvider] Checking admin status for user:', user.id);
      const { data: profileData, error: profileError } = await supabaseClient
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      console.log('[AuthProvider] Profile fetch result:', { 
        hasData: !!profileData, 
        role: profileData ? (profileData as { role?: string }).role : null,
        error: profileError?.message || null
      });

      if (!profileError && profileData && (profileData as { role?: string }).role === 'admin') {
        console.log('[AuthProvider] ✅ Admin user detected, setting unlimited access');
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
      } else {
        console.log('[AuthProvider] ❌ Not an admin user or profile fetch failed:', {
          profileError: profileError?.message,
          role: profileData ? (profileData as { role?: string }).role : 'no data'
        });
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
  }, [supabaseClient, user, session, fetchFreeAccessInfo]);

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
        
        const { data: { session } } = await Promise.race([sessionPromise, sessionTimeout]) as { data: { session: Session | null } };
        console.log('[AuthProvider] Session retrieved:', session ? 'Found' : 'Null');
        if (session?.user) {
          console.log('[AuthProvider] User ID:', session.user.id);
          console.log('[AuthProvider] User email:', session.user.email);
        }

        if (isMounted) {
          setSession(session);
          // セッションがない場合は、userも確実にnullに設定
          const user = session?.user ?? null;
          setUser(user);
          
          if (!session) {
            console.log('[AuthProvider] Session is null, clearing all user data');
            setProfile(null);
            setSubscription(null);
            setUsageInfo(null);
            setFreeAccessInfo(null);
          }
          
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
          // 注意: fetchFreeAccessInfo は refreshUsageInfo 内でのみ呼ぶ（サブスクリプション確認後）
          // 無条件で呼ぶと、有料プランユーザーにも「無料期間終了」モーダルが表示されてしまう
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
          console.log('[AuthProvider] Error occurred, setting isLoading to false');
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [supabase, fetchSystemSettings, fetchPlans, fetchProfile, fetchSubscription, handleDeviceRegistration]);

  // 認証状態の変更を監視
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] onAuthStateChange:', event, session ? 'session exists' : 'session null');
        setSession(session);
        const user = session?.user ?? null;
        setUser(user);

        if (session?.user) {
          // エラーは各関数内で処理されるため、ここでは静かに失敗させる
          await fetchProfile(session.user.id).catch(() => {});
          await fetchSubscription(session.user.id).catch(() => {});
          // 注意: fetchFreeAccessInfo は refreshUsageInfo 内でのみ呼ぶ（サブスクリプション確認後）
          // 無条件で呼ぶと、有料プランユーザーにも「無料期間終了」モーダルが表示されてしまう
          // 利用可否情報を更新（認証イベント由来で更新することで、useEffect内の同期setState連鎖を避ける）
          await refreshUsageInfo().catch(() => {});
          // デバイス登録処理
          handleDeviceRegistration(session.user.id).catch(() => {});
        } else {
          // セッションがない場合は、すべてのユーザー関連データをクリア
          console.log('[AuthProvider] Session is null, clearing all user data');
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
  }, [supabase, fetchProfile, fetchSubscription, handleDeviceRegistration, refreshUsageInfo]);

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
      console.log('[AuthProvider] Login successful, setting session immediately');
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
          refreshUsageInfo().catch(() => {})
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
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
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
