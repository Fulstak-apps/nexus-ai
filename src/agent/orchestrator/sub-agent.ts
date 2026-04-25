/**
 * Sub-agent runner used by spawn_agent tool.
 * Each sub-agent gets its own Ollama call with a specialized system prompt.
 */

import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { TOOL_REGISTRY } from '../tools/registry';
import { executeTool } from '../tools/executor';
import { ToolCall } from '@/types';
import { getClient, FAST_MODEL, toOpenAITools } from '../core/anthropic';

const ROLE_PROMPTS: Record<string, string> = {
  researcher: 'You are a research specialist. Use web_search and browser_navigate to find comprehensive, accurate information. Synthesize findings into clear summaries with sources.',
  coder: 'You are an expert software engineer. Write clean, well-structured code. Test your solutions with code_execute when possible. Document your approach.',
  analyst: 'You are a data analyst. Use data_analyze and code_execute to extract insights from data. Present findings with key statistics and interpretations.',
  writer: 'You are a professional writer. Produce clear, engaging, well-structured content tailored to the audience. Save outputs with file_write.',
  designer: 'You are a UI/UX designer. Create polished HTML/CSS interfaces and save them to the sandbox. Focus on aesthetics and usability.',
  assistant: 'You are a capable general-purpose assistant. Complete the given task efficiently using whatever tools are most appropriate.',
  // OpenManus-inspired specialists
  swe: 'You are a senior software engineer (SWE-agent). Read existing code with file_read, make precise edits with str_replace, run tests via bash, and verify before declaring done. Always use str_replace over file_write for edits.',
  data_analyst: 'You are a senior data analyst. Use data_analyze for stats, chart_create for visualizations, and code_execute for advanced computation. Always produce a chart for non-trivial findings.',
  browser_navigator: 'You are a browser automation expert. Use browser_navigate, browser_click, browser_fill, and browser_screenshot to operate web pages. Verify each action with screenshots.',
  planner: 'You are a strategic planner. Decompose the task into ordered steps with dependencies. Output a numbered plan; do not execute.',
  reviewer: 'You are a code reviewer. Read code with file_read, identify bugs, security issues, and improvements. Be thorough and specific. Cite file paths and line context.',
};

export async function runSubAgent(
  task: string,
  role: string,
  context: string,
): Promise<{ result: string; role: string; toolsUsed: string[] }> {
  const systemPrompt = `${ROLE_PROMPTS[role] ?? ROLE_PROMPTS.assistant}

## Your Task
${task}

${context ? `## Context\n${context}` : ''}

## Rules
- Complete the task fully and return a comprehensive result
- Use tools as needed; don't stop early
- Summarize what you accomplished at the end`;

  const tools = toOpenAITools(TOOL_REGISTRY.filter(t => t.name !== 'spawn_agent'));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task },
  ];

  let finalText = '';
  const toolsUsed: string[] = [];
  let iterations = 0;

  const client = getClient();

  while (iterations < 8) {
    const response = await client.chat.completions.create({
      model: FAST_MODEL,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 2048,
    });

    const choice = response.choices[0];
    const msg = choice?.message;
    if (!msg) break;

    if (msg.content) finalText += msg.content;

    const toolCalls = msg.tool_calls ?? [];
    if (!toolCalls.length) break;

    // Add assistant message
    messages.push({
      role: 'assistant',
      content: msg.content ?? null,
      tool_calls: toolCalls,
    });

    // Execute each tool call
    for (const tc of toolCalls) {
      if (tc.type !== 'function') continue;
      const ftc = tc as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
      const name = ftc.function.name;
      const args = ftc.function.arguments;
      toolsUsed.push(name);

      let params: Record<string, unknown> = {};
      try { params = JSON.parse(args || '{}') as Record<string, unknown>; } catch { /* ignore */ }

      const call: ToolCall = {
        id: tc.id,
        tool: name as ToolCall['tool'],
        params,
        startedAt: Date.now(),
      };

      const result = await executeTool(call);
      const content = result.error
        ? `Error: ${result.error}`
        : typeof result.output === 'string'
          ? result.output
          : JSON.stringify(result.output).slice(0, 6000);

      messages.push({ role: 'tool', tool_call_id: tc.id, content });
    }

    iterations++;
  }

  return {
    result: finalText || 'Sub-agent completed without text output.',
    role,
    toolsUsed: [...new Set(toolsUsed)],
  };
}
