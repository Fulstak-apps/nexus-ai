'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import React from 'react';

type GlassPanelProps = {
  variant?: 'default' | 'elevated' | 'subtle' | 'bordered';
  glow?: boolean;
  hover?: boolean;
} & Omit<HTMLMotionProps<'div'>, 'children'> & {
  children?: React.ReactNode;
};

export function GlassPanel({
  children,
  className,
  variant = 'default',
  glow = false,
  hover = false,
  ...props
}: GlassPanelProps) {
  return (
    <motion.div
      {...(props as HTMLMotionProps<'div'>)}
      className={cn(
        // Base glass
        'relative overflow-hidden rounded-glass backdrop-blur-glass border',
        // Light mode
        'bg-white/60 border-white/40 shadow-glass',
        // Dark mode
        'dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-glass-dark',
        // Variants
        variant === 'elevated' && 'bg-white/75 shadow-lift dark:bg-white/[0.07] dark:shadow-lift-dark',
        variant === 'subtle'   && 'bg-white/30 shadow-none dark:bg-white/[0.02]',
        variant === 'bordered' && 'border-white/60 dark:border-white/[0.15]',
        // Glow
        glow  && 'animate-glow',
        // Hover
        hover && 'transition-all duration-200 hover:shadow-lift hover:-translate-y-0.5 dark:hover:shadow-lift-dark',
        className,
      )}
    >
      {/* Specular inner highlight */}
      <div className="pointer-events-none absolute inset-0 rounded-glass bg-gradient-to-br from-white/20 to-transparent dark:from-white/[0.04]" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
