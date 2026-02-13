'use client';

import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useMediaQuery';

export function VideoPlaceholder() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="bg-slate-900 py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Gradient border wrapper */}
          <div className="rounded-2xl bg-gradient-to-br from-es-blue via-es-dark-blue to-es-teal p-[2px]">
            <div className="flex aspect-video flex-col items-center justify-center rounded-2xl bg-slate-950">
              <motion.div
                className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm"
                animate={
                  reducedMotion
                    ? undefined
                    : {
                        boxShadow: [
                          '0 0 0 0 rgba(99, 102, 241, 0.4)',
                          '0 0 0 20px rgba(99, 102, 241, 0)',
                        ],
                      }
                }
                transition={
                  reducedMotion
                    ? undefined
                    : { duration: 2, repeat: Infinity, ease: 'easeOut' }
                }
              >
                <Play className="ml-1 h-10 w-10 text-white" />
              </motion.div>
              <p className="mt-6 text-sm text-slate-400">
                デモ動画（近日公開）
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
