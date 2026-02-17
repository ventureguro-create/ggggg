// Twitter Parser V2 - Browser Manager
// Manages Playwright browser instances with stealth and proxy support

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

export interface BrowserOptions {
  proxyUrl?: string;
  sessionId?: string;
  headless?: boolean;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();

  async initialize(): Promise<void> {
    if (this.browser) return;

    // Ensure directories exist
    if (!fs.existsSync(config.sessionsDir)) {
      fs.mkdirSync(config.sessionsDir, { recursive: true });
    }
    if (!fs.existsSync(config.cookiesDir)) {
      fs.mkdirSync(config.cookiesDir, { recursive: true });
    }

    console.log('[BrowserManager] Initializing browser...');
    
    // Check for playwright browser executable
    const possiblePaths = [
      '/pw-browsers/chromium-1208/chrome-linux/chrome',
      '/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell',
      '/root/.cache/ms-playwright/chromium-1208/chrome-linux/chrome',
    ];
    
    let executablePath: string | undefined;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        executablePath = p;
        console.log(`[BrowserManager] Found browser at: ${p}`);
        break;
      }
    }
    
    this.browser = await chromium.launch({
      headless: config.headless,
      slowMo: config.slowMo,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        // Anti-detection args
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    console.log('[BrowserManager] Browser initialized');
  }

  async createContext(options: BrowserOptions = {}): Promise<BrowserContext> {
    if (!this.browser) {
      await this.initialize();
    }

    const contextOptions: any = {
      userAgent: config.userAgent,
      viewport: config.viewport,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      // Stealth settings
      javaScriptEnabled: true,
      bypassCSP: true,
      ignoreHTTPSErrors: true,
      // Permissions
      permissions: ['geolocation'],
      geolocation: { latitude: 40.7128, longitude: -74.0060 }, // NYC
    };

    // Add proxy if provided and valid
    const proxyUrl = options.proxyUrl || config.proxyUrl;
    if (proxyUrl && proxyUrl !== 'null' && !proxyUrl.includes('direct')) {
      try {
        const url = new URL(proxyUrl);
        contextOptions.proxy = {
          server: `${url.protocol}//${url.hostname}:${url.port}`,
          username: url.username || undefined,
          password: url.password || undefined,
        };
        console.log(`[BrowserManager] Using proxy: ${url.hostname}:${url.port}`);
      } catch (e) {
        console.log(`[BrowserManager] Invalid proxy URL, running without proxy`);
      }
    } else {
      console.log(`[BrowserManager] No proxy configured, running direct`);
    }

    // Load session if exists
    if (options.sessionId) {
      const sessionPath = path.join(config.sessionsDir, `${options.sessionId}.json`);
      if (fs.existsSync(sessionPath)) {
        contextOptions.storageState = sessionPath;
        console.log(`[BrowserManager] Loading session: ${options.sessionId}`);
      }
    }

    const context = await this.browser!.newContext(contextOptions);
    
    // Apply stealth scripts
    await this.applyStealthScripts(context);

    if (options.sessionId) {
      this.contexts.set(options.sessionId, context);
    }

    return context;
  }

  private async applyStealthScripts(context: BrowserContext): Promise<void> {
    // Override navigator properties to avoid detection
    await context.addInitScript(() => {
      // Override webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'denied' } as PermissionStatus);
        }
        return originalQuery(parameters);
      };

      // Override chrome runtime
      (window as any).chrome = {
        runtime: {},
        loadTimes: () => {},
        csi: () => {},
        app: {},
      };

      // Realistic canvas fingerprint
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      (HTMLCanvasElement.prototype as any).getContext = function(type: string, ...args: any[]) {
        const context = originalGetContext.apply(this, [type, ...args] as any);
        if (type === '2d' && context) {
          const originalFillText = (context as any).fillText;
          (context as any).fillText = function(...fillArgs: any[]) {
            // Add slight noise to text rendering
            return originalFillText.apply(this, fillArgs);
          };
        }
        return context;
      };
    });
  }

  async createPage(options: BrowserOptions = {}): Promise<Page> {
    const context = await this.createContext(options);
    const page = await context.newPage();
    
    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    return page;
  }

  async saveSession(sessionId: string, context: BrowserContext): Promise<void> {
    const sessionPath = path.join(config.sessionsDir, `${sessionId}.json`);
    await context.storageState({ path: sessionPath });
    console.log(`[BrowserManager] Session saved: ${sessionId}`);
  }

  async loadCookies(page: Page, sessionId: string): Promise<boolean> {
    const cookiesPath = path.join(config.cookiesDir, `${sessionId}.json`);
    
    if (!fs.existsSync(cookiesPath)) {
      console.log(`[BrowserManager] No cookies found for: ${sessionId}`);
      return false;
    }

    try {
      const rawCookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
      // Normalize sameSite values for Playwright
      const normalizedCookies = rawCookies.map((c: any) => {
        let sameSite: 'Strict' | 'Lax' | 'None' = 'Lax';
        const rawSameSite = String(c.sameSite || '').toLowerCase();
        if (rawSameSite === 'strict') sameSite = 'Strict';
        else if (rawSameSite === 'none' || rawSameSite === 'no_restriction') sameSite = 'None';
        return { ...c, sameSite };
      });
      await page.context().addCookies(normalizedCookies);
      console.log(`[BrowserManager] Cookies loaded for: ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`[BrowserManager] Error loading cookies:`, error);
      return false;
    }
  }

  async saveCookies(page: Page, sessionId: string): Promise<void> {
    const cookies = await page.context().cookies();
    const cookiesPath = path.join(config.cookiesDir, `${sessionId}.json`);
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    console.log(`[BrowserManager] Cookies saved for: ${sessionId}`);
  }

  async closeContext(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (context) {
      await context.close();
      this.contexts.delete(sessionId);
    }
  }

  async close(): Promise<void> {
    for (const [id, context] of this.contexts) {
      await context.close();
    }
    this.contexts.clear();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    console.log('[BrowserManager] Browser closed');
  }
}

export const browserManager = new BrowserManager();
