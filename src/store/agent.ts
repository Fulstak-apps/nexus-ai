import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Message, Plan, Session, ThinkingPhase, AgentMode, BackgroundJob, SubAgent } from '@/types';

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  custom?: boolean;
}

export interface Connector {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  account?: string;
}

export interface Integration {
  id: string;
  name: string;
  icon: string;
  desc: string;
  url: string;
  connected: boolean;
  custom?: boolean;
}

export interface ScheduledTask {
  id: string;
  name: string;
  schedule: string; // human-readable: "every 1h", "daily at 9am", "every 30m"
  cronLike: string; // interval in minutes as string, e.g. "60"
  prompt: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

const DEFAULT_SKILLS: Skill[] = [
  { id: 'video-generator', name: 'video-generator', description: 'Generate short videos from text prompts', enabled: false },
  { id: 'music-prompter', name: 'music-prompter', description: 'Create music from descriptions', enabled: false },
  { id: 'manus-api', name: 'manus-api', description: 'Access Manus API endpoints directly', enabled: true },
  { id: 'excel-generator', name: 'excel-generator', description: 'Create and edit Excel spreadsheets', enabled: true },
  { id: 'stock-analysis', name: 'stock-analysis', description: 'Pull real-time stock and market data', enabled: false },
  { id: 'image-generator', name: 'image-generator', description: 'Generate images via DALL-E 3', enabled: true },
  { id: 'web-scraper', name: 'web-scraper', description: 'Extract structured data from any website', enabled: true },
  { id: 'code-interpreter', name: 'code-interpreter', description: 'Execute Python, JS, and shell code', enabled: true },
];

const DEFAULT_CONNECTORS: Connector[] = [
  { id: 'browser', name: 'My Browser', icon: '🌐', connected: false },
  { id: 'gmail', name: 'Gmail', icon: '📧', connected: false },
  { id: 'gdrive', name: 'Google Drive', icon: '📁', connected: false },
  { id: 'meta-ads', name: 'Meta Ads Manager', icon: '📊', connected: false },
  { id: 'gemini', name: 'Google Gemini', icon: '✨', connected: false },
  { id: 'elevenlabs', name: 'ElevenLabs', icon: '🎙️', connected: false },
  { id: 'gdrive-picker', name: 'Google Drive File Picker', icon: '🗂️', connected: false },
  { id: 'notion', name: 'Notion', icon: '📝', connected: false },
  { id: 'github', name: 'GitHub', icon: '🐙', connected: false },
  { id: 'slack-connect', name: 'Slack', icon: '💬', connected: false },
  { id: 'telegram', name: 'Telegram Bot', icon: '✈️', connected: false },
];

const DEFAULT_INTEGRATIONS: Integration[] = [
  { id: 'manus-api', name: 'Manus API', icon: '⚡', desc: 'Build custom workflows with the API', url: 'https://docs.manus.im/api', connected: false },
  { id: 'zapier', name: 'Zapier', icon: '🔗', desc: 'Connect 6,000+ apps via Zapier', url: 'https://zapier.com', connected: false },
  { id: 'slack-int', name: 'Slack', icon: '💬', desc: 'Get task updates in Slack channels', url: 'https://slack.com', connected: false },
  { id: 'telegram', name: 'Telegram', icon: '✈️', desc: 'Control the agent via Telegram bot', url: 'https://telegram.org', connected: false },
  { id: 'line', name: 'Line', icon: '💚', desc: 'Use from Line messenger', url: 'https://line.me', connected: false },
];

interface AgentStore {
  // Persistent
  sessions: Session[];
  activeSessionId: string | null;
  messagesBySession: Record<string, Message[]>;
  theme: 'light' | 'dark' | 'system';

  // Derived
  messages: Message[];

  // Ephemeral UI
  phase: ThinkingPhase;
  currentPlan: Plan | null;
  isStreaming: boolean;
  streamingText: string;
  rightPanelTab: 'context' | 'memory' | 'files' | 'reasoning' | 'settings' | 'jobs' | 'agents';
  sidebarOpen: boolean;

  // Shell state
  settingsOpen: boolean;
  settingsPage: 'account' | 'settings' | 'usage' | 'billing' | 'scheduled' | 'mail' | 'data' | 'cloud-browser' | 'my-computer' | 'personalization' | 'skills' | 'connectors' | 'integrations' | 'api-keys' | 'about' | 'help';
  credits: number;
  modelLabel: string;
  selectedModelId: 'lite' | 'pro' | 'max';

