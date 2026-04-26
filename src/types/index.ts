// ─── Core Domain Types ────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type TaskStatus = 'pending' | 'planning' | 'executing' | 'reflecting' | 'completed' | 'failed';
export type ToolName =
  | 'file_read' | 'file_write' | 'file_delete' | 'str_replace'
  | 'code_execute' | 'bash' | 'http_request'
  | 'web_search' | 'web_fetch'
  | 'browser_navigate' | 'browser_click' | 'browser_fill' | 'browser_screenshot'
  | 'data_analyze' | 'chart_create'
  | 'image_generate' | 'spawn_agent'
  | 'create_presentation'
  | 'stock_quote' | 'tts_generate'
  | 'ask_human' | 'terminate'
  | 'pdf_extract' | 'vision_analyze' | 'deploy_url';
export type ThinkingPhase = 'idle' | 'thinking' | 'planning' | 'executing' | 'reflecting';
export type AgentMode = 'normal' | 'research' | 'background';

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  reasoning?: string;
  planSnapshot?: Plan;
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export interface ToolCall {
  id: string;
  tool: ToolName;
  params: Record<string, unknown>;
  startedAt: number;
}

export interface ToolResult {
  toolCallId: string;
  tool: ToolName;
  output: unknown;
  error?: string;
  durationMs: number;
}

export interface ToolDefinition {
  name: ToolName;
  description: string;
  params: Record<string, ToolParamSchema>;
}

export interface ToolParamSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
}

// ─── Planning ─────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];
  currentStepIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  toolsNeeded: ToolName[];
  dependsOn: string[];       // step ids
  status: TaskStatus;
  output?: string;
  reflection?: StepReflection;
  parallelGroup?: string;    // steps with same group run concurrently
}

// ─── Reflection ───────────────────────────────────────────────────────────────

export interface StepReflection {
  quality: 'excellent' | 'good' | 'partial' | 'failed';
  issues: string[];
  improvements: string[];
  shouldReplan: boolean;
}

export interface SessionReflection {
  sessionId: string;
  summary: string;
  patterns: string[];
  improvements: string[];
  storedAt: number;
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  content: string;
  type: 'task' | 'insight' | 'preference' | 'session';
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface UserProfile {
  id: string;
  preferences: Record<string, string>;
  writingStyle: string;
  recurringGoals: string[];
  updatedAt: number;
}

// ─── Agent State ──────────────────────────────────────────────────────────────

export interface AgentState {
  sessionId: string;
  phase: ThinkingPhase;
  currentPlan: Plan | null;
  messages: Message[];
  shortTermContext: string;
  isStreaming: boolean;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessage?: string;
}

// ─── Background Jobs ──────────────────────────────────────────────────────────

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BackgroundJob {
  id: string;
  title: string;
  description: string;
  status: JobStatus;
  progress: number;       // 0–100
  result?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  mode: AgentMode;
}

// ─── Research ────────────────────────────────────────────────────────────────

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  fetched?: string;
  relevance?: number;
}

export interface ResearchReport {
  id: string;
  query: string;
  depth: 'quick' | 'deep' | 'wide';
  sources: ResearchSource[];
  report: string;
  keyFindings: string[];
  createdAt: number;
}

// ─── Multi-Agent ──────────────────────────────────────────────────────────────

export interface SubAgent {
  id: string;
  task: string;
  role: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  tokensUsed?: number;
  startedAt: number;
  completedAt?: number;
}

export interface MultiAgentRun {
  id: string;
  goal: string;
  agents: SubAgent[];
  synthesis?: string;
  status: 'running' | 'completed' | 'failed';
  createdAt: number;
}

export interface ScheduledTask {
  id: string;
  name: string;
  schedule: string;
  cronLike: string;
  prompt: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}
