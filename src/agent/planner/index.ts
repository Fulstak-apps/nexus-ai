import { Plan, PlanStep, Message } from '@/types';
import { randomUUID } from 'crypto';
import { generate } from '../core/anthropic';

const PLANNER_SYSTEM = `You are an expert AI planner. Given a user goal and conversation history, decompose the goal into a structured, executable plan.

Output ONLY valid JSON in this exact shape:
{
  "goal": "<one-line goal summary>",
  "steps": [
    {
      "id": "<short-id>",
      "title": "<step title>",
      "description": "<what to do and why>",
      "toolsNeeded": ["file_read"|"file_write"|"file_delete"|"code_execute"|"http_request"|"web_search"|"web_fetch"],
      "dependsOn": ["<step-id>"],
      "parallelGroup": "<optional group name for concurrent steps>"
    }
  ]
}

Rules:
- Steps must be ordered by dependency
- Mark steps that can run concurrently with the same parallelGroup string
- toolsNeeded must be from the allowed list (may be empty [])
- dependsOn contains IDs of steps that must complete first
- Be specific and actionable in descriptions
- Max 8 steps per plan`;

export async function buildPlan(goal: string, conversationHistory: Message[]): Promise<Plan> {
  const historyText = conversationHistory.slice(-6)
    .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n');

  const raw = await generate({
    system: PLANNER_SYSTEM,
    prompt: `${historyText ? historyText + '\n\n---\n\n' : ''}Plan this goal: ${goal}`,
    maxTokens: 2048,
  });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Planner returned invalid JSON');

  const parsed = JSON.parse(jsonMatch[0]) as {
    goal: string;
    steps: Array<{
      id: string;
      title: string;
      description: string;
      toolsNeeded: string[];
      dependsOn: string[];
      parallelGroup?: string;
    }>;
  };

  const now = Date.now();
  const steps: PlanStep[] = parsed.steps.map(s => ({
    id: s.id || randomUUID().slice(0, 8),
    title: s.title,
    description: s.description,
    toolsNeeded: (s.toolsNeeded ?? []) as PlanStep['toolsNeeded'],
    dependsOn: s.dependsOn ?? [],
    status: 'pending',
    parallelGroup: s.parallelGroup,
  }));

  return {
    id: randomUUID(),
    goal: parsed.goal,
    steps,
    currentStepIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getNextExecutableStep(plan: Plan): PlanStep | null {
  for (const step of plan.steps) {
    if (step.status !== 'pending') continue;
    const depsComplete = step.dependsOn.every(depId => {
      const dep = plan.steps.find(s => s.id === depId);
      return dep?.status === 'completed';
    });
    if (depsComplete) return step;
  }
  return null;
}

export function isPlanComplete(plan: Plan): boolean {
  return plan.steps.every(s => s.status === 'completed' || s.status === 'failed');
}
