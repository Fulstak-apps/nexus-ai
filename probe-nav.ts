import { executeTool } from './src/agent/tools/executor';
(async () => {
  const r = await executeTool({ id: '1', tool: 'browser_navigate' as any, params: { url: 'https://example.com', extract: 'all' }, startedAt: Date.now() });
  console.log('screenshot:', (r as any).output?.screenshot);
  console.log('title:', (r as any).output?.title);
})();
