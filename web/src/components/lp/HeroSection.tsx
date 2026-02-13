'use client';

import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useReducedMotion, useIsMobile } from '@/hooks/useMediaQuery';
import { useMousePosition } from '@/hooks/useMousePosition';
// FloatingElements removed as it was designed for dark theme
// import { FloatingElements } from './FloatingElements';

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
  const parallaxX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 15]), springConfig);
  const parallaxY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-15, 15]), springConfig);

  const fadeUp = reducedMotion
    ? {}
    : {
      initial: { opacity: 0, y: 30 },
      animate: { opacity: 1, y: 0 },
    };

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Realistic Background with Overlay */}
      <div className="absolute inset-0 -z-20">
        <img
          src="/bg-office.png"
          alt="Office Desk Background"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px]" />
      </div>

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-24 pb-12 lg:pt-32">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

          {/* Text Content */}
          <div className="flex-1 text-center lg:text-left">
            <motion.h1
              className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl"
              {...fadeUp}
              transition={{ duration: 0.6 }}
            >
              もう、夜中に
              <br className="sm:hidden" />
              <span className="text-indigo-600">赤ペン</span>握らなくていい。
            </motion.h1>

            <motion.p
              className="mx-auto mt-6 max-w-2xl text-lg text-slate-700 sm:text-xl lg:mx-0 font-medium"
              {...fadeUp}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              AIが記述問題を自動採点。
              <br className="hidden sm:inline" />
              先生は授業準備や生徒対応に集中できる。
            </motion.p>

            <motion.div
              className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
              {...fadeUp}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Link
                href="/grading"
                className="inline-block rounded-full bg-indigo-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 hover:bg-indigo-700 hover:shadow-indigo-600/40"
              >
                無料で試してみる
              </Link>
              <p className="text-sm text-slate-600 font-bold">
                初回3回無料・クレジットカード不要
              </p>
            </motion.div>
          </div>

          {/* Hero Image */}
          <div className="flex-1 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: 5 }}
              animate={{ opacity: 1, scale: 1, rotate: 2 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative mx-auto max-w-md lg:max-w-full"
            >
              <div className="absolute -inset-4 bg-indigo-600/20 blur-2xl rounded-full"></div>
              <img
                src="/hero-correction.png"
                alt="AI添削のイメージ"
                className="relative w-full h-auto rounded-3xl shadow-2xl border-4 border-white transform hover:rotate-0 transition-transform duration-500"
              />
            </motion.div>
          </div>

        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={reducedMotion ? {} : { y: [0, 8, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronDown className="h-8 w-8 text-slate-400" />
      </motion.div>
    </section>
  );
}
