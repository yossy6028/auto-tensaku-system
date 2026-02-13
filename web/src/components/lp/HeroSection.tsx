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
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 -z-20">
        <motion.div
          className="absolute inset-0"
          style={{ x: parallaxX, y: parallaxY, scale: 1.05 }} // Slight parallax and scale to prevent edges showing
        >
          <img
            src="/bg-desk-correction.png"
            alt="Desk with manuscript background"
            className="h-full w-full object-cover"
          />
        </motion.div>
        {/* Strong overlay for text readability against the busy background */}
        <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-flex items-center rounded-full bg-blue-50/80 px-4 py-1.5 ring-1 ring-blue-100 backdrop-blur-sm"
          >
            <span className="mr-2 inline-block rounded-full bg-[#1565C0] px-2 py-0.5 text-[10px] font-bold text-white">
              NEW
            </span>
            <span className="text-sm font-medium text-[#0D47A1]">
              生成AIを活用した最新の添削システム
            </span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl md:text-6xl"
          >
            <span className="block text-[#1565C0] mb-2">記述・論述指導を、</span>
            <span className="block">もっと効率的に、効果的に。</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-10 max-w-2xl text-lg text-slate-700 sm:text-xl font-medium"
          >
            学習塾・学校・家庭教師・保護者様向け。<br className="hidden sm:inline" />
            AIによる高品質な添削サポートで、<br className="hidden sm:inline" />
            生徒一人ひとりへの指導時間を最大化します。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col gap-4 sm:flex-row"
          >
            <Link
              href="/#contact"
              className="inline-flex items-center justify-center rounded-full bg-[#1565C0] px-8 py-4 text-base font-bold text-white shadow-lg transition-all hover:bg-[#0D47A1] hover:shadow-xl hover:-translate-y-0.5"
            >
              無料で相談する
            </Link>
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
