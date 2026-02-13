'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';

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
            <div className="rounded-lg bg-white px-4 py-2">
              <img src="/taskal-main-logo.png" alt="Taskal AI" className="h-20 w-auto mix-blend-multiply" />
            </div>
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
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} EduShift. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
