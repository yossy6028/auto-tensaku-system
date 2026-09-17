'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

type LandingPrimaryCtaProps = {
  className: string;
  trialLabel?: string;
};

/**
 * LP上の主要導線。認証の確定前は無料体験と表示せず、既存利用者には採点画面を案内する。
 */
export function LandingPrimaryCta({
  className,
  trialLabel = '無料で5回試す',
}: LandingPrimaryCtaProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <span className={className} aria-busy="true">
        利用状況を確認中…
      </span>
    );
  }

  if (user) {
    return (
      <Link href="/grading" className={className}>
        採点画面へ
      </Link>
    );
  }

  return (
    <Link href="/grading" className={className}>
      {trialLabel}
    </Link>
  );
}
