'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ChevronDown, UserRound } from 'lucide-react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useMousePosition } from '@/hooks/useMousePosition';

export function HeroSection() {
  const isMobile = useIsMobile();
  const mouse = useMousePosition();

  // Mouse parallax: map mouse position to small offset values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    if (isMobile) {
      mouseX.set(0);
      mouseY.set(0);
      return;
    }

    mouseX.set((mouse.x - window.innerWidth / 2) / window.innerWidth);
    mouseY.set((mouse.y - window.innerHeight / 2) / window.innerHeight);
  }, [isMobile, mouse.x, mouse.y, mouseX, mouseY]);

  const springConfig = { stiffness: 50, damping: 30 };
  const parallaxX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), springConfig);
  const parallaxY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-10, 10]), springConfig);

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 -z-20">
        <motion.div
          className="absolute inset-0"
          style={{ x: parallaxX, y: parallaxY, scale: 1.05 }} // Slight parallax and scale to prevent edges showing
        >
          <Image
            src="/bg-modern-desk.png"
            alt="Desk with manuscript background"
            fill
            priority
            sizes="100vw"
            className="object-cover"
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
              <Image
                src="/taskal-main-logo.png"
                alt="Taskal AI - 国語記述問題AI自動添削システム"
                width={1100}
                height={360}
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="h-auto w-full max-w-lg object-contain mix-blend-multiply"
              />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-6 text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent sm:text-5xl md:text-6xl"
            >
              記述の採点、1枚3分。
            </motion.h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8 max-w-4xl mx-auto text-lg text-slate-800 sm:text-xl font-medium leading-relaxed space-y-4"
          >
            <p>
              中学受験・高校受験の国語記述に特化したAI採点。<br />
              点数・減点理由・書き直し例まで、数分で返します。
            </p>
            <p className="text-base text-slate-700">
              塾講師・家庭教師の添削時間を、指導の時間に。<br className="hidden sm:inline" />
              ご家庭での見直しにもお使いいただけます。
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-10 flex items-center gap-3 rounded-full border border-es-teal/20 bg-white/70 px-4 py-2.5 shadow-sm backdrop-blur-sm sm:px-5"
          >
            {/* 顔写真は保留。後日ここに Image を差し込む想定でスロットを確保 */}
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-es-teal-light">
              <UserRound className="h-5 w-5 text-es-teal" />
            </span>
            <p className="text-left text-xs text-slate-700 sm:text-sm">
              <span className="font-bold text-slate-900">開発・監修: 吉井勝彦</span>
              <span className="mx-1.5 text-slate-300">|</span>
              指導歴20年超の現役国語講師 / EduShift代表
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/grading"
                className="inline-flex items-center justify-center rounded-full bg-es-teal px-8 py-4 text-lg font-bold text-white shadow-lg shadow-es-teal/25 transition-all hover:brightness-110 hover:shadow-xl hover:-translate-y-0.5"
              >
                無料で5回試す
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center justify-center rounded-full border-2 border-es-teal/40 bg-white/70 px-8 py-4 text-lg font-bold text-es-teal backdrop-blur-sm transition-all hover:border-es-teal hover:bg-white hover:-translate-y-0.5"
              >
                登録不要で採点を体験
              </a>
            </div>
            <p className="text-sm text-slate-600">
              メールアドレスだけで登録・1分／クレジットカード不要
            </p>
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
