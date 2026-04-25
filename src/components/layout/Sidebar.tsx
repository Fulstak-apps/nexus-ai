'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '@/store/agent';
import { cn } from '@/lib/utils';
import {
  Plus, Search, BookOpen, Clock,
  MessageSquare, Trash2, Gift,
  Bot, Settings,
} from 'lucide-react';


export function Sidebar() {
  const {
    sessions, activeSessionId,
    setActiveSession, newSession, deleteSession,
    openSettings,
  } = useAgentStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const filteredSessions = sessions.filter(s =>
    !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="flex flex-col h-full w-[220px] shrink-0 bg-[#212122] border-r border-[rgba(255,255,255,0.06)]">

      {/* Top nav buttons */}
      <div className="flex flex-col gap-0.5 p-2 pt-3">
        <button
          onClick={newSession}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#dadada] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
        >
          <Plus className="w-4 h-4 text-[#acacac]" />
          New task
        </button>

        <button
          onClick={() => openSettings('skills')}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#dadada] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
        >
          <Bot className="w-4 h-4 text-[#acacac]" />
          Agent
        </button>

        <button
          onClick={() => setShowSearch(v => !v)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#dadada] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
        >
          <Search className="w-4 h-4 text-[#acacac]" />
          Search
        </button>

        <button
          onClick={() => openSettings('data')}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#dadada] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
        >
          <BookOpen className="w-4 h-4 text-[#acacac]" />
          Library
        </button>
      </div>

      {/* Search box */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-2"
          >
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              className="w-full bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-1.5 text-sm text-[#dadada] placeholder:text-[#5f5f5f] outline-none focus:border-[rgba(255,255,255,0.16)] mb-2"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Divider */}
      <div className="mx-3 my-1 border-t border-[rgba(255,255,255,0.06)]" />

      {/* All tasks */}
      <div className="px-2 flex-1 overflow-y-auto min-h-0">
        <div className="flex items-center gap-1 px-3 py-1.5">
          <Clock className="w-3.5 h-3.5 text-[#5f5f5f]" />
          <span className="text-[11px] font-semibold text-[#5f5f5f] uppercase tracking-wider">All tasks</span>
        </div>

        {filteredSessions.length === 0 && (
          <p className="px-3 py-2 text-xs text-[#5f5f5f]">No tasks yet</p>
        )}

        {filteredSessions.map(session => (
          <div
            key={session.id}
            className={cn(
              'group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors',
              activeSessionId === session.id
                ? 'bg-[rgba(255,255,255,0.08)] text-[#dadada]'
                : 'hover:bg-[rgba(255,255,255,0.04)] text-[#acacac]',
            )}
            onClick={() => setActiveSession(session.id)}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
            <span className="text-xs flex-1 truncate">{session.title}</span>
            {sessions.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); if (confirm('Delete?')) deleteSession(session.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Bottom: referral + settings */}
      <div className="border-t border-[rgba(255,255,255,0.06)] p-2 space-y-0.5">
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors text-left">
          <Gift className="w-4 h-4 text-[#1a93fe] shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#dadada] truncate">Share with a friend</div>
            <div className="text-[10px] text-[#5f5f5f]">Get 500 credits each</div>
          </div>
        </button>

        <button
          onClick={() => openSettings()}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors"
        >
          <Settings className="w-4 h-4 text-[#acacac]" />
          <span className="text-sm text-[#dadada]">Settings</span>
        </button>
      </div>
    </aside>
  );
}
