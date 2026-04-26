'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore, Skill, Connector, Integration, ScheduledTask } from '@/store/agent';
import { cn } from '@/lib/utils';
import {
  X, User, Settings, BarChart2, CreditCard, Clock, Mail,
  Database, Globe, Monitor, Palette, Zap, Link2, Puzzle,
  Info, HelpCircle, ChevronRight, ExternalLink, Check, Copy,
  Plus, Trash2, Edit2, AlertTriangle, Loader2, KeyRound, Eye, EyeOff,
  BookOpen, Play, Pause, RotateCw,
} from 'lucide-react';
import { Recipe } from '@/types';

type SettingsPage = 'account' | 'settings' | 'usage' | 'billing' | 'scheduled' | 'recipes' | 'mail' | 'data' | 'cloud-browser' | 'my-computer' | 'personalization' | 'skills' | 'connectors' | 'integrations' | 'api-keys' | 'about' | 'help';

const NAV_ITEMS: { page: SettingsPage; icon: React.ElementType; label: string }[] = [
  { page: 'account',         icon: User,       label: 'Account' },
  { page: 'settings',        icon: Settings,   label: 'Settings' },
  { page: 'usage',           icon: BarChart2,  label: 'Usage' },
  { page: 'billing',         icon: CreditCard, label: 'Billing' },
  { page: 'scheduled',       icon: Clock,      label: 'Scheduled tasks' },
  { page: 'recipes',         icon: BookOpen,   label: 'Recipes' },
  { page: 'mail',            icon: Mail,       label: 'Mail Nexus' },
  { page: 'data',            icon: Database,   label: 'Data controls' },
  { page: 'cloud-browser',   icon: Globe,      label: 'Cloud browser' },
  { page: 'my-computer',     icon: Monitor,    label: 'My Computer' },
  { page: 'personalization', icon: Palette,    label: 'Personalization' },
  { page: 'skills',          icon: Zap,        label: 'Skills' },
  { page: 'connectors',      icon: Link2,      label: 'Connectors' },
  { page: 'integrations',    icon: Puzzle,     label: 'Integrations' },
  { page: 'api-keys',         icon: KeyRound,   label: 'API Keys' },
  { page: 'about',           icon: Info,       label: 'About' },
  { page: 'help',            icon: HelpCircle, label: 'Get help' },
];

// ─── Reusable Toggle ────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative w-8 h-[18px] rounded-full transition-colors shrink-0',
        enabled ? 'bg-[#1a93fe]' : 'bg-[rgba(255,255,255,0.15)]',
      )}
    >
      <span className={cn(
        'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform',
        enabled ? 'translate-x-[14px]' : 'translate-x-0.5',
      )} />
    </button>
  );
}

// ─── Inline editable field ──────────────────────────────────────────────────

