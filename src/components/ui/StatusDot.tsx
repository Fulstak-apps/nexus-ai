'use client';

import { cn } from '@/lib/utils';
import { ThinkingPhase } from '@/types';

interface StatusDotProps {
  phase: ThinkingPhase;
  className?: string;
}

const PHASE_CONFIG: Record<ThinkingPhase, { color: string; label: string; pulse: boolean }> = {
  idle: { color: 'bg-gray-400', label: 'Idle', pulse: false },
  thinking: { color: 'bg-accent-blue', label: 'Thinking', pulse: true },
  planning: { color: 'bg-accent-purple', label: 'Planning', pulse: true },
  executing: { color: 'bg-accent-teal', label: 'Executing', pulse: true },
  reflecting: { color: 'bg-amber-400', label: 'Reflecting', pulse: true },
};

export function StatusDot({ phase, className }: StatusDotProps) {
  const config = PHASE_CONFIG[phase];

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="relative">
        <div className={cn('w-2 h-2 rounded-full', config.color)} />
        {config.pulse && (
          <div className={cn('absolute inset-0 rounded-full animate-ping opacity-60', config.color)} />
        )}
      </div>
      <span className="text-xs font-medium opacity-60">{config.label}</span>
    </div>
  );
}
