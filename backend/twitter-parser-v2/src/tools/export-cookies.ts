// Twitter Parser V2 - Cookie Export Tool
// Opens browser for manual login, then exports cookies

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIES_DIR = path.resolve(__dirname, '../../cookies');
const SESSIONS_DIR = path.resolve(__dirname, '../../sessions');

// Ensure directories exist
if (!fs.existsSync(COOKIES_DIR)) fs.mkdirSync(COOKIES_DIR, { recursive: true });
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function exportCookies() {
  console.log('\n=== Twitter Cookie Export Tool ===\n');
  
  const sessionId = await question('Enter session ID (e.g., account1): ');
  const username = await question('Enter Twitter username: ');
  const proxyUrl = await question('Enter proxy URL (or press Enter to skip): ');

  console.log('\n[1] Opening browser...');
  console.log('[2] Please log in to Twitter manually');
  console.log('[3] After successful login, press Enter in this terminal\n');

  const launchOptions: any = {
    headless: false,
    slowMo: 50,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  };

  const browser = await chromium.launch(launchOptions);

  const contextOptions: any = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
  };

  if (proxyUrl) {
    const url = new URL(proxyUrl);
    contextOptions.proxy = {
      server: `${url.protocol}//${url.hostname}:${url.port}`,
      username: url.username || undefined,
      password: url.password || undefined,
    };
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // Navigate to Twitter login
  await page.goto('https://x.com/login');

  console.log('Browser opened. Please log in to Twitter...');
  await question('Press Enter after successful login... ');

  // Get cookies
  const cookies = await context.cookies();
  console.log(`\nCaptured ${cookies.length} cookies`);

  // Save cookies
  const cookiesPath = path.join(COOKIES_DIR, `${sessionId}.json`);
  fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
  console.log(`Cookies saved to: ${cookiesPath}`);

  // Save storage state (includes localStorage, sessionStorage)
  const sessionPath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  await context.storageState({ path: sessionPath });
  console.log(`Session saved to: ${sessionPath}`);

  // Update sessions index
  const sessionsIndexPath = path.join(SESSIONS_DIR, '_sessions.json');
  let sessions: any[] = [];
  
  if (fs.existsSync(sessionsIndexPath)) {
    sessions = JSON.parse(fs.readFileSync(sessionsIndexPath, 'utf-8'));
  }

  // Add or update session
  const existingIdx = sessions.findIndex(s => s.id === sessionId);
  const sessionData = {
    id: sessionId,
    username,
    status: 'active',
    lastUsed: Date.now(),
    requestsInWindow: 0,
    windowStart: Date.now(),
    proxyUrl: proxyUrl || undefined,
  };

  if (existingIdx >= 0) {
    sessions[existingIdx] = sessionData;
  } else {
    sessions.push(sessionData);
  }

  fs.writeFileSync(sessionsIndexPath, JSON.stringify(sessions, null, 2));
  console.log('Sessions index updated');

  await browser.close();
  rl.close();

  console.log('\n✅ Cookie export complete!');
  console.log(`Session ID: ${sessionId}`);
  console.log(`Username: ${username}`);
  console.log(`Proxy: ${proxyUrl || 'none'}`);
}

exportCookies().catch(console.error);
