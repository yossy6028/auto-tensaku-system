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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          role?: 'user' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          role?: 'user' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: 'active' | 'expired' | 'cancelled';
          usage_count: number;
          usage_limit: number | null;
          price_paid: number;
          purchased_at: string;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status?: 'active' | 'expired' | 'cancelled';
          usage_count?: number;
          usage_limit?: number | null;
          price_paid: number;
          purchased_at?: string;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          status?: 'active' | 'expired' | 'cancelled';
          usage_count?: number;
          usage_limit?: number | null;
          price_paid?: number;
          purchased_at?: string;
          expires_at?: string | null;
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
    };
  };
}

// ヘルパー型
export type PricingPlan = Database['public']['Tables']['pricing_plans']['Row'];
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type UsageLog = Database['public']['Tables']['usage_logs']['Row'];

