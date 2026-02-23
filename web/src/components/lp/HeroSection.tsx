'use client';

import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useReducedMotion, useIsMobile } from '@/hooks/useMediaQuery';
import { useMousePosition } from '@/hooks/useMousePosition';

export function HeroSection() {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const mouse = useMousePosition();

  // Mouse parallax: map mouse position to small offset values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Update motion values from mouse position (only on desktop)
  if (!isMobile && typeof window !== 'undefined') {
    mouseX.set((mouse.x - window.innerWidth / 2) / window.innerWidth);
    mouseY.set((mouse.y - window.innerHeight / 2) / window.innerHeight);
  }

  const springConfig = { stiffness: 50, damping: 30 };
  const parallaxX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), springConfig);
  const parallaxY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-10, 10]), springConfig);

  const fadeUp = reducedMotion
    ? {}
    : {
      initial: { opacity: 0, y: 30 },
      animate: { opacity: 1, y: 0 },
    };

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 -z-20">
        <motion.div
          className="absolute inset-0"
          style={{ x: parallaxX, y: parallaxY, scale: 1.05 }} // Slight parallax and scale to prevent edges showing
        >
          <img
            src="/bg-modern-desk.png"
            alt="Desk with manuscript background"
            className="h-full w-full object-cover"
          />
        </motion.div>
        {/* Overlay for text readability - Increased to 80% per user request */}
        <div className="absolute inset-0 bg-white/80" />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="mb-8 flex justify-center w-full"
            >
              <img
                src="/taskal-main-logo.png"
                alt="Taskal AI - 国語記述問題AI自動添削システム"
                className="h-auto w-full max-w-lg object-contain mix-blend-multiply"
              />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-6 text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent sm:text-4xl md:text-5xl"
            >
              国語の答案を、3分で<br />&ldquo;どこを直すべきか&rdquo;まで見える化。
            </motion.h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-10 max-w-4xl mx-auto text-lg text-slate-800 sm:text-xl font-medium leading-relaxed space-y-4"
          >
            <p>
              中学受験・高校受験で出題される記述問題<span className="text-base text-slate-600">（10文字〜400文字）</span>に対応。<br />
              国語の作文・論述問題もしっかりサポートします。
            </p>
            <p className="text-base text-slate-700">
              学習塾、学校、家庭教師、保護者様など、<br className="hidden sm:inline" />
              記述の採点に取り組まれる様々な方にご利用いただけます。
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col gap-4 sm:flex-row"
          >
            <Link
              href="/grading"
              className="inline-flex items-center justify-center rounded-full bg-es-teal px-8 py-4 text-lg font-bold text-white shadow-lg shadow-es-teal/25 transition-all hover:brightness-110 hover:shadow-xl hover:-translate-y-0.5"
            >
              無料で3回試す
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
        >
          <ChevronDown className="h-8 w-8 text-slate-400" />
        </motion.div>
      </motion.div>
    </section>
  );
}