  // Mode & jobs
  agentMode: AgentMode;
  jobs: BackgroundJob[];
  activeAgents: SubAgent[];
  researchPhase: string | null;

  // User profile
  userProfile: { name: string; email: string };

  // Preferences
  preferences: {
    language: string;
    timezone: string;
    dateFormat: string;
    notifications: boolean;
  };

  // Skills / Connectors / Integrations
  skills: Skill[];
  connectors: Connector[];
  integrations: Integration[];
  scheduledTasks: ScheduledTask[];

  // Personalization
  personalization: { aboutYou: string; customInstructions: string };

  // Data controls
  dataControls: { improveWithData: boolean; storeHistory: boolean; shareAnalytics: boolean };

  // Cloud browser
  cloudBrowser: { saveCookies: boolean; autoScreenshot: boolean; adBlocking: boolean };

  // My Computer
  myComputerEnabled: boolean;

  // API Keys (user-supplied credentials)
  apiKeys: {
    anthropic: string;
    openai: string;
    elevenlabs: string;
    huggingface: string;
    tavily: string;
    notion: string;
    slackBot: string;
    telegramBot: string;
    githubToken: string;
  };

  // Usage stats
  usageStats: { creditsUsed: number; creditsTotal: number; tasksRun: number; hoursSaved: number };

  // Actions
  setPhase: (phase: ThinkingPhase) => void;
  setCurrentPlan: (plan: Plan | null) => void;
  addMessage: (msg: Message) => void;
  appendStreamToken: (token: string) => void;
  clearStreamingText: () => void;
  setIsStreaming: (v: boolean) => void;
  setRightPanelTab: (tab: AgentStore['rightPanelTab']) => void;
  setSidebarOpen: (v: boolean) => void;
  setTheme: (theme: AgentStore['theme']) => void;
  newSession: () => void;
  setActiveSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  updatePlanStep: (stepId: string, updates: Partial<Plan['steps'][0]>) => void;
  resetAll: () => void;
  setAgentMode: (mode: AgentMode) => void;
  openSettings: (page?: AgentStore['settingsPage']) => void;
  closeSettings: () => void;
  setSettingsPage: (page: AgentStore['settingsPage']) => void;
  setCredits: (n: number) => void;
  setJobs: (jobs: BackgroundJob[]) => void;
  upsertJob: (job: BackgroundJob) => void;
  setActiveAgents: (agents: SubAgent[]) => void;
  upsertAgent: (agent: SubAgent) => void;
  setResearchPhase: (phase: string | null) => void;

  setUserProfile: (profile: Partial<AgentStore['userProfile']>) => void;
  setPreferences: (prefs: Partial<AgentStore['preferences']>) => void;

  toggleSkill: (id: string) => void;
  addSkill: (skill: Omit<Skill, 'id'>) => void;
  removeSkill: (id: string) => void;

  setConnectorConnected: (id: string, connected: boolean, account?: string) => void;

  setIntegrationConnected: (id: string, connected: boolean) => void;
  addIntegration: (integration: Omit<Integration, 'id'>) => void;
  removeIntegration: (id: string) => void;

  addScheduledTask: (task: Omit<ScheduledTask, 'id'>) => void;
  updateScheduledTask: (id: string, updates: Partial<ScheduledTask>) => void;
  deleteScheduledTask: (id: string) => void;

  setPersonalization: (p: Partial<AgentStore['personalization']>) => void;
  setDataControls: (controls: Partial<AgentStore['dataControls']>) => void;
  setCloudBrowser: (settings: Partial<AgentStore['cloudBrowser']>) => void;
  setMyComputerEnabled: (v: boolean) => void;
  setApiKey: (key: keyof AgentStore['apiKeys'], value: string) => void;
  incrementUsage: (creditsUsed?: number) => void;
  setSelectedModel: (id: 'lite' | 'pro' | 'max') => void;
  deleteAllData: () => void;
}

export const useAgentStore = create<AgentStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      messagesBySession: {},
      messages: [],
      theme: 'system',

      phase: 'idle',
      currentPlan: null,
      isStreaming: false,
      streamingText: '',
      rightPanelTab: 'reasoning',
      sidebarOpen: true,

      agentMode: 'normal',
      jobs: [],
      activeAgents: [],
      researchPhase: null,

      settingsOpen: false,
      settingsPage: 'account',
      credits: 5000,
      modelLabel: 'Nexus 1.0',
      selectedModelId: 'pro' as const,

      userProfile: { name: 'New User', email: 'user@example.com' },

      preferences: {
        language: 'English',
        timezone: 'Auto-detect',
        dateFormat: 'MM/DD/YYYY',
        notifications: true,
      },

