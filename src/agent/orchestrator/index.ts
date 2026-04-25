/**
 * Multi-Agent Orchestrator
 *
 * Decomposes a goal into parallel sub-tasks, runs each on a specialized
 * sub-agent concurrently, then synthesizes the results with a coordinator.
 */

import { randomUUID } from 'crypto';
import { SubAgent, MultiAgentRun } from '@/types';
import { runSubAgent } from './sub-agent';
import { generate, FAST_MODEL, PLANNER_MODEL } from '../core/anthropic';

interface SubtaskSpec {
  task: string;
  role: 'researcher' | 'coder' | 'analyst' | 'writer' | 'designer' | 'assistant';
}

async function decomposeGoal(goal: string): Promise<SubtaskSpec[]> {
  const text = await generate({
    model: FAST_MODEL,
    system: `You decompose goals into parallel subtasks for specialized agents.
Return ONLY a JSON array (no markdown) with objects: [{task: string, role: "researcher"|"coder"|"analyst"|"writer"|"designer"|"assistant"}]
Use 2-5 agents. Make subtasks independent so they can run in parallel.`,
    prompt: `Decompose this goal into parallel subtasks: ${goal}`,
    maxTokens: 1024,
  });

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [{ task: goal, role: 'assistant' }];

  try {
    return JSON.parse(jsonMatch[0]) as SubtaskSpec[];
  } catch {
    return [{ task: goal, role: 'assistant' }];
  }
}

async function synthesizeResults(goal: string, agents: SubAgent[]): Promise<string> {
  const completed = agents.filter(a => a.status === 'completed');
  if (!completed.length) return 'No agents completed successfully.';

  const agentSummaries = completed.map((a, i) =>
    `Agent ${i + 1} (${a.role}): ${a.result ?? 'no output'}`
  ).join('\n\n---\n\n');

  return await generate({
    model: PLANNER_MODEL,
    system: 'You are a synthesis coordinator. Combine the outputs of multiple specialized agents into a single coherent, comprehensive response that directly addresses the original goal.',
    prompt: `Original Goal: ${goal}\n\nAgent Outputs:\n${agentSummaries}\n\nProvide a unified synthesis that best answers the original goal.`,
    maxTokens: 2048,
  });
}

export async function* runMultiAgent(goal: string): AsyncGenerator<{ type: string; data: unknown }> {
  const runId = randomUUID();

  yield { type: 'orchestrator_start', data: { id: runId, goal } };

  // Decompose into subtasks
  yield { type: 'orchestrator_phase', data: 'decomposing' };
  const subtasks = await decomposeGoal(goal);

  const agents: SubAgent[] = subtasks.map(s => ({
    id: randomUUID(),
    task: s.task,
    role: s.role,
    status: 'pending',
    startedAt: Date.now(),
  }));

  yield { type: 'orchestrator_agents', data: agents };

  // Run all agents in parallel
  yield { type: 'orchestrator_phase', data: 'executing' };

  const agentPromises = agents.map(async (agent) => {
    agent.status = 'running';
    agent.startedAt = Date.now();

    try {
      const result = await runSubAgent(agent.task, agent.role, `Part of a larger goal: ${goal}`);
      agent.status = 'completed';
      agent.result = result.result;
      agent.completedAt = Date.now();
    } catch (err) {
      agent.status = 'failed';
      agent.result = err instanceof Error ? err.message : String(err);
      agent.completedAt = Date.now();
    }

    return agent;
  });

  // Stream progress as agents complete
  const settled = await Promise.allSettled(agentPromises);
  for (const r of settled) {
    if (r.status === 'fulfilled') {
      yield { type: 'orchestrator_agent_done', data: r.value };
    }
  }

  // Synthesize
  yield { type: 'orchestrator_phase', data: 'synthesizing' };
  const synthesis = await synthesizeResults(goal, agents);

  const run: MultiAgentRun = {
    id: runId,
    goal,
    agents,
    synthesis,
    status: 'completed',
    createdAt: Date.now(),
  };

  yield { type: 'orchestrator_done', data: run };
}
