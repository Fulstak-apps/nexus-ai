'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '@/store/agent';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn, formatDate } from '@/lib/utils';
import {
  Brain, Database, FileText, Cpu, Settings,
  CheckCircle2, Circle, AlertCircle, Loader2,
  Trash2, RefreshCw, Download, Upload, Search, Moon, Sun, Monitor,
  Briefcase, Users, Play, XCircle, Clock,
} from 'lucide-react';
import { BackgroundJob, SubAgent } from '@/types';

const TABS = [
  { id: 'reasoning' as const, label: 'Plan', icon: Brain },
  { id: 'agents' as const, label: 'Agents', icon: Users },
  { id: 'jobs' as const, label: 'Jobs', icon: Briefcase },
  { id: 'memory' as const, label: 'Memory', icon: Database },
  { id: 'files' as const, label: 'Files', icon: FileText },
  { id: 'context' as const, label: 'Context', icon: Cpu },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
];

const STEP_STATUS_ICON = {
  pending: Circle, planning: Loader2, executing: Loader2,
  reflecting: Loader2, completed: CheckCircle2, failed: AlertCircle,
};

const STEP_STATUS_COLOR = {
  pending: 'text-gray-400',
  planning: 'text-accent-blue animate-spin',
  executing: 'text-accent-teal animate-spin',
  reflecting: 'text-amber-400 animate-spin',
  completed: 'text-green-500',
  failed: 'text-red-500',
};

