'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useReducedMotion, useIsMobile } from '@/hooks/useMediaQuery';

type Particle = {
  id: number;
  left: string;
  size: number;
  delay: number;
  duration: number;
};

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 4 + 2,
    delay: Math.random() * 5,
    duration: Math.random() * 8 + 6,
  }));
}

function Particles({
  count,
  reducedMotion,
}: {
  count: number;
  reducedMotion: boolean;
}) {
  const particles = useMemo(() => generateParticles(count), [count]);

  if (reducedMotion) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute bottom-0 rounded-full bg-white/20"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -800],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

export function CTASection() {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const particleCount = isMobile ? 8 : 15;

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-es-dark-blue via-es-blue to-es-teal py-24 sm:py-32">
      <Particles count={particleCount} reducedMotion={reducedMotion} />

      <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-8">
        <motion.h2
          className="text-3xl font-bold tracking-tight text-white sm:text-5xl"
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
        >
          今すぐ無料で添削を体験
        </motion.h2>

        <motion.p
          className="mt-6 text-lg text-slate-300"
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          初回3回無料 / クレジットカード不要
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Link
            href="/grading"
            className="inline-flex items-center rounded-full bg-es-teal px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-[#2DB3A0]/25 transition-transform hover:scale-105"
          >
            無料で始める
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center rounded-full border border-white/20 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-white/10"
          >
            料金プランを見る
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
