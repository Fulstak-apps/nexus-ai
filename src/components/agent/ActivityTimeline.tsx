'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '@/store/agent';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function ActivityTimeline() {
  const { currentPlan, phase } = useAgentStore();
  const [collapsed, setCollapsed] = useState(false);

  if (!currentPlan || phase === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-4 mb-2"
      >
        <GlassPanel className="overflow-hidden">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-accent-blue animate-spin" />
              <span className="text-xs font-semibold">{currentPlan.goal}</span>
            </div>
            <ChevronDown className={cn(
              'w-3.5 h-3.5 opacity-50 transition-transform',
              collapsed && '-rotate-90',
            )} />
          </button>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 space-y-1.5">
                  {currentPlan.steps.map((step, i) => {
                    const isActive = step.status === 'executing' || step.status === 'reflecting';
                    const isDone = step.status === 'completed';
                    const isFailed = step.status === 'failed';

                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={cn(
                          'flex items-center gap-2.5 px-2.5 py-1.5 rounded-glass-sm transition-all',
                          isActive && 'bg-accent-blue/8 dark:bg-accent-blue/12',
                          isDone && 'opacity-60',
                        )}
                      >
                        {/* Status icon */}
                        <div className="shrink-0">
                          {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                          {isFailed && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          {isActive && <Loader2 className="w-3.5 h-3.5 text-accent-blue animate-spin" />}
                          {step.status === 'pending' && <Circle className="w-3.5 h-3.5 opacity-30" />}
                        </div>

                        {/* Step info */}
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            'text-xs font-medium truncate',
                            isActive ? 'text-accent-blue' : '',
                          )}>
                            {step.title}
                          </div>
                          {step.toolsNeeded.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {step.toolsNeeded.slice(0, 3).map(t => (
                                <span key={t} className="text-[9px] px-1 py-0 rounded bg-black/5 dark:bg-white/5 font-mono opacity-60">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Reflection quality badge */}
                        {step.reflection && (
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded font-medium',
                            step.reflection.quality === 'excellent' ? 'bg-green-500/10 text-green-500' :
                            step.reflection.quality === 'good' ? 'bg-accent-blue/10 text-accent-blue' :
                            step.reflection.quality === 'partial' ? 'bg-amber-400/10 text-amber-400' :
                            'bg-red-500/10 text-red-500',
                          )}>
                            {step.reflection.quality}
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassPanel>
      </motion.div>
    </AnimatePresence>
  );
}
