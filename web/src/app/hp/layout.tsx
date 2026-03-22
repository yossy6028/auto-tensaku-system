import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HP制作実績 — EduShift',
  description: '教育事業者さま向けホームページリニューアル実績一覧',
};

export default function HPLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
