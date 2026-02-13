'use client';

import { motion } from 'framer-motion';
import { useReducedMotion, useIsMobile } from '@/hooks/useMediaQuery';

type FloatingShape = {
  id: number;
  type: 'circle' | 'triangle' | 'square' | 'hexagon' | 'ring';
  size: number;
  x: string;
  y: string;
  delay: number;
  duration: number;
  opacity: number;
  color: string;
};

const shapes: FloatingShape[] = [
  { id: 1, type: 'circle', size: 60, x: '10%', y: '20%', delay: 0, duration: 5, opacity: 0.15, color: '#2DB3A0' },
  { id: 2, type: 'triangle', size: 40, x: '80%', y: '15%', delay: 1.2, duration: 6, opacity: 0.12, color: '#1565C0' },
  { id: 3, type: 'square', size: 35, x: '70%', y: '60%', delay: 0.8, duration: 7, opacity: 0.1, color: '#2DB3A0' },
  { id: 4, type: 'hexagon', size: 50, x: '20%', y: '70%', delay: 2, duration: 5.5, opacity: 0.12, color: '#0D47A1' },
  { id: 5, type: 'ring', size: 70, x: '90%', y: '40%', delay: 0.5, duration: 6.5, opacity: 0.1, color: '#1565C0' },
  { id: 6, type: 'circle', size: 25, x: '50%', y: '10%', delay: 1.5, duration: 4.5, opacity: 0.15, color: '#2DB3A0' },
  { id: 7, type: 'triangle', size: 30, x: '35%', y: '85%', delay: 2.5, duration: 5, opacity: 0.08, color: '#1565C0' },
];

function ShapeSVG({ type, size, color }: { type: FloatingShape['type']; size: number; color: string }) {
  switch (type) {
    case 'circle':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill={color} />
        </svg>
      );
    case 'triangle':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100">
          <polygon points="50,5 95,95 5,95" fill={color} />
        </svg>
      );
    case 'square':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100">
          <rect x="10" y="10" width="80" height="80" rx="8" fill={color} />
        </svg>
      );
    case 'hexagon':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100">
          <polygon points="50,3 93,25 93,75 50,97 7,75 7,25" fill={color} />
        </svg>
      );
    case 'ring':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="6" />
        </svg>
      );
  }
}

export function FloatingElements() {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  if (reducedMotion || isMobile) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {shapes.map((shape) => (
        <motion.div
          key={shape.id}
          className="absolute"
          style={{ left: shape.x, top: shape.y, opacity: shape.opacity }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 10, -10, 0],
          }}
          transition={{
            duration: shape.duration,
            repeat: Infinity,
            delay: shape.delay,
            ease: 'easeInOut',
          }}
        >
          <ShapeSVG type={shape.type} size={shape.size} color={shape.color} />
        </motion.div>
      ))}
    </div>
  );
}
