'use client';

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useMediaQuery';

const navLinks = [
  { label: '特長', href: '#features' },
  { label: '料金', href: '#pricing' },
  { label: '使い方', href: '#how-it-works' },
];

export function LPHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 50);
  });

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-slate-900/90 backdrop-blur-lg shadow-lg' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo-edushift.png" alt="EduShift" className="h-9 w-auto" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-slate-300 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/grading"
            className="rounded-full bg-es-teal px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            無料で試す
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="text-white md:hidden"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? 'メニューを閉じる' : 'メニューを開く'}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-slate-900/95 backdrop-blur-lg md:hidden"
          >
            <div className="flex flex-col gap-4 px-6 py-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-slate-300 transition-colors hover:text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/grading"
                className="rounded-full bg-es-teal px-5 py-2 text-center text-sm font-semibold text-white"
                onClick={() => setMobileOpen(false)}
              >
                無料で試す
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
