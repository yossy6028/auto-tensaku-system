'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { SUPPORT_EMAIL, SUPPORT_MAILTO_HREF } from '@/lib/constants/contact';

const footerLinks = [
  { label: '料金プラン', href: '/pricing' },
  { label: 'プライバシーポリシー', href: '/privacy' },
  { label: '特定商取引法に基づく表記', href: '/privacy#tokushoho' },
];

export function LPFooter() {
  return (
    <footer className="bg-es-surface-deep-navy py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-edushift.png" alt="EduShift" className="h-12 w-auto brightness-0 invert" />
          </Link>
          <nav className="flex flex-wrap justify-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-slate-400 transition-colors hover:text-slate-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 border-t border-white/10 pt-8 text-center">
          <p className="mb-3 text-sm text-slate-400">
            不具合・お問い合わせは{' '}
            <a href={SUPPORT_MAILTO_HREF} className="font-medium text-slate-200 underline-offset-4 hover:underline">
              {SUPPORT_EMAIL}
            </a>
            {' '}まで
          </p>
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} EduShift. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
