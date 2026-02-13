'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useMediaQuery';

export function VideoPlaceholder() {
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Gradient border wrapper */}
          <div className="rounded-2xl bg-gradient-to-br from-es-blue via-es-dark-blue to-es-teal p-[2px] shadow-lg">
            <div className="relative overflow-hidden rounded-2xl bg-es-surface-dark">
              <video
                ref={videoRef}
                src="/taskal-ai-demo.mp4"
                className="aspect-video w-full"
                controls={isPlaying}
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
              {/* Play overlay */}
              {!isPlaying && (
                <button
                  onClick={handlePlay}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 transition-colors hover:bg-black/20"
                >
                  <motion.div
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
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
                  <p className="mt-6 text-sm text-white/80">
                    デモ動画を再生
                  </p>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
