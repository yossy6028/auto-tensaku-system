'use client';

import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useReducedMotion, useIsMobile } from '@/hooks/useMediaQuery';
import { useMousePosition } from '@/hooks/useMousePosition';
import { FloatingElements } from './FloatingElements';

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
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-slate-900 via-[#0D47A1] to-[#0a3060]">
      {/* Floating background elements with parallax wrapper */}
      <motion.div
        className="absolute inset-0"
        style={!isMobile && !reducedMotion ? { x: parallaxX, y: parallaxY } : undefined}
      >
        <FloatingElements />
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-20 text-center">
        <motion.h1
          className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
          {...fadeUp}
          transition={{ duration: 0.6 }}
        >
          添削に1時間、
          <br className="sm:hidden" />
          もういらない。
        </motion.h1>

        <motion.p
          className="mx-auto mt-6 max-w-2xl text-lg text-slate-300 sm:text-xl"
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          AIが国語の記述問題を瞬時に採点。
          <br className="hidden sm:inline" />
          先生も保護者も、添削の負担から解放。
        </motion.p>

        <motion.div
          className="mt-10"
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Link
            href="/grading"
            className="inline-block rounded-full bg-es-teal px-8 py-4 text-lg font-bold text-white shadow-lg shadow-[#2DB3A0]/25 transition-transform hover:scale-105"
          >
            無料で試してみる
          </Link>
          <p className="mt-4 text-sm text-slate-400">
            初回3回無料・クレジットカード不要
          </p>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={reducedMotion ? {} : { y: [0, 8, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronDown className="h-6 w-6 text-slate-400" />
      </motion.div>
    </section>
  );
}
