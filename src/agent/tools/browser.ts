/**
 * Playwright-backed browser session.
 *
 * One persistent Chromium context lives across tool calls within a server
 * process, so the agent can: navigate → click → fill → screenshot in sequence.
 * The page is reused; navigating again loads a new URL in the same tab.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { SANDBOX_ROOT } from './executor';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

async function ensurePage(): Promise<Page> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });
  }
  if (!context) {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
  }
  if (!page || page.isClosed()) {
    page = await context.newPage();
  }
  return page;
}

export async function browserNavigate(url: string, extractMode: string): Promise<unknown> {
  const p = await ensurePage();
  const response = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  // Give a moment for client-side rendering
  await p.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});

  const title = await p.title();

  // Headings
  const headings: string[] = await p.$$eval('h1, h2, h3, h4, h5, h6', els =>
    els.map(e => `${e.tagName}: ${(e.textContent ?? '').replace(/\s+/g, ' ').trim()}`).filter(s => s.length > 4).slice(0, 20),
  );

  // Links
  const links: Array<{ text: string; href: string }> = (extractMode === 'all' || extractMode === 'links')
    ? await p.$$eval('a[href]', els =>
        els
          .map(e => ({
            text: ((e as HTMLAnchorElement).innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
            href: (e as HTMLAnchorElement).href,
          }))
          .filter(l => l.text && l.href.startsWith('http'))
          .slice(0, 30),
      )
    : [];

  // Forms
  const forms: Array<{ action: string; method: string; fields: string[] }> = (extractMode === 'all' || extractMode === 'forms')
    ? await p.$$eval('form', els =>
        els.map(f => ({
          action: (f as HTMLFormElement).action,
          method: (f as HTMLFormElement).method,
          fields: Array.from(f.querySelectorAll('input, select, textarea'))
            .map(i => (i as HTMLInputElement).name || (i as HTMLInputElement).id)
            .filter((n): n is string => Boolean(n)),
        })),
      )
    : [];

  // Visible body text
  const text = await p.evaluate(() => {
    const body = document.body;
    if (!body) return '';
    // Remove scripts/styles
    body.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    return (body.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 6000);
  });

  // Auto-screenshot for the live mini-browser preview in the UI
  let screenshot: string | undefined;
  try {
    await fs.mkdir(SANDBOX_ROOT, { recursive: true });
    const filename = `nav_${Date.now()}.png`;
    await p.screenshot({ path: path.join(SANDBOX_ROOT, filename), fullPage: false });
    screenshot = filename;
  } catch { /* screenshot is best-effort */ }

  return {
    url: p.url(),
    status: response?.status() ?? 0,
    title,
    headings,
    links,
    forms,
    text,
    screenshot,
  };
}

export async function browserClick(selector: string): Promise<unknown> {
  const p = await ensurePage();
  // Support text="..." shorthand
  const sel = selector.startsWith('text=') ? `text=${selector.slice(5).replace(/^["']|["']$/g, '')}` : selector;
  await p.locator(sel).first().click({ timeout: 10_000 });
  await p.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

  let screenshot: string | undefined;
  try {
    await fs.mkdir(SANDBOX_ROOT, { recursive: true });
    const filename = `click_${Date.now()}.png`;
    await p.screenshot({ path: path.join(SANDBOX_ROOT, filename), fullPage: false });
    screenshot = filename;
  } catch { /* best-effort */ }

  return { clicked: selector, url: p.url(), title: await p.title(), screenshot };
}

export async function browserFill(selector: string, value: string): Promise<unknown> {
  const p = await ensurePage();
  await p.locator(selector).first().fill(value, { timeout: 10_000 });
  return { filled: selector, length: value.length };
}

export async function browserScreenshot(fullPage: boolean): Promise<unknown> {
  const p = await ensurePage();
  await fs.mkdir(SANDBOX_ROOT, { recursive: true });
  const filename = `screenshot_${Date.now()}.png`;
  const filepath = path.join(SANDBOX_ROOT, filename);
  await p.screenshot({ path: filepath, fullPage });
  const stat = await fs.stat(filepath);
  return { filename, fullPage, bytes: stat.size, url: p.url(), title: await p.title() };
}

export async function closeBrowser(): Promise<void> {
  if (page) await page.close().catch(() => {});
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  page = null;
  context = null;
  browser = null;
}
