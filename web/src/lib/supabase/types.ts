export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      pricing_plans: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          usage_limit: number | null;
          price_yen: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          usage_limit?: number | null;
          price_yen: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          usage_limit?: number | null;
          price_yen?: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          role: 'user' | 'admin';
          stripe_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          role?: 'user' | 'admin';
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          role?: 'user' | 'admin';
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: 'active' | 'expired' | 'cancelled' | 'past_due';
          usage_count: number;
          usage_limit: number | null;
          price_paid: number;
          purchased_at: string;
          expires_at: string | null;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status?: 'active' | 'expired' | 'cancelled' | 'past_due';
          usage_count?: number;
          usage_limit?: number | null;
          price_paid: number;
          purchased_at?: string;
          expires_at?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          status?: 'active' | 'expired' | 'cancelled' | 'past_due';
          usage_count?: number;
          usage_limit?: number | null;
          price_paid?: number;
          purchased_at?: string;
          expires_at?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      usage_logs: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string;
          action_type: 'grading';
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id: string;
          action_type?: 'grading';
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription_id?: string;
          action_type?: 'grading';
          metadata?: Json;
          created_at?: string;
        };
      };
      system_settings: {
        Row: {
          key: string;
          value: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          key: string;
          value?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          key?: string;
          value?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      user_devices: {
        Row: {
          id: string;
          user_id: string;
          device_fingerprint: string;
          device_name: string | null;
          user_agent: string | null;
          ip_address: string | null;
          last_active_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_fingerprint: string;
          device_name?: string | null;
          user_agent?: string | null;
          ip_address?: string | null;
          last_active_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_fingerprint?: string;
          device_name?: string | null;
          user_agent?: string | null;
          ip_address?: string | null;
          last_active_at?: string;
          created_at?: string;
        };
      };
    };
    Functions: {
      can_use_service: {
        Args: { p_user_id: string };
        Returns: {
          can_use: boolean;
          message: string;
          usage_count: number | null;
          usage_limit: number | null;
          remaining_count: number | null;
          plan_name: string | null;
        }[];
      };
      check_free_access: {
        Args: { p_user_id: string };
        Returns: {
          has_free_access: boolean;
          free_access_type: string | null;
          message: string | null;
          trial_days_remaining: number | null;
          trial_usage_remaining: number | null;
          promo_end_date: string | null;
        }[];
      };
      increment_usage: {
        Args: { p_user_id: string; p_metadata?: Json };
        Returns: {
          success: boolean;
          message: string;
          subscription_id: string | null;
          new_usage_count: number | null;
          usage_limit: number | null;
          remaining_count: number | null;
        }[];
      };
      reserve_usage: {
        Args: { p_user_id: string; p_count?: number };
        Returns: {
          success: boolean;
          message: string;
          subscription_id: string | null;
          usage_count: number | null;
          usage_limit: number | null;
          remaining_count: number | null;
          plan_name: string | null;
        }[];
      };
      release_usage: {
        Args: { p_user_id: string; p_count?: number };
        Returns: {
          success: boolean;
          message: string;
        }[];
      };
      get_active_subscription: {
        Args: { p_user_id: string };
        Returns: {
          subscription_id: string;
          plan_id: string;
          usage_count: number;
          usage_limit: number | null;
          remaining_count: number | null;
        }[];
      };
      register_device: {
        Args: {
          p_user_id: string;
          p_device_fingerprint: string;
          p_device_name?: string | null;
          p_user_agent?: string | null;
          p_ip_address?: string | null;
        };
        Returns: {
          success: boolean;
          message: string;
          device_id: string | null;
          is_new_device: boolean;
          current_device_count: number;
          max_devices: number | null;
        }[];
      };
      get_user_devices: {
        Args: { p_user_id: string };
        Returns: {
          device_id: string;
          device_fingerprint: string;
          device_name: string | null;
          user_agent: string | null;
          last_active_at: string;
          created_at: string;
          is_current: boolean;
        }[];
      };
      remove_device: {
        Args: { p_user_id: string; p_device_id: string };
        Returns: {
          success: boolean;
          message: string;
        }[];
      };
      check_device_access: {
        Args: { p_user_id: string; p_device_fingerprint: string };
        Returns: {
          has_access: boolean;
          message: string;
          device_count: number;
          max_devices: number | null;
        }[];
      };
    };
  };
}

// ヘルパー型
export type PricingPlan = Database['public']['Tables']['pricing_plans']['Row'];
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type UsageLog = Database['public']['Tables']['usage_logs']['Row'];
export type UserDevice = Database['public']['Tables']['user_devices']['Row'];

// デバイス関連の型
export interface DeviceInfo {
  fingerprint: string;
  deviceName: string;
  userAgent: string;
}

export interface DeviceRegistrationResult {
  success: boolean;
  message: string;
  deviceId: string | null;
  isNewDevice: boolean;
  currentDeviceCount: number;
  maxDevices: number | null;
}

export interface DeviceAccessResult {
  hasAccess: boolean;
  message: string;
  deviceCount: number;
  maxDevices: number | null;
}

