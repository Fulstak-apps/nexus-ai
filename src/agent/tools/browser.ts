/**
 * Playwright-backed browser session.
 *
 * One persistent Chromium context lives across tool calls within a server
 * process, so the agent can: navigate → click → fill → screenshot in sequence.
 * Cookies are persisted to disk so logins survive server restarts.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { SANDBOX_ROOT } from './executor';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

const COOKIES_FILE = path.join(SANDBOX_ROOT, '_browser_cookies.json');

// Stealth user-agent cycling (avoids bot detection)
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

async function saveCookies(): Promise<void> {
  if (!context) return;
  try {
    const cookies = await context.cookies();
    await fs.mkdir(SANDBOX_ROOT, { recursive: true });
    await fs.writeFile(COOKIES_FILE, JSON.stringify(cookies, null, 2), 'utf-8');
  } catch { /* best-effort */ }
}

async function loadCookies(): Promise<void> {
  if (!context) return;
  try {
    const raw = await fs.readFile(COOKIES_FILE, 'utf-8');
    const cookies = JSON.parse(raw) as Parameters<BrowserContext['addCookies']>[0];
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }
  } catch { /* no saved cookies yet */ }
}

async function ensurePage(): Promise<Page> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
  }
  if (!context) {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    context = await browser.newContext({
      userAgent: ua,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      // Make Playwright less detectable
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    // Spoof navigator.webdriver = false
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      // Spoof Chrome object
      (window as unknown as Record<string, unknown>).chrome = { runtime: {} };
    });

    await loadCookies();
  }
  if (!page || page.isClosed()) {
    page = await context.newPage();
  }
  return page;
}

export async function browserNavigate(url: string, extractMode: string): Promise<unknown> {
  const p = await ensurePage();
  const response = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await p.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});

  // Persist cookies after every navigation (captures login state)
  await saveCookies();

  const title = await p.title();

  const headings: string[] = await p.$$eval('h1, h2, h3, h4, h5, h6', els =>
    els.map(e => `${e.tagName}: ${(e.textContent ?? '').replace(/\s+/g, ' ').trim()}`).filter(s => s.length > 4).slice(0, 20),
  );

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

  const forms: Array<{ action: string; method: string; fields: string[] }> = (extractMode === 'all' || extractMode === 'forms')
    ? await p.$$eval('form', els =>
        els.map(f => ({
          action: (f as HTMLFormElement).action,
          method: (f as HTMLFormElement).method,
          fields: Array.from(f.querySelectorAll('input, select, textarea'))
            .map(i => `${(i as HTMLInputElement).name || (i as HTMLInputElement).id || (i as HTMLInputElement).type || 'field'}`)
            .filter((n): n is string => Boolean(n)),
        })),
      )
    : [];

  const text = await p.evaluate(() => {
    const body = document.body;
    if (!body) return '';
    body.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    return (body.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 6000);
  });

  // Auto-screenshot
  let screenshot: string | undefined;
  try {
    await fs.mkdir(SANDBOX_ROOT, { recursive: true });
    const filename = `nav_${Date.now()}.png`;
    await p.screenshot({ path: path.join(SANDBOX_ROOT, filename), fullPage: false });
    screenshot = filename;
  } catch { /* best-effort */ }

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
  const sel = selector.startsWith('text=') ? `text=${selector.slice(5).replace(/^["']|["']$/g, '')}` : selector;
  await p.locator(sel).first().click({ timeout: 10_000 });
  await p.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => {});
  await saveCookies();

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
  const loc = p.locator(selector).first();
  // Try fill() first; fall back to type() for sites that block programmatic fill
  try {
    await loc.fill(value, { timeout: 10_000 });
  } catch {
    await loc.click({ timeout: 5_000 });
    await loc.type(value, { delay: 50 });
  }
  return { filled: selector, length: value.length };
}

export async function browserType(selector: string, value: string, delay: number): Promise<unknown> {
  const p = await ensurePage();
  await p.locator(selector).first().click({ timeout: 8_000 });
  await p.locator(selector).first().type(value, { delay: delay || 60 });
  return { typed: selector, chars: value.length };
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

export async function browserEvaluate(script: string): Promise<unknown> {
  const p = await ensurePage();
  const result = await p.evaluate(script);
  return { result };
}

export async function browserWaitFor(
  target: string,
  kind: string,
  timeout: number,
): Promise<unknown> {
  const p = await ensurePage();
  const ms = (timeout || 10) * 1000;

  if (kind === 'url') {
    await p.waitForURL(target, { timeout: ms });
  } else if (kind === 'network') {
    await p.waitForLoadState('networkidle', { timeout: ms });
  } else {
    // Default: wait for a CSS selector to be visible
    await p.waitForSelector(target, { state: 'visible', timeout: ms });
  }

  // Screenshot after wait
  let screenshot: string | undefined;
  try {
    const filename = `wait_${Date.now()}.png`;
    await p.screenshot({ path: path.join(SANDBOX_ROOT, filename), fullPage: false });
    screenshot = filename;
  } catch { /* best-effort */ }

  return { ready: true, url: p.url(), title: await p.title(), screenshot };
}

export async function browserScroll(direction: string, amount: number): Promise<unknown> {
  const p = await ensurePage();
  const px = (amount || 500) * (direction === 'up' ? -1 : 1);
  await p.mouse.wheel(0, px);
  await p.waitForTimeout(300);
  return { scrolled: direction, pixels: Math.abs(px) };
}

export async function browserGetCookies(domain?: string): Promise<unknown> {
  const p = await ensurePage();
  const all = await (p.context()).cookies(domain ? [domain] : undefined);
  // Also save to disk
  await saveCookies();
  return {
    count: all.length,
    cookies: all.map(c => ({ name: c.name, domain: c.domain, path: c.path, secure: c.secure })),
    raw: all,
  };
}

export async function browserSetCookies(cookiesJson: string): Promise<unknown> {
  const ctx = context ?? (await ensurePage()).context();
  const cookies = JSON.parse(cookiesJson) as Parameters<BrowserContext['addCookies']>[0];
  await ctx.addCookies(cookies);
  await saveCookies();
  return { added: cookies.length };
}

export async function browserClearCookies(): Promise<unknown> {
  if (context) {
    await context.clearCookies();
  }
  try { await fs.unlink(COOKIES_FILE); } catch { /* already gone */ }
  return { cleared: true };
}

export async function closeBrowser(): Promise<void> {
  await saveCookies();
  if (page) await page.close().catch(() => {});
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  page = null;
  context = null;
  browser = null;
}

// Save session info (current URL, title) for UI status bar
export async function getSessionInfo(): Promise<unknown> {
  if (!page || page.isClosed()) return { active: false };
  try {
    return { active: true, url: page.url(), title: await page.title() };
  } catch {
    return { active: false };
  }
}
