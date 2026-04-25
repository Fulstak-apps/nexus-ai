import { ToolDefinition } from '@/types';

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: 'file_read',
    description: 'Read the contents of a file from the sandbox filesystem.',
    params: {
      path: { type: 'string', description: 'File path (relative to sandbox)', required: true },
    },
  },
  {
    name: 'file_write',
    description: 'Write or overwrite a file in the sandbox with given content.',
    params: {
      path: { type: 'string', description: 'File path to write', required: true },
      content: { type: 'string', description: 'Content to write', required: true },
    },
  },
  {
    name: 'file_delete',
    description: 'Delete a file from the sandbox (requires explicit confirmation flag).',
    params: {
      path: { type: 'string', description: 'File path to delete', required: true },
      confirm: { type: 'boolean', description: 'Must be true to execute deletion', required: true },
    },
  },
  {
    name: 'code_execute',
    description: 'Execute Python or Node.js code in a sandboxed subprocess.',
    params: {
      language: { type: 'string', description: '"python" or "node"', required: true },
      code: { type: 'string', description: 'Source code to execute', required: true },
      timeout: { type: 'number', description: 'Max execution time in seconds (default 30)' },
    },
  },
  {
    name: 'http_request',
    description: 'Make an HTTP request to any URL.',
    params: {
      url: { type: 'string', description: 'Target URL', required: true },
      method: { type: 'string', description: 'GET | POST | PUT | DELETE | PATCH', required: true },
      headers: { type: 'object', description: 'Request headers' },
      body: { type: 'string', description: 'Request body (JSON string)' },
    },
  },
  {
    name: 'web_search',
    description: 'Search the web and return structured results with titles, URLs, and snippets.',
    params: {
      query: { type: 'string', description: 'Search query', required: true },
      maxResults: { type: 'number', description: 'Max results to return (default 5)' },
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch and extract readable text content from a URL (strips HTML).',
    params: {
      url: { type: 'string', description: 'URL to fetch', required: true },
    },
  },
  {
    name: 'browser_navigate',
    description: 'Navigate to a URL and extract structured page data: title, headings, links, forms, and main text. Better than web_fetch for structured extraction.',
    params: {
      url: { type: 'string', description: 'URL to navigate to', required: true },
      extract: { type: 'string', description: 'What to extract: "all" | "links" | "forms" | "text" | "headings" (default "all")' },
    },
  },
  {
    name: 'data_analyze',
    description: 'Analyze structured data (CSV or JSON). Computes stats, finds patterns, detects outliers. Accepts raw data string or a sandbox file path.',
    params: {
      data: { type: 'string', description: 'Raw CSV/JSON data string, or sandbox file path (e.g. "data.csv")', required: true },
      format: { type: 'string', description: '"csv" | "json" (default auto-detect)', },
      task: { type: 'string', description: 'Analysis goal: "summary" | "correlations" | "outliers" | "forecast" | "all" (default "summary")' },
    },
  },
  {
    name: 'image_generate',
    description: 'Generate an image from a text prompt using AI. Saves the result to the sandbox and returns the filename.',
    params: {
      prompt: { type: 'string', description: 'Detailed image description', required: true },
      style: { type: 'string', description: 'Art style: "realistic" | "illustration" | "diagram" | "chart" (default "realistic")' },
      size: { type: 'string', description: '"square" | "landscape" | "portrait" (default "square")' },
    },
  },
  {
    name: 'spawn_agent',
    description: 'Spawn a specialized sub-agent to handle a specific subtask in parallel. The sub-agent has access to search, fetch, code execution, and file tools. Returns the sub-agent result when complete.',
    params: {
      task: { type: 'string', description: 'The specific task for the sub-agent to complete', required: true },
      role: { type: 'string', description: 'Sub-agent specialization: "researcher" | "coder" | "swe" | "analyst" | "data_analyst" | "browser_navigator" | "writer" | "designer" | "planner" | "reviewer" | "assistant"', required: true },
      context: { type: 'string', description: 'Additional context or constraints for the sub-agent' },
    },
  },
  {
    name: 'stock_quote',
    description: 'Get real-time stock or crypto quote, key stats, and recent price history (free Yahoo Finance data). Supports stock tickers (AAPL), indices (^GSPC), and crypto (BTC-USD).',
    params: {
      symbol: { type: 'string', description: 'Ticker symbol (e.g. AAPL, MSFT, BTC-USD, ^GSPC)', required: true },
      range: { type: 'string', description: 'Price history range: "1d" | "5d" | "1mo" | "3mo" | "1y" | "5y" (default "1mo")' },
    },
  },
  {
    name: 'tts_generate',
    description: 'Generate speech audio from text using ElevenLabs (requires ElevenLabs key in settings). Saves an MP3 to the sandbox.',
    params: {
      text: { type: 'string', description: 'Text to speak', required: true },
      voice: { type: 'string', description: 'Voice ID or name (default "Rachel")' },
    },
  },
  {
    name: 'browser_click',
    description: 'Click an element on the active browser page (Playwright). Use after browser_navigate. Provide a CSS selector or visible text.',
    params: {
      selector: { type: 'string', description: 'CSS selector OR text="Button label" OR role-based locator', required: true },
    },
  },
  {
    name: 'browser_fill',
    description: 'Type into a form field on the active browser page. Use after browser_navigate.',
    params: {
      selector: { type: 'string', description: 'CSS selector for the input', required: true },
      value: { type: 'string', description: 'Text to type', required: true },
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the active browser page and save it to the sandbox. Returns the filename.',
    params: {
      fullPage: { type: 'boolean', description: 'Capture full scrollable page (default false)' },
    },
  },
  {
    name: 'bash',
    description: 'Execute a shell command in the sandbox (bash). Use for git, find, grep, ls, curl, package management, build steps. Output is captured. Network and FS are unrestricted within sandbox; treat with care.',
    params: {
      command: { type: 'string', description: 'Shell command to run', required: true },
      timeout: { type: 'number', description: 'Max execution time in seconds (default 60)' },
      cwd: { type: 'string', description: 'Working directory (default sandbox root)' },
    },
  },
  {
    name: 'str_replace',
    description: 'Precisely edit a sandbox file by replacing exact text. Fails if old_str is not unique or not found — preventing accidental edits. Preferred over file_write for surgical changes.',
    params: {
      path: { type: 'string', description: 'File path in sandbox', required: true },
      old_str: { type: 'string', description: 'Exact substring to replace (must be unique in file)', required: true },
      new_str: { type: 'string', description: 'Replacement text', required: true },
    },
  },
  {
    name: 'ask_human',
    description: 'Pause execution and ask the user a clarifying question. Use ONLY when the request is genuinely ambiguous and cannot be reasonably inferred. Returns the user reply.',
    params: {
      question: { type: 'string', description: 'Concise question to ask the user', required: true },
      options: { type: 'string', description: 'Optional JSON array of suggested answers' },
    },
  },
  {
    name: 'terminate',
    description: 'Signal that the task is fully complete. Use as the final tool call after summarizing results. The loop exits cleanly after this.',
    params: {
      summary: { type: 'string', description: 'One-sentence summary of what was accomplished', required: true },
      success: { type: 'boolean', description: 'Whether the task succeeded (default true)' },
    },
  },
  {
    name: 'chart_create',
    description: 'Generate an interactive HTML chart (line, bar, pie, scatter) using Chart.js. Saves to sandbox. Pass JSON-encoded data.',
    params: {
      title: { type: 'string', description: 'Chart title', required: true },
      type: { type: 'string', description: '"line" | "bar" | "pie" | "doughnut" | "scatter"', required: true },
      labels: { type: 'string', description: 'JSON array of x-axis labels, e.g. ["Jan","Feb","Mar"]', required: true },
      data: { type: 'string', description: 'JSON array of numbers OR JSON array of {label,data:[]} datasets for multi-series', required: true },
    },
  },
  {
    name: 'create_presentation',
    description: 'Generate a polished HTML presentation (slide deck) and save it to the sandbox. Returns the filename.',
    params: {
      title: { type: 'string', description: 'Presentation title', required: true },
      sections: { type: 'string', description: 'JSON array of section objects: [{title, content, bullets?, notes?}]', required: true },
      theme: { type: 'string', description: '"dark" | "light" | "corporate" | "minimal" (default "dark")' },
    },
  },
];

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find(t => t.name === name);
}