      skills: DEFAULT_SKILLS,
      connectors: DEFAULT_CONNECTORS,
      integrations: DEFAULT_INTEGRATIONS,
      scheduledTasks: [],

      personalization: { aboutYou: '', customInstructions: '' },

      dataControls: {
        improveWithData: false,
        storeHistory: true,
        shareAnalytics: true,
      },

      cloudBrowser: {
        saveCookies: false,
        autoScreenshot: true,
        adBlocking: true,
      },

      myComputerEnabled: false,

      apiKeys: {
        anthropic: '',
        openai: '',
        elevenlabs: '',
        huggingface: '',
        tavily: '',
        notion: '',
        slackBot: '',
        telegramBot: '',
        githubToken: '',
      },

      usageStats: {
        creditsUsed: 0,
        creditsTotal: 5000,
        tasksRun: 0,
        hoursSaved: 0,
      },

      setPhase: (phase) => set({ phase }),
      setCurrentPlan: (plan) => set({ currentPlan: plan }),
      setIsStreaming: (v) => set({ isStreaming: v }),
      setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      setTheme: (theme) => set({ theme }),
      setAgentMode: (mode) => set({ agentMode: mode }),
      openSettings: (page) => set({ settingsOpen: true, ...(page ? { settingsPage: page } : {}) }),
      closeSettings: () => set({ settingsOpen: false }),
      setSettingsPage: (page) => set({ settingsPage: page }),
      setCredits: (n) => set({ credits: n }),
      setJobs: (jobs) => set({ jobs }),
      upsertJob: (job) => set(state => ({
        jobs: state.jobs.some(j => j.id === job.id)
          ? state.jobs.map(j => j.id === job.id ? job : j)
          : [job, ...state.jobs],
      })),
      setActiveAgents: (agents) => set({ activeAgents: agents }),
      upsertAgent: (agent) => set(state => ({
        activeAgents: state.activeAgents.some(a => a.id === agent.id)
          ? state.activeAgents.map(a => a.id === agent.id ? agent : a)
          : [...state.activeAgents, agent],
      })),
      setResearchPhase: (phase) => set({ researchPhase: phase }),

      addMessage: (msg) => {
        const sid = get().activeSessionId;
        if (!sid) return;
        set(state => {
          const existing = state.messagesBySession[sid] ?? [];
          const next = [...existing, msg];
          const isFirstUserMsg = msg.role === 'user' && existing.filter(m => m.role === 'user').length === 0;
          return {
            messagesBySession: { ...state.messagesBySession, [sid]: next },
            messages: next,
            sessions: state.sessions.map(s =>
              s.id === sid
                ? {
                    ...s,
                    messageCount: next.length,
                    lastMessage: msg.content.slice(0, 80),
                    updatedAt: Date.now(),
                    title: isFirstUserMsg ? msg.content.slice(0, 48) : s.title,
                  }
                : s
            ),
          };
        });
      },

      appendStreamToken: (token) => set(state => ({
        streamingText: state.streamingText + token,
      })),

      clearStreamingText: () => set({ streamingText: '' }),

      newSession: () => {
        const id = uid();
        const session: Session = {
          id,
          title: 'New Session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0,
        };
        set(state => ({
          sessions: [session, ...state.sessions],
          activeSessionId: id,
          messagesBySession: { ...state.messagesBySession, [id]: [] },
          messages: [],
          currentPlan: null,
          phase: 'idle',
          streamingText: '',
          activeAgents: [],
          researchPhase: null,
        }));
      },

      setActiveSession: (id) => {
        const msgs = get().messagesBySession[id] ?? [];
        set({
          activeSessionId: id,
          messages: msgs,
          currentPlan: null,
          phase: 'idle',
          streamingText: '',
          activeAgents: [],
          researchPhase: null,
        });
      },

      deleteSession: (id) => set(state => {
        const remaining = state.sessions.filter(s => s.id !== id);
        const nextActive = state.activeSessionId === id ? (remaining[0]?.id ?? null) : state.activeSessionId;
        const nextBySession = { ...state.messagesBySession };
        delete nextBySession[id];
        return {
          sessions: remaining,
          messagesBySession: nextBySession,
          activeSessionId: nextActive,
          messages: nextActive ? (nextBySession[nextActive] ?? []) : [],
        };
      }),

      renameSession: (id, title) => set(state => ({
        sessions: state.sessions.map(s => s.id === id ? { ...s, title } : s),
      })),

