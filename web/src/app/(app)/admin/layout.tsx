import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/auth/callback?next=/admin');
  }

  // サーバーサイドで管理者権限を検証
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase client型の互換性問題を回避
  const { data: profile } = await (supabase as any)
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = (profile as { role: string } | null)?.role;
  if (!role || role !== 'admin') {
    redirect('/grading');
  }

  return <>{children}</>;
}