function EditableField({
  label, value, onSave, type = 'text', placeholder,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    if (draft.trim()) onSave(draft.trim());
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
      <span className="text-sm text-[#acacac] w-28 shrink-0">{label}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            ref={inputRef}
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-[#dadada] outline-none border-b border-[rgba(255,255,255,0.2)] pb-0.5"
          />
          <button onClick={commit} className="text-[#1a93fe] hover:opacity-80 transition-opacity">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setEditing(false)} className="text-[#5f5f5f] hover:text-[#acacac] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-1 justify-end">
          <span className="text-sm text-[#dadada] truncate max-w-[200px]">
            {type === 'password' ? '••••••••' : value}
          </span>
          <button onClick={() => { setDraft(type === 'password' ? '' : value); setEditing(true); }}
            className="text-xs text-[#1a93fe] hover:opacity-80 transition-opacity shrink-0">
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Select dropdown ─────────────────────────────────────────────────────────

function SelectField({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.10)] transition-colors"
      >
        <span className="text-sm text-[#dadada]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#7f7f7f]">{value}</span>
          <ChevronRight className={cn('w-3.5 h-3.5 text-[#5f5f5f] transition-transform', open && 'rotate-90')} />
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1 bg-[#2a2a2b] border border-[rgba(255,255,255,0.10)] rounded-xl shadow-xl z-10 overflow-hidden"
          >
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={cn(
                  'w-full text-left px-4 py-2 text-sm transition-colors',
                  opt === value ? 'text-[#1a93fe] bg-[rgba(26,147,254,0.08)]' : 'text-[#dadada] hover:bg-[rgba(255,255,255,0.04)]',
                )}
              >
                {opt === value && <Check className="w-3.5 h-3.5 inline mr-2 text-[#1a93fe]" />}
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────

function ConfirmDialog({
  title, body, confirmLabel, confirmClass, onConfirm, onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-80 bg-[#2a2a2b] border border-[rgba(255,255,255,0.10)] rounded-2xl p-5 shadow-xl"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[rgba(242,90,90,0.12)] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-[#f25a5a]" />
          </div>
          <div className="text-sm font-semibold text-[#dadada]">{title}</div>
        </div>
        <p className="text-xs text-[#7f7f7f] leading-relaxed mb-4">{body}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] text-xs text-[#acacac] hover:bg-[rgba(255,255,255,0.10)] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', confirmClass ?? 'bg-[#f25a5a] text-white hover:bg-[#e04a4a]')}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── OAuth connect modal ─────────────────────────────────────────────────────

function OAuthModal({
  connector, onSuccess, onCancel,
}: {
  connector: Connector;
  onSuccess: (account: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'prompt' | 'loading' | 'done'>('prompt');
  const [email, setEmail] = useState('');

  const handleConnect = () => {
    if (!email.trim()) return;
    setStep('loading');
    setTimeout(() => {
      setStep('done');
      setTimeout(() => onSuccess(email.trim()), 800);
    }, 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      onClick={step === 'prompt' ? onCancel : undefined}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-80 bg-[#2a2a2b] border border-[rgba(255,255,255,0.10)] rounded-2xl p-5 shadow-xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{connector.icon}</span>
          <div>
            <div className="text-sm font-semibold text-[#dadada]">Connect {connector.name}</div>
            <div className="text-xs text-[#7f7f7f]">Authorize access to your account</div>
          </div>
        </div>

        {step === 'prompt' && (
          <>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              placeholder="your@email.com"
              type="email"
              className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#dadada] outline-none placeholder:text-[#5f5f5f] mb-3"
            />
            <div className="flex gap-2">
              <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-[rgba(255,255,255,0.06)] text-xs text-[#acacac] hover:bg-[rgba(255,255,255,0.10)] transition-colors">
                Cancel
              </button>
              <button onClick={handleConnect} disabled={!email.trim()} className="flex-1 py-2 rounded-lg bg-[#1a93fe] text-xs text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
                Authorize
              </button>
            </div>
          </>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-6 h-6 text-[#1a93fe] animate-spin" />
            <div className="text-xs text-[#7f7f7f]">Connecting to {connector.name}…</div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-full bg-[rgba(37,186,59,0.12)] flex items-center justify-center">
              <Check className="w-5 h-5 text-[#25ba3b]" />
            </div>
            <div className="text-xs text-[#25ba3b] font-medium">Connected successfully!</div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Add Skill modal ─────────────────────────────────────────────────────────

function AddSkillModal({ onAdd, onCancel }: { onAdd: (skill: Omit<Skill, 'id'>) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), description: desc.trim() || 'Custom skill', enabled: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-80 bg-[#2a2a2b] border border-[rgba(255,255,255,0.10)] rounded-2xl p-5 shadow-xl"
      >
        <div className="text-sm font-semibold text-[#dadada] mb-4">Add custom skill</div>
        <div className="space-y-2 mb-4">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Skill name (e.g. my-tool)"
            className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#dadada] outline-none placeholder:text-[#5f5f5f]"
          />
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#dadada] outline-none placeholder:text-[#5f5f5f]"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-[rgba(255,255,255,0.06)] text-xs text-[#acacac] hover:bg-[rgba(255,255,255,0.10)] transition-colors">Cancel</button>
          <button onClick={handleAdd} disabled={!name.trim()} className="flex-1 py-2 rounded-lg bg-[#1a93fe] text-xs text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40">Add skill</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Add Integration modal ───────────────────────────────────────────────────

function AddIntegrationModal({ onAdd, onCancel }: { onAdd: (i: Omit<Integration, 'id'>) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !url.trim()) return;
    const href = url.startsWith('http') ? url : `https://${url}`;
    onAdd({ name: name.trim(), icon: '🔗', desc: desc.trim() || name.trim(), url: href, connected: false });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-80 bg-[#2a2a2b] border border-[rgba(255,255,255,0.10)] rounded-2xl p-5 shadow-xl"
      >
        <div className="text-sm font-semibold text-[#dadada] mb-4">Add integration</div>
        <div className="space-y-2 mb-4">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#dadada] outline-none placeholder:text-[#5f5f5f]" />
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (https://…)" className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#dadada] outline-none placeholder:text-[#5f5f5f]" />
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#dadada] outline-none placeholder:text-[#5f5f5f]" />
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-[rgba(255,255,255,0.06)] text-xs text-[#acacac] hover:bg-[rgba(255,255,255,0.10)] transition-colors">Cancel</button>
          <button onClick={handleAdd} disabled={!name.trim() || !url.trim()} className="flex-1 py-2 rounded-lg bg-[#1a93fe] text-xs text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40">Add</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Add / Edit Scheduled Task modal ─────────────────────────────────────────

function TaskModal({
  existing,
  onSave,
  onCancel,
}: {
  existing?: ScheduledTask;
  onSave: (data: Omit<ScheduledTask, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [schedule, setSchedule] = useState(existing?.schedule ?? 'Every day at 9am');
  const [cronLike, setCronLike] = useState(existing?.cronLike ?? '1440');
  const [prompt, setPrompt] = useState(existing?.prompt ?? '');

  const SCHEDULES: { label: string; cronLike: string }[] = [
    { label: 'Every 30 minutes', cronLike: '30' },
    { label: 'Every hour',       cronLike: '60' },
    { label: 'Every 6 hours',    cronLike: '360' },
    { label: 'Every day at 9am', cronLike: '1440' },
    { label: 'Every Monday',     cronLike: '10080' },
    { label: 'Every weekday',    cronLike: '1440' },
    { label: 'Every month',      cronLike: '43200' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-96 bg-[#2a2a2b] border border-[rgba(255,255,255,0.10)] rounded-2xl p-5 shadow-xl"
      >
        <div className="text-sm font-semibold text-[#dadada] mb-4">{existing ? 'Edit task' : 'New scheduled task'}</div>
        <div className="space-y-2 mb-4">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Task name"
            className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#dadada] outline-none placeholder:text-[#5f5f5f]"
          />
          <select
            value={schedule}
            onChange={e => {
              setSchedule(e.target.value);
              const found = SCHEDULES.find(s => s.label === e.target.value);
              if (found) setCronLike(found.cronLike);
            }}
            className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#dadada] outline-none appearance-none"
          >
            {SCHEDULES.map(s => <option key={s.label} value={s.label} className="bg-[#2a2a2b]">{s.label}</option>)}
          </select>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="What should the agent do?"
            rows={3}
            className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#dadada] outline-none placeholder:text-[#5f5f5f] resize-none"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-[rgba(255,255,255,0.06)] text-xs text-[#acacac] hover:bg-[rgba(255,255,255,0.10)] transition-colors">Cancel</button>
          <button
            onClick={() => { if (name.trim() && prompt.trim()) onSave({ name: name.trim(), schedule, cronLike, prompt: prompt.trim(), enabled: true, nextRun: Date.now() + Number(cronLike) * 60 * 1000 }); }}
            disabled={!name.trim() || !prompt.trim()}
            className="flex-1 py-2 rounded-lg bg-[#1a93fe] text-xs text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {existing ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function PageContent({ page }: { page: SettingsPage }) {
  const store = useAgentStore();

  // ── Account ──
  if (page === 'account') {
    return <AccountPage />;
  }

  // ── Settings ──
  if (page === 'settings') {
    const { preferences, setPreferences } = store;
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#dadada]">Settings</h2>
        <SelectField label="Language" value={preferences.language} options={['English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Portuguese']} onChange={v => setPreferences({ language: v })} />
        <SelectField label="Timezone" value={preferences.timezone} options={['Auto-detect', 'UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai']} onChange={v => setPreferences({ timezone: v })} />
        <SelectField label="Date format" value={preferences.dateFormat} options={['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'MMM D, YYYY']} onChange={v => setPreferences({ dateFormat: v })} />
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
          <div>
            <div className="text-sm text-[#dadada]">Notifications</div>
            <div className="text-xs text-[#7f7f7f]">Get notified when tasks complete</div>
          </div>
          <Toggle enabled={preferences.notifications} onChange={v => setPreferences({ notifications: v })} />
        </div>
        <div className="text-xs text-[#5f5f5f] px-1">Changes are saved automatically.</div>
      </div>
    );
  }

  // ── Usage ──
  if (page === 'usage') {
    const { usageStats } = store;
    const pct = usageStats.creditsTotal > 0 ? Math.round((usageStats.creditsUsed / usageStats.creditsTotal) * 100) : 0;
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#dadada]">Usage</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: 'Credits used', value: usageStats.creditsUsed.toLocaleString(), sub: 'this month' },
            { label: 'Remaining', value: (usageStats.creditsTotal - usageStats.creditsUsed).toLocaleString(), sub: `of ${usageStats.creditsTotal.toLocaleString()}` },
            { label: 'Tasks run', value: usageStats.tasksRun.toLocaleString(), sub: 'this month' },
            { label: 'Hours saved', value: `~${usageStats.hoursSaved}h`, sub: 'estimated' },
          ].map(stat => (
            <div key={stat.label} className="px-4 py-4 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
              <div className="text-xl font-semibold text-[#dadada]">{stat.value}</div>
              <div className="text-xs text-[#7f7f7f] mt-1">{stat.label}</div>
              <div className="text-[10px] text-[#5f5f5f]">{stat.sub}</div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
          <div className="flex justify-between text-xs text-[#7f7f7f] mb-2">
            <span>Monthly credits</span>
            <span>{usageStats.creditsUsed.toLocaleString()} / {usageStats.creditsTotal.toLocaleString()}</span>
          </div>
          <div className="h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
            <div className="h-full bg-[#1a93fe] rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[10px] text-[#5f5f5f] mt-1">{pct}% used</div>
        </div>
        {usageStats.creditsUsed === 0 && (
          <div className="text-xs text-[#5f5f5f] px-1">No usage yet — start a task to see stats here.</div>
        )}
      </div>
    );
  }

  // ── Billing ──
  if (page === 'billing') {
    return <BillingPage />;
  }

  // ── Scheduled ──
  if (page === 'scheduled') {
    return <ScheduledPage />;
  }

  // ── Recipes ──
  if (page === 'recipes') {
    return <RecipesPage />;
  }

  // ── Mail ──
  if (page === 'mail') {
    return <MailPage />;
  }

  // ── Data controls ──
  if (page === 'data') {
    return <DataPage />;
  }

  // ── Cloud browser ──
  if (page === 'cloud-browser') {
    const { cloudBrowser, setCloudBrowser } = store;
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#dadada]">Cloud browser</h2>
        <div className="px-4 py-4 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-[#1a93fe]" />
            <span className="text-sm font-medium text-[#dadada]">Isolated browser sessions</span>
          </div>
          <p className="text-xs text-[#7f7f7f]">Nexus browses the web in a secure cloud browser. Sessions are sandboxed and deleted after each task.</p>
        </div>
        <div className="space-y-2">
          {([
            { key: 'saveCookies' as const, name: 'Save cookies between sessions', desc: 'Remember logins across tasks' },
            { key: 'autoScreenshot' as const, name: 'Auto-screenshot', desc: 'Capture pages while browsing' },
            { key: 'adBlocking' as const, name: 'Ad blocking', desc: 'Block ads for cleaner browsing' },
          ]).map(s => (
            <div key={s.key} className="flex items-center justify-between px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
              <div>
                <div className="text-sm font-medium text-[#dadada]">{s.name}</div>
                <div className="text-xs text-[#7f7f7f] mt-0.5">{s.desc}</div>
              </div>
              <Toggle enabled={cloudBrowser[s.key]} onChange={v => setCloudBrowser({ [s.key]: v })} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── My Computer ──
  if (page === 'my-computer') {
    const { myComputerEnabled, setMyComputerEnabled } = store;
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#dadada]">My Computer</h2>
        <div className="px-4 py-4 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="w-4 h-4 text-[#1a93fe]" />
            <span className="text-sm font-medium text-[#dadada]">Desktop control</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[#7f7f7f]">Beta</span>
          </div>
          <p className="text-xs text-[#7f7f7f] mb-3">Allow Nexus to control your desktop apps, automate GUI workflows, and take screenshots directly on your Mac.</p>
          <button
            onClick={() => setMyComputerEnabled(!myComputerEnabled)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              myComputerEnabled
                ? 'bg-[rgba(37,186,59,0.12)] text-[#25ba3b] hover:bg-[rgba(37,186,59,0.18)]'
                : 'bg-[rgba(255,255,255,0.06)] text-[#dadada] hover:bg-[rgba(255,255,255,0.10)]',
            )}
          >
            {myComputerEnabled ? '✓ Enabled' : 'Enable My Computer'}
          </button>
        </div>
        {myComputerEnabled && (
          <div className="px-4 py-3 bg-[rgba(37,186,59,0.06)] rounded-xl border border-[rgba(37,186,59,0.15)]">
            <div className="text-xs text-[#25ba3b] font-medium mb-1">Active</div>
            <p className="text-xs text-[#7f7f7f]">Nexus can now control your desktop. Grant permissions in System Settings → Privacy → Accessibility if prompted.</p>
          </div>
        )}
      </div>
    );
  }

  // ── Personalization ──
  if (page === 'personalization') {
    return <PersonalizationPage />;
  }

  // ── Skills ──
  if (page === 'skills') {
    return <SkillsPage />;
  }

  // ── Connectors ──
  if (page === 'connectors') {
    return <ConnectorsPage />;
  }

  // ── Integrations ──
  if (page === 'api-keys') {
    return <ApiKeysPage />;
  }

  if (page === 'integrations') {
    return <IntegrationsPage />;
  }

  // ── About ──
  if (page === 'about') {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#dadada]">About</h2>
        <div className="px-4 py-4 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
          <div className="text-xl font-bold text-[#dadada] mb-1">Nexus AI</div>
          <div className="text-xs text-[#7f7f7f]">Powered by Ollama · Version 0.1.0</div>
          <p className="text-xs text-[#7f7f7f] mt-3 leading-relaxed">An autonomous AI agent platform running fully local LLMs via Ollama. Capable of planning, web research, code execution, multi-agent orchestration, and more.</p>
        </div>
        <div className="space-y-1.5">
          {[
            { label: 'GitHub', url: 'https://github.com/FoundationAgents/OpenManus' },
            { label: 'Ollama', url: 'https://ollama.com' },
          ].map(link => (
            <a key={link.label} href={link.url} target="_blank" rel="noreferrer"
              className="flex items-center justify-between px-4 py-2.5 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.10)] transition-colors group">
              <span className="text-sm text-[#dadada]">{link.label}</span>
              <ExternalLink className="w-4 h-4 text-[#5f5f5f] group-hover:text-[#acacac] transition-colors" />
            </a>
          ))}
        </div>
      </div>
    );
  }

  // ── Help ──
  if (page === 'help') {
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-[#dadada]">Get help</h2>
        <div className="space-y-2">
          {[
            { label: 'Documentation', icon: '📚', desc: 'Read guides and API docs', url: 'https://github.com/FoundationAgents/OpenManus' },
            { label: 'Discord community', icon: '💬', desc: 'Chat with other users', url: 'https://discord.com' },
            { label: 'Email support', icon: '📧', desc: 'Get help from the team', url: 'mailto:support@nexus.ai' },
            { label: 'Report a bug', icon: '🐛', desc: 'Help us improve', url: 'https://github.com/FoundationAgents/OpenManus/issues' },
          ].map(item => (
            <a key={item.label} href={item.url} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)] cursor-pointer hover:border-[rgba(255,255,255,0.10)] transition-colors group">
              <span className="text-lg w-7 text-center">{item.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-[#dadada]">{item.label}</div>
                <div className="text-xs text-[#7f7f7f]">{item.desc}</div>
              </div>
              <ExternalLink className="w-4 h-4 text-[#5f5f5f] group-hover:text-[#acacac] transition-colors" />
            </a>
          ))}
        </div>
      </div>
    );
  }

  return <div className="flex items-center justify-center h-40 text-sm text-[#7f7f7f]">Coming soon</div>;
}

// ─── Account page ────────────────────────────────────────────────────────────

function AccountPage() {
  const { userProfile, setUserProfile, closeSettings, deleteAllData } = useAgentStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState('password123');
  const initials = userProfile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDialog
            title="Delete account"
            body="This will permanently delete your account and all your data. This action cannot be undone."
            confirmLabel="Delete account"
            onConfirm={() => { deleteAllData(); setConfirmDelete(false); closeSettings(); }}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </AnimatePresence>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#dadada]">Account</h2>
        <div className="flex items-center gap-4 p-4 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1a93fe] to-[#A855F7] flex items-center justify-center text-white text-lg font-bold shrink-0">{initials}</div>
          <div>
            <div className="text-sm font-semibold text-[#dadada]">{userProfile.name}</div>
            <div className="text-xs text-[#7f7f7f]">{userProfile.email}</div>
            <div className="mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-[rgba(26,147,254,0.12)] text-[#1a93fe] inline-block font-medium">Pro Plan</div>
          </div>
        </div>
        <div className="space-y-1.5">
          <EditableField label="Display name" value={userProfile.name} onSave={v => setUserProfile({ name: v })} placeholder="Your name" />
          <EditableField label="Email" value={userProfile.email} type="email" onSave={v => setUserProfile({ email: v })} placeholder="you@example.com" />
          <EditableField label="Password" value={password} type="password" onSave={v => setPassword(v)} placeholder="New password" />
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full px-4 py-2.5 rounded-xl bg-[rgba(242,90,90,0.08)] text-[#f25a5a] text-sm font-medium hover:bg-[rgba(242,90,90,0.14)] transition-colors border border-[rgba(242,90,90,0.15)]"
        >
          Delete account
        </button>
      </div>
    </>
  );
}

// ─── Billing page ────────────────────────────────────────────────────────────

function BillingPage() {
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState('Pro');

  const PLANS = [
    { name: 'Free', price: '$0', credits: '500 credits/mo' },
    { name: 'Pro', price: '$39', credits: '5,000 credits/mo' },
    { name: 'Team', price: '$99', credits: '20,000 credits/mo' },
    { name: 'Enterprise', price: 'Custom', credits: 'Unlimited' },
  ];

  return (
    <>
      <AnimatePresence>
        {showPlanModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
            onClick={() => setShowPlanModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-96 bg-[#2a2a2b] border border-[rgba(255,255,255,0.10)] rounded-2xl p-5 shadow-xl"
            >
              <div className="text-sm font-semibold text-[#dadada] mb-4">Change plan</div>
              <div className="space-y-2 mb-4">
                {PLANS.map(plan => (
                  <button
                    key={plan.name}
                    onClick={() => { setCurrentPlan(plan.name); setShowPlanModal(false); }}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors',
                      currentPlan === plan.name
                        ? 'border-[#1a93fe] bg-[rgba(26,147,254,0.08)]'
                        : 'border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]',
                    )}
                  >
                    <div>
                      <div className="text-sm font-medium text-[#dadada]">{plan.name}</div>
                      <div className="text-xs text-[#7f7f7f]">{plan.credits}</div>
                    </div>
                    <div className="text-sm font-semibold text-[#dadada]">{plan.price}<span className="text-xs font-normal text-[#7f7f7f]">/mo</span></div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowPlanModal(false)} className="w-full py-2 rounded-lg bg-[rgba(255,255,255,0.06)] text-xs text-[#acacac] hover:bg-[rgba(255,255,255,0.10)] transition-colors">Close</button>
            </motion.div>
          </motion.div>
        )}
        {showPaymentModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
            onClick={() => setShowPaymentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-80 bg-[#2a2a2b] border border-[rgba(255,255,255,0.10)] rounded-2xl p-5 shadow-xl"
            >
              <div className="text-sm font-semibold text-[#dadada] mb-4">Payment method</div>
              <div className="flex items-center gap-3 px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)] mb-3">
                <span className="text-xl">💳</span>
                <div>
                  <div className="text-sm text-[#dadada]">Visa ending in 4242</div>
                  <div className="text-xs text-[#7f7f7f]">Expires 12/27</div>
                </div>
              </div>
              <button
                onClick={() => alert('Nexus runs locally on Ollama — no payment required. Connect API keys (Settings → API Keys) to use OpenAI/ElevenLabs/etc.')}
                className="w-full py-2 rounded-lg bg-[rgba(255,255,255,0.06)] text-xs text-[#acacac] hover:bg-[rgba(255,255,255,0.10)] transition-colors mb-2"
              >Add new card</button>
              <button onClick={() => setShowPaymentModal(false)} className="w-full py-2 rounded-lg bg-[rgba(255,255,255,0.04)] text-xs text-[#5f5f5f] hover:bg-[rgba(255,255,255,0.08)] transition-colors">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#dadada]">Billing</h2>
          <button onClick={() => setShowPlanModal(true)} className="text-xs text-[#1a93fe] hover:opacity-80 transition-opacity">Change plan</button>
        </div>
        <div className="px-4 py-4 bg-[rgba(26,147,254,0.06)] rounded-xl border border-[rgba(26,147,254,0.18)]">
          <div className="text-xs font-semibold text-[#1a93fe] uppercase tracking-wider mb-1">{currentPlan} Plan</div>
          <div className="text-2xl font-bold text-[#dadada]">
            {PLANS.find(p => p.name === currentPlan)?.price}<span className="text-sm font-normal text-[#7f7f7f]">/mo</span>
          </div>
          <div className="text-xs text-[#7f7f7f] mt-1">
            {PLANS.find(p => p.name === currentPlan)?.credits} · Renews Jun 1, 2026
          </div>
        </div>
        <div className="space-y-1.5">
          <button onClick={() => setShowPaymentModal(true)} className="w-full flex items-center justify-between px-4 py-2.5 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.10)] transition-colors">
            <span className="text-sm text-[#dadada]">Payment method</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#5f5f5f]" />
          </button>
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
            <span className="text-sm text-[#dadada]">Invoices</span>
            <span className="text-xs text-[#5f5f5f]">No invoices yet</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Scheduled tasks page ─────────────────────────────────────────────────────

function ScheduledPage() {
  const { scheduledTasks, addScheduledTask, updateScheduledTask, deleteScheduledTask } = useAgentStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editTask, setEditTask] = useState<ScheduledTask | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <>
      <AnimatePresence>
        {showAdd && (
          <TaskModal
            onSave={(data) => { addScheduledTask(data); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)}
          />
        )}
        {editTask && (
          <TaskModal
            existing={editTask}
            onSave={(data) => { updateScheduledTask(editTask.id, data); setEditTask(null); }}
            onCancel={() => setEditTask(null)}
          />
        )}
        {deleteId && (
          <ConfirmDialog
            title="Delete task"
            body="Are you sure you want to delete this scheduled task? It won't run anymore."
            confirmLabel="Delete"
            onConfirm={() => { deleteScheduledTask(deleteId); setDeleteId(null); }}
            onCancel={() => setDeleteId(null)}
          />
        )}
      </AnimatePresence>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#dadada]">Scheduled tasks</h2>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] text-xs text-[#dadada] hover:bg-[rgba(255,255,255,0.10)] transition-colors">
            <Plus className="w-3.5 h-3.5" />New
          </button>
        </div>
        {scheduledTasks.length === 0 ? (
          <div className="px-4 py-10 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)] text-center">
            <Clock className="w-8 h-8 text-[#5f5f5f] mx-auto mb-2" />
            <div className="text-sm text-[#7f7f7f]">No scheduled tasks yet</div>
            <div className="text-xs text-[#5f5f5f] mt-1">Create recurring tasks that run automatically</div>
          </div>
        ) : (
          <div className="space-y-2">
            {scheduledTasks.map(task => (
              <div key={task.id} className="px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-[#dadada] truncate flex-1 mr-2">{task.name}</div>
                  <div className="flex items-center gap-1">
                    <Toggle enabled={task.enabled} onChange={v => updateScheduledTask(task.id, { enabled: v })} />
                    <button onClick={() => setEditTask(task)} className="p-1 rounded text-[#5f5f5f] hover:text-[#acacac] transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(task.id)} className="p-1 rounded text-[#5f5f5f] hover:text-[#f25a5a] transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-[#7f7f7f]">{task.schedule}</div>
                <div className="text-xs text-[#5f5f5f] mt-1 truncate">{task.prompt}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Mail page ────────────────────────────────────────────────────────────────

function MailPage() {
  const { userProfile } = useAgentStore();
  const [copied, setCopied] = useState(false);
  const mailAddress = `${userProfile.name.toLowerCase().replace(/\s+/g, '.')}@nexus.ai`;

  const copyEmail = () => {
    navigator.clipboard.writeText(mailAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-[#dadada]">Mail Nexus</h2>
      <div className="px-4 py-4 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-[#1a93fe]" />
          <span className="text-sm font-medium text-[#dadada]">Your Nexus email</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 font-mono text-sm text-[#dadada] px-3 py-2 bg-[rgba(255,255,255,0.04)] rounded-lg border border-[rgba(255,255,255,0.06)]">
            {mailAddress}
          </div>
          <button
            onClick={copyEmail}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0',
              copied ? 'bg-[rgba(37,186,59,0.12)] text-[#25ba3b]' : 'bg-[rgba(255,255,255,0.06)] text-[#acacac] hover:bg-[rgba(255,255,255,0.10)]',
            )}
          >
            {copied ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
          </button>
        </div>
        <p className="text-xs text-[#7f7f7f] mt-3 leading-relaxed">Send emails to this address to trigger tasks automatically. Nexus will read the email and run the requested task.</p>
      </div>
      <div className="px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
        <div className="text-xs font-medium text-[#acacac] mb-2">How it works</div>
        <div className="space-y-2">
          {['Send an email with a task description.', 'Nexus reads the email and creates a task.', 'Results are emailed back when complete.'].map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-[rgba(26,147,254,0.12)] text-[#1a93fe] text-[10px] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
              <div className="text-xs text-[#7f7f7f]">{step}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Data controls page ───────────────────────────────────────────────────────

function DataPage() {
  const { dataControls, setDataControls, deleteAllData } = useAgentStore();
  const [confirmWipe, setConfirmWipe] = useState(false);

  return (
    <>
      <AnimatePresence>
        {confirmWipe && (
          <ConfirmDialog
            title="Delete all data"
            body="This will permanently delete all your conversations, tasks, and settings. This cannot be undone."
            confirmLabel="Delete everything"
            onConfirm={() => { deleteAllData(); setConfirmWipe(false); }}
            onCancel={() => setConfirmWipe(false)}
          />
        )}
      </AnimatePresence>
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-[#dadada]">Data controls</h2>
        <div className="space-y-2">
          {([
            { key: 'improveWithData' as const, name: 'Improve Nexus with my data', desc: 'Help train future models with anonymized interactions' },
            { key: 'storeHistory' as const, name: 'Store conversation history', desc: 'Keep task history for context across sessions' },
            { key: 'shareAnalytics' as const, name: 'Share usage analytics', desc: 'Send usage statistics to improve the product' },
          ]).map(s => (
            <div key={s.key} className="flex items-center justify-between px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
              <div>
                <div className="text-sm font-medium text-[#dadada]">{s.name}</div>
                <div className="text-xs text-[#7f7f7f] mt-0.5">{s.desc}</div>
              </div>
              <Toggle enabled={dataControls[s.key]} onChange={v => setDataControls({ [s.key]: v })} />
            </div>
          ))}
        </div>
        <button
          onClick={() => setConfirmWipe(true)}
          className="w-full px-4 py-2.5 rounded-xl bg-[rgba(242,90,90,0.08)] text-[#f25a5a] text-sm font-medium hover:bg-[rgba(242,90,90,0.14)] transition-colors border border-[rgba(242,90,90,0.15)]"
        >
          Delete all data
        </button>
      </div>
    </>
  );
}

// ─── Personalization page ─────────────────────────────────────────────────────

function PersonalizationPage() {
  const { personalization, setPersonalization } = useAgentStore();
  const [aboutYou, setAboutYou] = useState(personalization.aboutYou);
  const [customInstructions, setCustomInstructions] = useState(personalization.customInstructions);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setPersonalization({ aboutYou, customInstructions });
    // Persist to sandbox so the agent loop can read it server-side
    await fetch('/api/sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '_personalization.json', content: JSON.stringify({ aboutYou, customInstructions }) }),
    }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-[#dadada]">Personalization</h2>
      <div className="px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
        <div className="text-xs font-medium text-[#acacac] mb-2">About you</div>
        <textarea
          value={aboutYou}
          onChange={e => setAboutYou(e.target.value)}
          className="w-full bg-transparent text-sm text-[#dadada] resize-none outline-none placeholder:text-[#5f5f5f] leading-relaxed"
          rows={4}
          placeholder="Tell Nexus about yourself, your preferences, and how you like to work…"
        />
      </div>
      <div className="px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
        <div className="text-xs font-medium text-[#acacac] mb-2">Custom instructions</div>
        <textarea
          value={customInstructions}
          onChange={e => setCustomInstructions(e.target.value)}
          className="w-full bg-transparent text-sm text-[#dadada] resize-none outline-none placeholder:text-[#5f5f5f] leading-relaxed"
          rows={4}
          placeholder={'Always respond in…\nFormat outputs as…\nWhen writing code…'}
        />
      </div>
      <button
        onClick={handleSave}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
          saved ? 'bg-[rgba(37,186,59,0.12)] text-[#25ba3b]' : 'bg-[#1a93fe] text-white hover:opacity-90',
        )}
      >
        {saved ? <><Check className="w-4 h-4" />Saved</> : 'Save'}
      </button>
    </div>
  );
}

// ─── Recipes page ─────────────────────────────────────────────────────────────

function RecipesPage() {
  const { recipes, addRecipe, updateRecipe, deleteRecipe, incrementRecipeRunCount, closeSettings } = useAgentStore();
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [creating, setCreating] = useState(false);

  const runRecipe = (recipe: Recipe) => {
    // Substitute variables in prompt
    let filled = recipe.prompt;
    if (recipe.variables) {
      for (const [k, v] of Object.entries(recipe.variables)) {
        filled = filled.replaceAll(`{{${k}}}`, v);
      }
    }
    incrementRecipeRunCount(recipe.id);
    closeSettings();
    // Defer to allow modal close, then dispatch the run via a custom event
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('nexus:run-recipe', { detail: { prompt: filled, recipe } }));
    }, 80);
  };

  if (creating || editing) {
    return (
      <RecipeEditor
        recipe={editing}
        onSave={(data) => {
          if (editing) updateRecipe(editing.id, data);
          else addRecipe(data);
          setCreating(false);
          setEditing(null);
        }}
        onCancel={() => { setCreating(false); setEditing(null); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#dadada]">Recipes</h2>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a93fe] hover:bg-[#1080e8] text-white text-sm font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> New recipe
        </button>
      </div>
      <p className="text-xs text-[#7f7f7f]">
        Reusable task templates. Use <code className="bg-white/5 px-1 rounded">{'{{variable}}'}</code> placeholders for dynamic values. Run with one click or via <code className="bg-white/5 px-1 rounded">/recipe</code> in chat.
      </p>

      {recipes.length === 0 ? (
        <div className="px-4 py-12 text-center bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
          <BookOpen className="w-8 h-8 text-[#5f5f5f] mx-auto mb-2" />
          <p className="text-sm text-[#7f7f7f]">No recipes yet. Create one to start.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recipes.map(r => (
            <div key={r.id} className="px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] transition-colors group">
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">{r.icon ?? '📄'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-semibold text-[#dadada] truncate">{r.name}</h3>
                    {r.runCount > 0 && (
                      <span className="text-[10px] text-[#5f5f5f] shrink-0">· {r.runCount} run{r.runCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#7f7f7f] mb-2 line-clamp-2">{r.description}</p>
                  {r.tags && r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {r.tags.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#7f7f7f]">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => runRecipe(r)}
                    title="Run recipe"
                    className="p-1.5 rounded-lg bg-[rgba(37,186,59,0.10)] hover:bg-[rgba(37,186,59,0.20)] text-[#25ba3b]"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditing(r)}
                    title="Edit"
                    className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.06)] text-[#7f7f7f] hover:text-[#dadada]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete recipe?')) deleteRecipe(r.id); }}
                    title="Delete"
                    className="p-1.5 rounded-lg hover:bg-[rgba(255,40,40,0.10)] text-[#7f7f7f] hover:text-red-400 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeEditor({ recipe, onSave, onCancel }: {
  recipe: Recipe | null;
  onSave: (data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'runCount'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [description, setDescription] = useState(recipe?.description ?? '');
  const [prompt, setPrompt] = useState(recipe?.prompt ?? '');
  const [icon, setIcon] = useState(recipe?.icon ?? '✨');
  const [varText, setVarText] = useState(
    recipe?.variables ? Object.entries(recipe.variables).map(([k, v]) => `${k}=${v}`).join('\n') : '',
  );
  const [tags, setTags] = useState(recipe?.tags?.join(', ') ?? '');

  const save = () => {
    if (!name.trim() || !prompt.trim()) return;
    const variables: Record<string, string> = {};
    for (const line of varText.split('\n')) {
      const [k, ...rest] = line.split('=');
      if (k && rest.length) variables[k.trim()] = rest.join('=').trim();
    }
    onSave({
      name: name.trim(),
      description: description.trim(),
      prompt: prompt.trim(),
      icon: icon.trim() || '✨',
      variables: Object.keys(variables).length ? variables : undefined,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#dadada]">{recipe ? 'Edit recipe' : 'New recipe'}</h2>
        <button onClick={onCancel} className="text-sm text-[#7f7f7f] hover:text-[#dadada]">Cancel</button>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-[#7f7f7f]">Icon (emoji) and Name</label>
        <div className="flex gap-2">
          <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={4} className="w-14 text-center bg-[#272728] border border-[rgba(255,255,255,0.10)] rounded-lg px-2 py-2 text-sm text-[#dadada]" />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Weekly Status Report" className="flex-1 bg-[#272728] border border-[rgba(255,255,255,0.10)] rounded-lg px-3 py-2 text-sm text-[#dadada] placeholder:text-[#5f5f5f]" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-[#7f7f7f]">Description</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short summary of what this does" className="w-full bg-[#272728] border border-[rgba(255,255,255,0.10)] rounded-lg px-3 py-2 text-sm text-[#dadada] placeholder:text-[#5f5f5f]" />
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-[#7f7f7f]">Prompt template</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={6}
          placeholder="Use {{variable}} for placeholders that get filled in at run time."
          className="w-full bg-[#272728] border border-[rgba(255,255,255,0.10)] rounded-lg px-3 py-2 text-sm text-[#dadada] placeholder:text-[#5f5f5f] font-mono resize-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-[#7f7f7f]">Variables (one per line, key=default)</label>
        <textarea
          value={varText}
          onChange={e => setVarText(e.target.value)}
          rows={3}
          placeholder="topic=engineering&#10;depth=high"
          className="w-full bg-[#272728] border border-[rgba(255,255,255,0.10)] rounded-lg px-3 py-2 text-sm text-[#dadada] placeholder:text-[#5f5f5f] font-mono resize-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-[#7f7f7f]">Tags (comma separated)</label>
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="research, finance" className="w-full bg-[#272728] border border-[rgba(255,255,255,0.10)] rounded-lg px-3 py-2 text-sm text-[#dadada] placeholder:text-[#5f5f5f]" />
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={save} disabled={!name.trim() || !prompt.trim()} className="flex-1 px-4 py-2 rounded-lg bg-[#1a93fe] hover:bg-[#1080e8] disabled:opacity-40 text-white text-sm font-medium">
          Save recipe
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-[#dadada]">Cancel</button>
      </div>
    </div>
  );
}

// ─── Skills page ──────────────────────────────────────────────────────────────

function SkillsPage() {
  const { skills, toggleSkill, addSkill, removeSkill } = useAgentStore();
  const [showAdd, setShowAdd] = useState(false);

  // Persist skills to sandbox so the server-side agent loop can read them
  useEffect(() => {
    const enabledNames = skills.filter(s => s.enabled).map(s => ({ name: s.name, description: s.description }));
    fetch('/api/sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '_skills.json', content: JSON.stringify(enabledNames) }),
    }).catch(() => {});
  }, [skills]);

  return (
    <>
      <AnimatePresence>
        {showAdd && (
          <AddSkillModal
            onAdd={(skill) => { addSkill(skill); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)}
          />
        )}
      </AnimatePresence>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#dadada]">Skills</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-[#7f7f7f] font-medium">Beta</span>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] text-xs text-[#dadada] hover:bg-[rgba(255,255,255,0.10)] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />Add skill
          </button>
        </div>
        <p className="text-xs text-[#7f7f7f]">Enable extra capabilities for the agent to use during tasks.</p>
        <div className="space-y-2">
          {skills.map(skill => (
            <div key={skill.id} className="flex items-center justify-between px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.10)] transition-colors">
              <div className="flex-1 mr-3 min-w-0">
                <div className="text-sm font-medium text-[#dadada] truncate">{skill.name}</div>
                <div className="text-xs text-[#7f7f7f] mt-0.5">{skill.description}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Toggle enabled={skill.enabled} onChange={() => toggleSkill(skill.id)} />
                {skill.custom && (
                  <button onClick={() => removeSkill(skill.id)} className="p-1 rounded text-[#5f5f5f] hover:text-[#f25a5a] transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── API Keys page ────────────────────────────────────────────────────────────

const API_KEY_FIELDS: {
  id: keyof ReturnType<typeof useAgentStore.getState>['apiKeys'];
  label: string;
  placeholder: string;
  url: string;
  required?: boolean;
  desc: string;
}[] = [
  { id: 'openai',       label: 'OpenAI (optional)',  placeholder: 'sk-…',      url: 'https://platform.openai.com/api-keys',         desc: 'Optional. Used for DALL·E if you prefer it over the free Pollinations fallback.' },
  { id: 'huggingface',  label: 'HuggingFace',        placeholder: 'hf_…',      url: 'https://huggingface.co/settings/tokens',       desc: 'Optional. Free inference for image and embedding models.' },
  { id: 'tavily',       label: 'Tavily Search',      placeholder: 'tvly-…',    url: 'https://tavily.com',                           desc: 'Optional. Better web search than the DuckDuckGo fallback. Free tier available.' },
  { id: 'elevenlabs',   label: 'ElevenLabs',         placeholder: 'sk_…',      url: 'https://elevenlabs.io/app/settings/api-keys',  desc: 'Optional. Text-to-speech. Free tier available.' },
  { id: 'notion',       label: 'Notion',             placeholder: 'secret_…',  url: 'https://www.notion.so/my-integrations',        desc: 'Internal integration token from your Notion workspace.' },
  { id: 'slackBot',     label: 'Slack bot token',    placeholder: 'xoxb-…',    url: 'https://api.slack.com/apps',                   desc: 'Bot token from your Slack app.' },
  { id: 'telegramBot',  label: 'Telegram bot',       placeholder: '123:ABC…',  url: 'https://t.me/BotFather',                       desc: 'Token from BotFather.' },
  { id: 'githubToken',  label: 'GitHub PAT',         placeholder: 'ghp_…',     url: 'https://github.com/settings/tokens',           desc: 'Personal access token. Scope: repo.' },
];

function ApiKeysPage() {
  const { apiKeys, setApiKey } = useAgentStore();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[#dadada]">API Keys</h2>
        <p className="text-xs text-[#7f7f7f] mt-1">
          Stored locally in your browser. Sent only with your requests — never to a third party.
        </p>
      </div>

      <div className="px-4 py-3 bg-[rgba(26,147,254,0.08)] border border-[rgba(26,147,254,0.2)] rounded-xl">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-[#1a93fe] shrink-0 mt-0.5" />
          <div className="text-xs text-[#acacac] leading-relaxed">
            <span className="text-[#dadada] font-medium">No API key required.</span> The agent runs on <span className="text-[#dadada] font-medium">DeepSeek R1</span> via Ollama locally. All keys below are optional — the app falls back to free providers (Pollinations for images, DuckDuckGo for search) when unset.
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {API_KEY_FIELDS.map(field => {
          const value = apiKeys[field.id] ?? '';
          const isRevealed = revealed[field.id];
          const masked = value ? (isRevealed ? value : '•'.repeat(Math.min(value.length, 24))) : '';
          return (
            <div key={field.id} className="px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#dadada]">{field.label}</span>
                  {field.required && <span className="text-[10px] text-[#ff6b6b] uppercase tracking-wide">Required</span>}
                  {value && <Check className="w-3.5 h-3.5 text-[#3fb950]" />}
                </div>
                <a
                  href={field.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-[#7f7f7f] hover:text-[#1a93fe] transition-colors"
                >
                  Get key <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="text-[11px] text-[#7f7f7f] mb-2 leading-relaxed">{field.desc}</div>
              <div className="flex gap-2">
                <input
                  type={isRevealed ? 'text' : 'password'}
                  value={isRevealed ? value : masked}
                  onChange={e => setApiKey(field.id, e.target.value)}
                  onFocus={() => setRevealed(r => ({ ...r, [field.id]: true }))}
                  placeholder={field.placeholder}
                  spellCheck={false}
                  autoComplete="off"
                  className="flex-1 px-3 py-2 bg-[#1e1e1f] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#dadada] font-mono placeholder:text-[#5f5f5f] focus:outline-none focus:border-[#1a93fe]"
                />
                <button
                  onClick={() => setRevealed(r => ({ ...r, [field.id]: !r[field.id] }))}
                  className="px-2.5 py-2 bg-[#1e1e1f] border border-[rgba(255,255,255,0.08)] rounded-lg text-[#7f7f7f] hover:text-[#dadada] hover:border-[rgba(255,255,255,0.16)] transition-colors"
                  title={isRevealed ? 'Hide' : 'Reveal'}
                >
                  {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                {value && (
                  <button
                    onClick={() => setApiKey(field.id, '')}
                    className="px-2.5 py-2 bg-[#1e1e1f] border border-[rgba(255,255,255,0.08)] rounded-lg text-[#7f7f7f] hover:text-[#ff6b6b] hover:border-[rgba(255,107,107,0.3)] transition-colors"
                    title="Clear"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-[#5f5f5f] px-1 pt-2">
        Keys are saved automatically as you type. They live in your browser&apos;s localStorage and are never logged on the server.
      </div>
    </div>
  );
}

// ─── Connectors page ──────────────────────────────────────────────────────────

// Maps connector ID → real auth strategy
type ApiKeyField = keyof ReturnType<typeof useAgentStore.getState>['apiKeys'];
type ConnectorStrategy =
  | { kind: 'oauth'; provider: 'google' | 'github'; fallbackField?: ApiKeyField }
  | { kind: 'apiKey'; field: ApiKeyField }
  | { kind: 'local' };

const CONNECTOR_STRATEGY: Record<string, ConnectorStrategy> = {
  gmail:           { kind: 'oauth',  provider: 'google' },
  gdrive:          { kind: 'oauth',  provider: 'google' },
  'gdrive-picker': { kind: 'oauth',  provider: 'google' },
  gemini:          { kind: 'apiKey', field: 'anthropic' }, // primary LLM key (legacy field name)
  github:          { kind: 'oauth',  provider: 'github', fallbackField: 'githubToken' },
  notion:          { kind: 'apiKey', field: 'notion' },
  'slack-connect': { kind: 'apiKey', field: 'slackBot' },
  telegram:        { kind: 'apiKey', field: 'telegramBot' },
  elevenlabs:      { kind: 'apiKey', field: 'elevenlabs' },
  'meta-ads':      { kind: 'apiKey', field: 'openai' }, // No free Meta API — placeholder
  browser:         { kind: 'local' },
};

function ConnectorsPage() {
  const { connectors, setConnectorConnected, apiKeys, setSettingsPage } = useAgentStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oauthStatus, setOauthStatus] = useState<{ google: boolean; github: boolean }>({ google: false, github: false });

  // Sync connector "connected" state with NextAuth session + load OAuth status
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session').then(r => r.json()).then((s: { user?: { email?: string }; provider?: string }) => {
      if (cancelled || !s?.provider) return;
      if (s.provider === 'google') {
        ['gmail', 'gdrive', 'gdrive-picker'].forEach(id => {
          const c = connectors.find(c => c.id === id);
          if (c && !c.connected) setConnectorConnected(id, true, s.user?.email ?? '');
        });
      }
      if (s.provider === 'github') {
        const c = connectors.find(c => c.id === 'github');
        if (c && !c.connected) setConnectorConnected('github', true, s.user?.email ?? '');
      }
    }).catch(() => {});

    fetch('/api/connectors/status').then(r => r.json()).then(s => {
      if (!cancelled) setOauthStatus(s);
    }).catch(() => {});

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyApiKey = async (connectorId: string, key: string): Promise<void> => {
    if (connectorId === 'notion') {
      const r = await fetch('/api/connectors/notion?action=search&q=', { headers: { 'x-notion-key': key } });
      if (!r.ok) throw new Error(await r.text());
    } else if (connectorId === 'slack-connect') {
      const r = await fetch('/api/connectors/slack?action=channels', { headers: { 'x-slack-key': key } });
      if (!r.ok) throw new Error(await r.text());
    } else if (connectorId === 'telegram') {
      const r = await fetch('/api/connectors/telegram?action=me', { headers: { 'x-telegram-key': key } });
      if (!r.ok) throw new Error(await r.text());
    } else if (connectorId === 'github') {
      const r = await fetch('/api/connectors/github?action=repos', { headers: { 'x-github-key': key } });
      if (!r.ok) throw new Error(await r.text());
    } else if (connectorId === 'elevenlabs') {
      const r = await fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': key } });
      if (!r.ok) throw new Error(`ElevenLabs auth failed (HTTP ${r.status})`);
    } else if (connectorId === 'gemini') {
      // The primary key gets exercised on every chat — accept it as long as it has the right shape.
      if (!/^AIza[0-9A-Za-z_-]{30,}$/.test(key)) throw new Error('That doesn\'t look like a Google AI Studio key (should start with AIza).');
    }
  };

  const handleConnect = async (connectorId: string) => {
    setError(null);
    setBusyId(connectorId);
    const strategy = CONNECTOR_STRATEGY[connectorId];

    try {
      if (!strategy) {
        setConnectorConnected(connectorId, true, 'local');
        return;
      }

      if (strategy.kind === 'oauth') {
        const providerConfigured = oauthStatus[strategy.provider];

        // Provider not configured server-side — try PAT fallback (GitHub) or surface a helpful error
        if (!providerConfigured) {
          if (strategy.fallbackField) {
            const key = apiKeys[strategy.fallbackField];
            if (!key) {
              setError(`OAuth for ${strategy.provider} isn't configured on this server. Paste a personal access token in Settings → API Keys instead.`);
              setSettingsPage('api-keys');
              return;
            }
            await verifyApiKey(connectorId, key);
            setConnectorConnected(connectorId, true, 'PAT configured');
            return;
          }
          setError(
            `OAuth for ${strategy.provider} isn't configured. Add AUTH_${strategy.provider.toUpperCase()}_ID and AUTH_${strategy.provider.toUpperCase()}_SECRET to .env.local, then restart the dev server.`,
          );
          return;
        }

        const { signIn } = await import('next-auth/react');
        await signIn(strategy.provider, { callbackUrl: window.location.href });
        return;
      }

      if (strategy.kind === 'apiKey') {
        const key = apiKeys[strategy.field];
        if (!key) {
          setError(`Add your key first in Settings → API Keys, then return here.`);
          setSettingsPage('api-keys');
          return;
        }
        await verifyApiKey(connectorId, key);
        setConnectorConnected(connectorId, true, 'API key configured');
        return;
      }

      if (strategy.kind === 'local') {
        setConnectorConnected(connectorId, true, 'Playwright (local)');
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDisconnect = async (connectorId: string) => {
    const strategy = CONNECTOR_STRATEGY[connectorId];
    if (strategy?.kind === 'oauth') {
      const { signOut } = await import('next-auth/react');
      // Don't fully sign out other oauth — just unmark this connector locally
      // (NextAuth has a single session; if you want full revocation, signOut here)
      void signOut;
    }
    setConnectorConnected(connectorId, false, undefined);
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-[#dadada]">Connectors</h2>
        <p className="text-xs text-[#7f7f7f] mt-1">Real OAuth for Google &amp; GitHub. Token-based for Notion / Slack / Telegram (paste keys in API Keys).</p>
      </div>
      {error && (
        <div className="px-4 py-2.5 bg-[rgba(242,90,90,0.08)] border border-[rgba(242,90,90,0.2)] rounded-xl text-xs text-[#f25a5a]">
          {error}
        </div>
      )}
      <div className="space-y-2">
        {connectors.map(connector => {
          const strategy = CONNECTOR_STRATEGY[connector.id];
          const tag =
            strategy?.kind === 'oauth' ? `OAuth (${strategy.provider})` :
            strategy?.kind === 'apiKey' ? 'API key' :
            strategy?.kind === 'local' ? 'Local' : 'Manual';
          return (
            <div key={connector.id} className="flex items-center justify-between px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl w-8 text-center shrink-0">{connector.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm text-[#dadada] truncate">{connector.name}</div>
                  <div className="text-[10px] text-[#5f5f5f] mt-0.5">
                    {tag}
                    {connector.connected && connector.account && <span className="text-[#7f7f7f] ml-2">· {connector.account}</span>}
                  </div>
                </div>
              </div>
              {connector.connected ? (
                <button
                  onClick={() => handleDisconnect(connector.id)}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-[rgba(37,186,59,0.12)] text-[#25ba3b] hover:bg-[rgba(242,90,90,0.12)] hover:text-[#f25a5a] transition-colors shrink-0"
                >
                  Connected
                </button>
              ) : (
                <button
                  onClick={() => handleConnect(connector.id)}
                  disabled={busyId === connector.id}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.06)] text-[#acacac] hover:bg-[rgba(255,255,255,0.10)] transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {busyId === connector.id && <Loader2 className="w-3 h-3 animate-spin" />}
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Integrations page ────────────────────────────────────────────────────────

function IntegrationsPage() {
  const { integrations, addIntegration, removeIntegration } = useAgentStore();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
      <AnimatePresence>
        {showAdd && (
          <AddIntegrationModal
            onAdd={(i) => { addIntegration(i); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)}
          />
        )}
      </AnimatePresence>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#dadada]">Integrations</h2>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] text-xs text-[#dadada] hover:bg-[rgba(255,255,255,0.10)] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />Add
          </button>
        </div>
        <p className="text-xs text-[#7f7f7f]">Connect to your favorite tools and platforms.</p>
        <div className="space-y-2">
          {integrations.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-[#272728] rounded-xl border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.10)] transition-colors group">
              <span className="text-xl w-8 text-center shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#dadada]">{item.name}</div>
                <div className="text-xs text-[#7f7f7f]">{item.desc}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a href={item.url} target="_blank" rel="noreferrer" className="p-1 rounded text-[#5f5f5f] hover:text-[#acacac] transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>
                {item.custom && (
                  <button onClick={() => removeIntegration(item.id)} className="p-1 rounded text-[#5f5f5f] hover:text-[#f25a5a] transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Main modal shell ─────────────────────────────────────────────────────────

export function SettingsModal() {
  const { settingsOpen, settingsPage, setSettingsPage, closeSettings } = useAgentStore();

  return (
    <AnimatePresence>
      {settingsOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={closeSettings}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="relative w-full max-w-3xl h-[580px] bg-[#1e1e1f] border border-[rgba(255,255,255,0.10)] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.8)] overflow-hidden flex pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Left nav */}
              <div className="w-52 shrink-0 bg-[#181819] border-r border-[rgba(255,255,255,0.06)] flex flex-col py-3 overflow-y-auto">
                {NAV_ITEMS.map(({ page, icon: Icon, label }) => (
                  <button
                    key={page}
                    onClick={() => setSettingsPage(page)}
                    className={cn(
                      'flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                      settingsPage === page
                        ? 'bg-[rgba(255,255,255,0.08)] text-[#dadada]'
                        : 'text-[#acacac] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#dadada]',
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <PageContent page={settingsPage} />
              </div>

              {/* Close */}
              <button
                onClick={closeSettings}
                className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-[rgba(255,255,255,0.06)] flex items-center justify-center hover:bg-[rgba(255,255,255,0.10)] transition-colors"
              >
                <X className="w-4 h-4 text-[#acacac]" />
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