      updatePlanStep: (stepId, updates) => set(state => {
        if (!state.currentPlan) return state;
        return {
          currentPlan: {
            ...state.currentPlan,
            steps: state.currentPlan.steps.map(s =>
              s.id === stepId ? { ...s, ...updates } : s
            ),
          },
        };
      }),

      resetAll: () => set({
        sessions: [],
        activeSessionId: null,
        messagesBySession: {},
        messages: [],
        currentPlan: null,
        phase: 'idle',
        streamingText: '',
        isStreaming: false,
        activeAgents: [],
        jobs: [],
        researchPhase: null,
      }),

      setUserProfile: (profile) => set(state => ({
        userProfile: { ...state.userProfile, ...profile },
      })),

      setPreferences: (prefs) => set(state => ({
        preferences: { ...state.preferences, ...prefs },
      })),

      toggleSkill: (id) => set(state => ({
        skills: state.skills.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s),
      })),
      addSkill: (skill) => {
        const id = uid();
        set(state => ({
          skills: [...state.skills, { ...skill, id, custom: true }],
        }));
      },
      removeSkill: (id) => set(state => ({
        skills: state.skills.filter(s => s.id !== id),
      })),

      setConnectorConnected: (id, connected, account) => set(state => ({
        connectors: state.connectors.map(c =>
          c.id === id ? { ...c, connected, ...(account !== undefined ? { account } : {}) } : c
        ),
      })),

      setIntegrationConnected: (id, connected) => set(state => ({
        integrations: state.integrations.map(i =>
          i.id === id ? { ...i, connected } : i
        ),
      })),
      addIntegration: (integration) => {
        const id = uid();
        set(state => ({
          integrations: [...state.integrations, { ...integration, id, custom: true }],
        }));
      },
      removeIntegration: (id) => set(state => ({
        integrations: state.integrations.filter(i => i.id !== id),
      })),

      addScheduledTask: (task) => {
        const id = uid();
        set(state => ({
          scheduledTasks: [...state.scheduledTasks, { ...task, id }],
        }));
      },
      updateScheduledTask: (id, updates) => set(state => ({
        scheduledTasks: state.scheduledTasks.map(t => t.id === id ? { ...t, ...updates } : t),
      })),
      deleteScheduledTask: (id) => set(state => ({
        scheduledTasks: state.scheduledTasks.filter(t => t.id !== id),
      })),

      setPersonalization: (p) => set(state => ({
        personalization: { ...state.personalization, ...p },
      })),

      setDataControls: (controls) => set(state => ({
        dataControls: { ...state.dataControls, ...controls },
      })),

      setCloudBrowser: (settings) => set(state => ({
        cloudBrowser: { ...state.cloudBrowser, ...settings },
      })),

      setMyComputerEnabled: (v) => set({ myComputerEnabled: v }),

      setApiKey: (key, value) => set(state => ({
        apiKeys: { ...state.apiKeys, [key]: value },
      })),

      setSelectedModel: (id) => set({ selectedModelId: id }),

      incrementUsage: (creditsUsed = 10) => set(state => ({
        usageStats: {
          ...state.usageStats,
          creditsUsed: state.usageStats.creditsUsed + creditsUsed,
          tasksRun: state.usageStats.tasksRun + 1,
          hoursSaved: Math.round((state.usageStats.tasksRun + 1) * 0.25 * 10) / 10,
        },
      })),

      deleteAllData: () => set({
        sessions: [],
        activeSessionId: null,
        messagesBySession: {},
        messages: [],
        currentPlan: null,
        phase: 'idle',
        streamingText: '',
        isStreaming: false,
        activeAgents: [],
        jobs: [],
        researchPhase: null,
        scheduledTasks: [],
        personalization: { aboutYou: '', customInstructions: '' },
        usageStats: { creditsUsed: 0, creditsTotal: 5000, tasksRun: 0, hoursSaved: 0 },
      }),
    }),
    {
      name: 'nexus-ai-state-v2',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      } as unknown as Storage)),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        messagesBySession: state.messagesBySession,
        theme: state.theme,
        userProfile: state.userProfile,
        preferences: state.preferences,
        skills: state.skills,
        connectors: state.connectors,
        integrations: state.integrations,
        scheduledTasks: state.scheduledTasks,
        personalization: state.personalization,
        dataControls: state.dataControls,
        cloudBrowser: state.cloudBrowser,
        myComputerEnabled: state.myComputerEnabled,
        usageStats: state.usageStats,
        credits: state.credits,
        apiKeys: state.apiKeys,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.activeSessionId) {
          state.messages = state.messagesBySession[state.activeSessionId] ?? [];
        }
      },
    },
  ),
);
