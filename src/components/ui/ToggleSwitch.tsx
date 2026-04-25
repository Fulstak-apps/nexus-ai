'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  className?: string;
}

export function ToggleSwitch({ checked, onChange, label, className }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn('flex items-center gap-2 group', className)}
      aria-pressed={checked}
    >
      <div
        className={cn(
          'relative w-10 h-6 rounded-full transition-colors duration-300',
          checked
            ? 'bg-gradient-to-r from-accent-blue to-accent-purple'
            : 'bg-black/10 dark:bg-white/10',
        )}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 700, damping: 35 }}
          className={cn(
            'absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm',
            checked ? 'left-5' : 'left-1',
          )}
        />
      </div>
      {label && (
        <span className="text-sm text-text-light dark:text-text-dark opacity-70 group-hover:opacity-100 transition-opacity">
          {label}
        </span>
      )}
    </button>
  );
}
