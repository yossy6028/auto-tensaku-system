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
            <div className="mb-6 inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-sm text-slate-600 backdrop-blur-sm shadow-sm font-semibold">
              EduShift AI
            </div>

            <h1 className="mb-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl">
              <span className="block mb-2 text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-slate-700">中学・高校受験国語記述添削システム</span>
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent block mt-4">
                記述問題の添削を、<br className="sm:hidden" />もっと速く、正確に。
              </span>
            </h1>
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
              href="/#features"
              className="inline-flex items-center justify-center rounded-full bg-white/80 px-8 py-4 text-base font-bold text-slate-700 shadow-md ring-1 ring-slate-200 backdrop-blur-sm transition-all hover:bg-white hover:text-[#1565C0] hover:shadow-lg hover:-translate-y-0.5"
            >
              機能を見る
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