export function RightPanel() {
  const { rightPanelTab, setRightPanelTab, currentPlan, phase } = useAgentStore();

  return (
    <aside className="w-72 shrink-0 h-full">
      <GlassPanel variant="subtle" className="flex flex-col h-full rounded-none border-l border-r-0 border-t-0 border-b-0">
        {/* Tab bar */}
        <div className="flex border-b border-white/20 dark:border-white/[0.06] px-1 pt-2 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setRightPanelTab(id)}
              className={cn(
                'flex items-center gap-1 px-2 py-2 text-[10px] font-medium rounded-t-lg transition-all shrink-0',
                rightPanelTab === id
                  ? 'bg-white/60 dark:bg-white/[0.08] text-accent-blue border-b-2 border-accent-blue'
                  : 'opacity-50 hover:opacity-80',
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {rightPanelTab === 'reasoning' && (
              <motion.div key="reasoning" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                {currentPlan ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold opacity-50 uppercase tracking-wider">Active Plan</div>
                    <GlassPanel variant="elevated" className="p-3">
                      <div className="text-xs font-medium mb-3 text-accent-blue">{currentPlan.goal}</div>
                      <div className="space-y-2">
                        {currentPlan.steps.map((step, i) => {
                          const Icon = STEP_STATUS_ICON[step.status];
                          return (
                            <motion.div key={step.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-2">
                              <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', STEP_STATUS_COLOR[step.status])} />
                              <div className="min-w-0">
                                <div className="text-xs font-medium leading-tight">{step.title}</div>
                                {step.reflection && (
                                  <div className={cn(
                                    'text-[10px] mt-0.5 font-medium',
                                    step.reflection.quality === 'excellent' ? 'text-green-500' :
                                    step.reflection.quality === 'good' ? 'text-accent-blue' :
                                    step.reflection.quality === 'partial' ? 'text-amber-400' :
                                    'text-red-500',
                                  )}>{step.reflection.quality}</div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </GlassPanel>
                  </div>
                ) : (
                  <div className="text-center py-8 opacity-30">
                    <Brain className="w-8 h-8 mx-auto mb-2" />
                    <div className="text-xs">No active plan</div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-semibold opacity-50 uppercase tracking-wider">Agent Phase</div>
                  <GlassPanel className="p-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        phase === 'idle' ? 'bg-gray-400' :
                        phase === 'thinking' ? 'bg-accent-blue animate-pulse' :
                        phase === 'planning' ? 'bg-accent-purple animate-pulse' :
                        phase === 'executing' ? 'bg-accent-teal animate-pulse' :
                        'bg-amber-400 animate-pulse',
                      )} />
                      <span className="text-sm font-medium capitalize">{phase}</span>
                    </div>
                  </GlassPanel>
                </div>
              </motion.div>
            )}

            {rightPanelTab === 'agents' && <AgentsTab key="agents" />}
            {rightPanelTab === 'jobs' && <JobsTab key="jobs" />}
            {rightPanelTab === 'memory' && <MemoryTab key="memory" />}
            {rightPanelTab === 'files'  && <FilesTab  key="files" />}
            {rightPanelTab === 'context' && <ContextTab key="context" />}
            {rightPanelTab === 'settings' && <SettingsTab key="settings" />}
          </AnimatePresence>
        </div>
      </GlassPanel>
    </aside>
  );
}

// ─── Agents Tab ───────────────────────────────────────────────────────────────

function AgentsTab() {
  const { activeAgents, researchPhase, phase } = useAgentStore();

  const statusColor: Record<string, string> = {
    pending: 'text-gray-400',
    running: 'text-accent-blue',
    completed: 'text-green-500',
    failed: 'text-red-500',
  };

  const roleColor: Record<string, string> = {
    researcher: 'bg-accent-blue/15 text-accent-blue',
    coder: 'bg-accent-purple/15 text-accent-purple',
    analyst: 'bg-accent-teal/15 text-accent-teal',
    writer: 'bg-amber-400/15 text-amber-400',
    designer: 'bg-pink-400/15 text-pink-400',
    assistant: 'bg-gray-400/15 text-gray-400',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="text-xs font-semibold opacity-50 uppercase tracking-wider">Active Sub-Agents</div>

      {researchPhase && (
        <GlassPanel variant="elevated" className="p-3">
          <div className="flex items-center gap-2 text-accent-blue">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs font-medium">Research: {researchPhase}</span>
          </div>
        </GlassPanel>
      )}

      {activeAgents.length === 0 && !researchPhase ? (
        <div className="text-center py-8 opacity-30">
          <Users className="w-8 h-8 mx-auto mb-2" />
          <div className="text-xs">No active sub-agents</div>
          <div className="text-[10px] mt-1">Use spawn_agent or multi-agent mode</div>
        </div>
      ) : (
        <div className="space-y-2">
          {activeAgents.map((agent, i) => (
            <motion.div key={agent.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <GlassPanel className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', roleColor[agent.role] ?? roleColor.assistant)}>
                    {agent.role}
                  </span>
                  <div className={cn(
                    'w-2 h-2 rounded-full ml-auto',
                    agent.status === 'running' ? 'bg-accent-blue animate-pulse' :
                    agent.status === 'completed' ? 'bg-green-500' :
                    agent.status === 'failed' ? 'bg-red-500' : 'bg-gray-400',
                  )} />
                </div>
                <div className="text-xs leading-snug opacity-80 truncate">{agent.task}</div>
                {agent.status === 'completed' && agent.result && (
                  <div className="text-[10px] opacity-60 leading-snug line-clamp-2">{agent.result}</div>
                )}
                <div className={cn('text-[10px] font-medium', statusColor[agent.status])}>
                  {agent.status}
                  {agent.completedAt && ` · ${Math.round((agent.completedAt - agent.startedAt) / 1000)}s`}
                </div>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────

function JobsTab() {
  const { jobs, setJobs } = useAgentStore();
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/jobs').then(r => r.json()) as { jobs: BackgroundJob[] };
      setJobs(r.jobs ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 3000);
    return () => clearInterval(i);
  }, []);

  const deleteJob = async (id: string) => {
    await fetch(`/api/jobs?id=${id}`, { method: 'DELETE' });
    await load();
  };

  const clearDone = async () => {
    await fetch('/api/jobs?clearDone=1', { method: 'DELETE' });
    await load();
  };

  const statusColor: Record<string, string> = {
    queued: 'text-gray-400',
    running: 'text-accent-blue',
    completed: 'text-green-500',
    failed: 'text-red-500',
    cancelled: 'text-gray-400',
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'running') return <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-blue" />;
    if (status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    if (status === 'failed') return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    return <Clock className="w-3.5 h-3.5 text-gray-400" />;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold opacity-50 uppercase tracking-wider">Background Jobs</div>
        <div className="flex gap-1">
          <button onClick={load} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100">
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </button>
          {jobs.some(j => j.status === 'completed' || j.status === 'failed') && (
            <button onClick={clearDone} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20">
              Clear done
            </button>
          )}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-8 opacity-30">
          <Briefcase className="w-8 h-8 mx-auto mb-2" />
          <div className="text-xs">No background jobs</div>
          <div className="text-[10px] mt-1">Switch to Background mode to queue tasks</div>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job, i) => (
            <motion.div key={job.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <GlassPanel className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <StatusIcon status={job.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium leading-tight truncate">{job.title}</div>
                    <div className={cn('text-[10px] font-medium mt-0.5', statusColor[job.status])}>
                      {job.status}
                      {job.completedAt && ` · ${Math.round((job.completedAt - job.createdAt) / 1000)}s`}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteJob(job.id)}
                    className="opacity-40 hover:opacity-100 hover:text-red-500 p-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {job.status === 'running' && (
                  <div className="h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-blue transition-all duration-500"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}

                {job.result && (
                  <div className="text-[10px] opacity-70 leading-snug line-clamp-3 bg-green-500/5 rounded p-1.5">
                    {job.result.slice(0, 200)}
                  </div>
                )}
                {job.error && (
                  <div className="text-[10px] text-red-500 opacity-80 leading-snug line-clamp-2">
                    {job.error}
                  </div>
                )}
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Memory Tab ───────────────────────────────────────────────────────────────

interface MemEntry { id: string; content: string; type: string; createdAt: number }

function MemoryTab() {
  const [memories, setMemories] = useState<MemEntry[]>([]);
  const [stats, setStats] = useState<{ total: number; byType: Record<string, number> } | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [memRes, statsRes] = await Promise.all([
        fetch(query ? `/api/memory?q=${encodeURIComponent(query)}` : '/api/memory').then(r => r.json()),
        fetch('/api/memory?stats=1').then(r => r.json()),
      ]);
      setMemories(memRes.memories ?? memRes.results ?? []);
      setStats(statsRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const typeColor = (t: string) =>
    t === 'task' ? 'bg-accent-blue/15 text-accent-blue' :
    t === 'session' ? 'bg-accent-purple/15 text-accent-purple' :
    t === 'insight' ? 'bg-accent-teal/15 text-accent-teal' :
    'bg-amber-400/15 text-amber-400';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Search memory…"
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-glass-sm bg-white/40 dark:bg-white/[0.04] border border-white/30 dark:border-white/[0.06] outline-none focus:border-accent-blue"
          />
        </div>
        <button onClick={load} className="p-1.5 rounded-glass-sm hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {stats && (
        <GlassPanel className="p-2.5">
          <div className="text-[10px] opacity-50 mb-1">Total: {stats.total}</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(stats.byType).map(([k, v]) => (
              <span key={k} className={cn('text-[10px] px-1.5 py-0.5 rounded', typeColor(k))}>
                {k}: {v}
              </span>
            ))}
          </div>
        </GlassPanel>
      )}

      <div className="space-y-2">
        {memories.length === 0 && !loading && (
          <div className="text-center py-6 opacity-30">
            <Database className="w-7 h-7 mx-auto mb-1" />
            <div className="text-xs">No memories yet</div>
          </div>
        )}
        {memories.map(m => (
          <GlassPanel key={m.id} className="p-2.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', typeColor(m.type))}>{m.type}</span>
              <span className="text-[10px] opacity-40">{formatDate(m.createdAt)}</span>
            </div>
            <div className="text-xs leading-snug opacity-80">{m.content}</div>
          </GlassPanel>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Files Tab ────────────────────────────────────────────────────────────────

interface SandboxItem { name: string; size: number; modifiedAt: number; isDirectory: boolean }

function FilesTab() {
  const [items, setItems] = useState<SandboxItem[]>([]);
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null);

  const load = async () => {
    const r = await fetch('/api/sandbox').then(r => r.json());
    setItems(r.items ?? []);
  };

  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, []);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    await fetch('/api/sandbox', { method: 'POST', body: fd });
    await load();
  };

  const onDelete = async (name: string) => {
    await fetch(`/api/sandbox?file=${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (preview?.name === name) setPreview(null);
    await load();
  };

  const openPreview = async (name: string) => {
    const r = await fetch(`/api/sandbox?file=${encodeURIComponent(name)}`).then(r => r.json());
    if (r.content !== undefined) setPreview({ name, content: r.content });
  };

  const downloadFile = (name: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs opacity-60">{items.length} items in sandbox</span>
        <label className="flex items-center gap-1 px-2 py-1 rounded-glass-sm bg-accent-blue/10 text-accent-blue text-xs font-medium cursor-pointer hover:bg-accent-blue/20">
          <Upload className="w-3 h-3" />
          Upload
          <input type="file" onChange={onUpload} className="hidden" />
        </label>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6 opacity-30">
          <FileText className="w-7 h-7 mx-auto mb-1" />
          <div className="text-xs">Sandbox is empty</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map(f => (
            <GlassPanel key={f.name} className="p-2.5 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 opacity-50 shrink-0" />
              <button onClick={() => openPreview(f.name)} className="flex-1 min-w-0 text-left">
                <div className="text-xs font-medium truncate">{f.name}</div>
                <div className="text-[10px] opacity-40">
                  {f.isDirectory ? 'directory' : `${f.size} bytes`} · {formatDate(f.modifiedAt)}
                </div>
              </button>
              <button onClick={() => onDelete(f.name)} className="p-1 rounded hover:bg-red-500/10 opacity-40 hover:opacity-100 hover:text-red-500">
                <Trash2 className="w-3 h-3" />
              </button>
            </GlassPanel>
          ))}
        </div>
      )}

      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreview(null)} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()} className="w-full max-w-2xl max-h-[80vh]">
              <GlassPanel variant="elevated" className="flex flex-col h-full max-h-[80vh]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 dark:border-white/[0.06]">
                  <span className="font-mono text-xs font-medium">{preview.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadFile(preview.name, preview.content)}
                      className="opacity-60 hover:opacity-100 text-xs flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Download
                    </button>
                    <button onClick={() => setPreview(null)} className="opacity-60 hover:opacity-100">✕</button>
                  </div>
                </div>
                <pre className="flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap break-all">
                  {preview.content}
                </pre>
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Context Tab ──────────────────────────────────────────────────────────────

const MODEL_LABELS: Record<string, string> = {
  lite: 'Qwen 3.5 4B (qwen3.5:4b)',
  pro:  'Gemma 4 8B (gemma4:e4b)',
  max:  'Qwen3 Coder 30B (qwen3-coder:30b)',
};

function ContextTab() {
  const { messages, currentPlan, selectedModelId } = useAgentStore();
  const [profile, setProfile] = useState<{ writingStyle: string; recurringGoals: string[] } | null>(null);

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => setProfile(d.profile));
  }, [messages.length]);

  const allTools = [
    'file_read','file_write','file_delete','code_execute','http_request',
    'web_search','web_fetch','stock_quote','tts_generate',
    'image_generate','browser_screenshot','browser_click','browser_fill',
    'spawn_agent',
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="text-xs font-semibold opacity-50 uppercase tracking-wider">Session Context</div>

      <GlassPanel className="p-3 space-y-1">
        <div className="text-[10px] opacity-50">Model</div>
        <div className="text-xs font-medium">{MODEL_LABELS[selectedModelId ?? 'pro'] ?? 'Nexus 1.0'}</div>
      </GlassPanel>

      <GlassPanel className="p-3 space-y-1">
        <div className="text-[10px] opacity-50">Messages</div>
        <div className="text-sm font-medium">{messages.length}</div>
      </GlassPanel>

      {currentPlan && (
        <GlassPanel className="p-3 space-y-1">
          <div className="text-[10px] opacity-50">Active Plan</div>
          <div className="text-xs font-medium">{currentPlan.goal}</div>
          <div className="text-[10px] opacity-60">{currentPlan.steps.filter(s => s.status === 'completed').length}/{currentPlan.steps.length} steps complete</div>
        </GlassPanel>
      )}

      {profile && (
        <GlassPanel className="p-3 space-y-2">
          <div className="text-[10px] opacity-50">User Profile</div>
          <div className="text-xs"><span className="opacity-60">Style:</span> {profile.writingStyle}</div>
          {profile.recurringGoals.length > 0 && (
            <div className="text-xs">
              <span className="opacity-60">Recurring goals:</span>
              <ul className="mt-1 space-y-0.5">
                {profile.recurringGoals.slice(0, 3).map(g => (
                  <li key={g} className="text-[11px] opacity-80">• {g}</li>
                ))}
              </ul>
            </div>
          )}
        </GlassPanel>
      )}

      <GlassPanel className="p-3">
        <div className="text-[10px] opacity-50 mb-1.5">Tools Available ({allTools.length})</div>
        <div className="flex flex-wrap gap-1">
          {allTools.map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue font-mono">
              {t}
            </span>
          ))}
        </div>
      </GlassPanel>
    </motion.div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const { theme, setTheme, resetAll } = useAgentStore();
  const [writingStyle, setWritingStyle] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => setWritingStyle(d.profile?.writingStyle ?? ''));
  }, []);

  const saveProfile = async () => {
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writingStyle }),
    });
    setSavedMsg('Saved');
    setTimeout(() => setSavedMsg(''), 1500);
  };

  const clearMemory = async () => {
    if (!confirm('Permanently delete all long-term memory?')) return;
    await fetch('/api/memory', { method: 'DELETE' });
    setSavedMsg('Memory cleared');
    setTimeout(() => setSavedMsg(''), 1500);
  };

  const exportData = async () => {
    const [mem, prof] = await Promise.all([
      fetch('/api/memory').then(r => r.json()),
      fetch('/api/profile').then(r => r.json()),
    ]);
    const blob = new Blob([JSON.stringify({ memory: mem, profile: prof, sessions: localStorage.getItem('nexus-ai-state') }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
      <div>
        <div className="text-xs font-semibold opacity-50 uppercase tracking-wider mb-2">Appearance</div>
        <GlassPanel className="p-2 flex gap-1">
          {[
            { id: 'light', icon: Sun, label: 'Light' },
            { id: 'dark', icon: Moon, label: 'Dark' },
            { id: 'system', icon: Monitor, label: 'Auto' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTheme(id as 'light' | 'dark' | 'system')}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 p-2 rounded-glass-sm text-[11px] transition-all',
                theme === id
                  ? 'bg-accent-blue text-white'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </GlassPanel>
      </div>

      <div>
        <div className="text-xs font-semibold opacity-50 uppercase tracking-wider mb-2">Writing Style</div>
        <textarea
          value={writingStyle}
          onChange={e => setWritingStyle(e.target.value)}
          placeholder="e.g. concise, technical, with examples"
          className="w-full p-2.5 text-xs rounded-glass-sm bg-white/40 dark:bg-white/[0.04] border border-white/30 dark:border-white/[0.06] outline-none focus:border-accent-blue min-h-[60px]"
        />
        <button onClick={saveProfile} className="mt-2 w-full py-1.5 rounded-glass-sm bg-accent-blue text-white text-xs font-medium hover:opacity-90">
          Save profile
        </button>
      </div>

      <div>
        <div className="text-xs font-semibold opacity-50 uppercase tracking-wider mb-2">Data</div>
        <div className="space-y-1.5">
          <button onClick={exportData} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-glass-sm bg-white/50 dark:bg-white/[0.05] border border-white/30 dark:border-white/[0.06] text-xs hover:bg-white/70 dark:hover:bg-white/[0.08]">
            <Download className="w-3 h-3" /> Export all data
          </button>
          <button onClick={clearMemory} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-glass-sm bg-red-500/10 border border-red-500/20 text-xs text-red-500 hover:bg-red-500/20">
            <Trash2 className="w-3 h-3" /> Clear long-term memory
          </button>
          <button
            onClick={() => confirm('Delete all sessions?') && resetAll()}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-glass-sm bg-red-500/10 border border-red-500/20 text-xs text-red-500 hover:bg-red-500/20"
          >
            <Trash2 className="w-3 h-3" /> Reset all sessions
          </button>
        </div>
      </div>

      {savedMsg && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-green-500">
          {savedMsg}
        </motion.div>
      )}
    </motion.div>
  );
}
