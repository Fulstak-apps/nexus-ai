'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { useAgentStore } from '@/store/agent';
import { cn } from '@/lib/utils';
import {
  Search, Plus, Brain, FileText, Settings,
  Sun, Moon, Database, Terminal, X,
} from 'lucide-react';

interface CommandItem {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  shortcut?: string;
  action: () => void;
  group: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { newSession, setTheme, theme, setRightPanelTab } = useAgentStore();

  const COMMANDS: CommandItem[] = [
    {
      id: 'new-session',
      icon: Plus,
      label: 'New Session',
      description: 'Start a fresh conversation',
      shortcut: '⌘N',
      group: 'Sessions',
      action: () => { newSession(); setOpen(false); },
    },
    {
      id: 'toggle-dark',
      icon: theme === 'dark' ? Sun : Moon,
      label: theme === 'dark' ? 'Light Mode' : 'Dark Mode',
      description: 'Toggle appearance',
      shortcut: '⌘⇧D',
      group: 'Appearance',
      action: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); setOpen(false); },
    },
    {
      id: 'view-files',
      icon: FileText,
      label: 'Browse Sandbox Files',
      description: 'View files the agent has created',
      group: 'Workspace',
      action: () => { setRightPanelTab('files'); setOpen(false); },
    },
    {
      id: 'view-memory',
      icon: Database,
      label: 'View Memory',
      description: 'Browse long-term memory entries',
      group: 'Workspace',
      action: () => { setRightPanelTab('memory'); setOpen(false); },
    },
    {
      id: 'view-reasoning',
      icon: Brain,
      label: 'Agent Reasoning',
      description: 'View current agent phase and plan',
      group: 'Workspace',
      action: () => { setRightPanelTab('reasoning'); setOpen(false); },
    },
    {
      id: 'view-context',
      icon: Terminal,
      label: 'Session Context',
      description: 'Model, tools, and profile summary',
      group: 'Workspace',
      action: () => { setRightPanelTab('context'); setOpen(false); },
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Settings',
      description: 'Profile, theme, data',
      shortcut: '⌘,',
      group: 'System',
      action: () => { setRightPanelTab('settings'); setOpen(false); },
    },
  ];

  const filtered = query
    ? COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  const flatFiltered = Object.values(grouped).flat();

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
      }
      if (!open) return;
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, flatFiltered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        flatFiltered[selectedIndex]?.action();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flatFiltered, selectedIndex]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
          >
            <GlassPanel variant="elevated" className="overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/20 dark:border-white/[0.08]">
                <Search className="w-4 h-4 opacity-40 shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search commands, tools, sessions…"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:opacity-30"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="opacity-40 hover:opacity-70">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 opacity-40 font-mono">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto py-2">
                {Object.entries(grouped).map(([group, items]) => (
                  <div key={group}>
                    <div className="px-4 py-1">
                      <span className="text-[10px] font-semibold opacity-30 uppercase tracking-wider">
                        {group}
                      </span>
                    </div>
                    {items.map(cmd => {
                      const globalIndex = flatFiltered.indexOf(cmd);
                      const Icon = cmd.icon;
                      return (
                        <motion.button
                          key={cmd.id}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            selectedIndex === globalIndex
                              ? 'bg-accent-blue/10 dark:bg-accent-blue/15'
                              : 'hover:bg-black/5 dark:hover:bg-white/5',
                          )}
                        >
                          <div className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center',
                            selectedIndex === globalIndex
                              ? 'bg-accent-blue text-white'
                              : 'bg-black/5 dark:bg-white/5',
                          )}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{cmd.label}</div>
                            <div className="text-xs opacity-40">{cmd.description}</div>
                          </div>
                          {cmd.shortcut && (
                            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 opacity-40 font-mono">
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="py-8 text-center opacity-30">
                    <Search className="w-8 h-8 mx-auto mb-2" />
                    <div className="text-sm">No results for &ldquo;{query}&rdquo;</div>
                  </div>
                )}
              </div>
            </GlassPanel>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
