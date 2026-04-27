'use client';

/**
 * Always-visible "agent is alive" bar at the bottom of the app.
 * Shows: pulse indicator, current state, active jobs, uptime, last activity.
 * Inspired by Manus's persistent agent presence.
 */

import { useEffect, useState } from 'react';
import { useAgentStore } from '@/store/agent';
import { motion } from 'framer-motion';
import { Activity, Briefcase, Clock, Zap } from 'lucide-react';

const STARTED_AT_KEY = 'nexus-agent-started-at';

function getStartedAt(): number {
  if (typeof window === 'undefined') return Date.now();
  const existing = window.localStorage.getItem(STARTED_AT_KEY);
  if (existing) return Number(existing);
  const now = Date.now();
  window.localStorage.setItem(STARTED_AT_KEY, String(now));
  return now;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function AgentStatusBar() {
  const { isStreaming, phase, jobs, usageStats } = useAgentStore();
  const [now, setNow] = useState(() => Date.now());
  const [startedAt] = useState(getStartedAt);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'queued').length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;

  // Status: working > thinking > idle
  let state: 'working' | 'thinking' | 'idle' = 'idle';
  let stateLabel = 'Online';
  let pulseColor = 'bg-emerald-500';

  if (isStreaming) {
    if (phase === 'executing') { state = 'working'; stateLabel = 'Executing'; pulseColor = 'bg-amber-500'; }
    else if (phase === 'planning') { state = 'thinking'; stateLabel = 'Planning'; pulseColor = 'bg-sky-500'; }
    else if (phase === 'thinking') { state = 'thinking'; stateLabel = 'Thinking'; pulseColor = 'bg-sky-500'; }
    else if (phase === 'reflecting') { state = 'thinking'; stateLabel = 'Reflecting'; pulseColor = 'bg-violet-500'; }
    else { state = 'working'; stateLabel = 'Working'; pulseColor = 'bg-amber-500'; }
  } else if (activeJobs > 0) {
    state = 'working'; stateLabel = `${activeJobs} background ${activeJobs === 1 ? 'job' : 'jobs'}`; pulseColor = 'bg-amber-500';
  }

  const uptime = formatUptime(now - startedAt);

  return (
    <div className="h-7 flex items-center justify-between px-3 shrink-0 bg-[#1a1a1c] border-t border-[rgba(255,255,255,0.06)] text-[11px] select-none">
      {/* Left: pulse + state */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="relative w-2 h-2">
            <motion.div
              className={`absolute inset-0 rounded-full ${pulseColor}`}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            {state !== 'idle' && (
              <motion.div
                className={`absolute inset-0 rounded-full ${pulseColor} opacity-30`}
                animate={{ scale: [1, 2.5, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
            )}
          </div>
          <span className="text-[#dadada] font-medium">Nexus · {stateLabel}</span>
        </div>

        {activeJobs > 0 && (
          <div className="flex items-center gap-1 text-[#7f7f7f]">
            <Briefcase size={10} />
            <span>{activeJobs} active</span>
          </div>
        )}

        {completedJobs > 0 && (
          <div className="hidden sm:flex items-center gap-1 text-[#7f7f7f]">
            <Activity size={10} />
            <span>{completedJobs} done today</span>
          </div>
        )}
      </div>

      {/* Right: uptime + tasks */}
      <div className="flex items-center gap-3 text-[#7f7f7f]">
        <div className="hidden md:flex items-center gap-1">
          <Zap size={10} className="text-[#1a93fe]" />
          <span>{usageStats.tasksRun} {usageStats.tasksRun === 1 ? 'task' : 'tasks'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={10} />
          <span>uptime {uptime}</span>
        </div>
      </div>
    </div>
  );
}
