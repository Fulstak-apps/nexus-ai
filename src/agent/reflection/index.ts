import { Plan, PlanStep, StepReflection, SessionReflection } from '@/types';
import { generate, FAST_MODEL } from '../core/anthropic';

const REFLECT_SYSTEM = `You are a critical AI evaluator. Assess the quality of an executed step and output ONLY JSON:
{
  "quality": "excellent"|"good"|"partial"|"failed",
  "issues": ["<specific issue>"],
  "improvements": ["<concrete improvement>"],
  "shouldReplan": true|false
}

Be honest and specific. If output is empty or an error occurred, mark as failed.`;

export async function reflectOnStep(
  step: PlanStep,
  output: string,
  planGoal: string,
): Promise<StepReflection> {
  try {
    const raw = await generate({
      model: FAST_MODEL,
      system: REFLECT_SYSTEM,
      prompt: `Goal: ${planGoal}\nStep: ${step.title}\nDescription: ${step.description}\nOutput:\n${output.slice(0, 2000)}`,
      maxTokens: 512,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('bad json');
    return JSON.parse(jsonMatch[0]) as StepReflection;
  } catch {
    return {
      quality: 'partial',
      issues: ['Reflection parse failed'],
      improvements: [],
      shouldReplan: false,
    };
  }
}

const SESSION_REFLECT_SYSTEM = `Summarize what happened in this AI session. Output ONLY JSON:
{
  "summary": "<2-3 sentence summary>",
  "patterns": ["<recurring pattern or strength>"],
  "improvements": ["<suggested improvement for future sessions>"]
}`;

export async function reflectOnSession(plan: Plan): Promise<SessionReflection> {
  const stepsText = plan.steps.map(s =>
    `[${s.status.toUpperCase()}] ${s.title}: ${s.reflection?.quality ?? 'n/a'}`
  ).join('\n');

  try {
    const raw = await generate({
      model: FAST_MODEL,
      system: SESSION_REFLECT_SYSTEM,
      prompt: `Goal: ${plan.goal}\nSteps:\n${stepsText}`,
      maxTokens: 512,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('bad json');
    const parsed = JSON.parse(jsonMatch[0]) as { summary: string; patterns: string[]; improvements: string[] };

    return {
      sessionId: plan.id,
      summary: parsed.summary,
      patterns: parsed.patterns ?? [],
      improvements: parsed.improvements ?? [],
      storedAt: Date.now(),
    };
  } catch {
    return {
      sessionId: plan.id,
      summary: `Completed ${plan.steps.filter(s => s.status === 'completed').length}/${plan.steps.length} steps for: ${plan.goal}`,
      patterns: [],
      improvements: [],
      storedAt: Date.now(),
    };
  }
}
