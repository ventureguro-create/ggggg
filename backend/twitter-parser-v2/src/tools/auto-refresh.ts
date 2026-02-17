// Twitter Parser V2 - Auto Session Refresh
// Автоматически обновляет cookies, посещая Twitter

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.resolve(__dirname, '../../sessions');
const COOKIES_DIR = path.resolve(__dirname, '../../cookies');

// Конфигурация
const REFRESH_INTERVAL_HOURS = 12; // Обновлять каждые 12 часов

interface Session {
  id: string;
  username: string;
  status: string;
  lastUsed: number;
  proxyUrl?: string;
}

async function loadSessions(): Promise<Session[]> {
  const indexPath = path.join(SESSIONS_DIR, '_sessions.json');
  if (!fs.existsSync(indexPath)) return [];
  return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

async function saveSessions(sessions: Session[]): Promise<void> {
  const indexPath = path.join(SESSIONS_DIR, '_sessions.json');
  fs.writeFileSync(indexPath, JSON.stringify(sessions, null, 2));
}

async function refreshSession(session: Session): Promise<boolean> {
  console.log(`\n[Refresh] Starting refresh for session: ${session.id}`);
  
  const sessionPath = path.join(SESSIONS_DIR, `${session.id}.json`);
  const cookiesPath = path.join(COOKIES_DIR, `${session.id}.json`);

  if (!fs.existsSync(sessionPath) && !fs.existsSync(cookiesPath)) {
    console.log(`[Refresh] No session files found for: ${session.id}`);
    return false;
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  try {
    const contextOptions: any = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    };

    // Добавить прокси если есть
    if (session.proxyUrl) {
      const url = new URL(session.proxyUrl);
      contextOptions.proxy = {
        server: `${url.protocol}//${url.hostname}:${url.port}`,
        username: url.username || undefined,
        password: url.password || undefined,
      };
    }

    // Загрузить существующую сессию
    if (fs.existsSync(sessionPath)) {
      contextOptions.storageState = sessionPath;
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // Загрузить cookies если нет storage state
    if (!fs.existsSync(sessionPath) && fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
      await context.addCookies(cookies);
    }

    // Посетить Twitter для обновления сессии
    console.log(`[Refresh] Visiting Twitter home...`);
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Проверить статус
    const url = page.url();
    
    if (url.includes('/login') || url.includes('/i/flow/login')) {
      console.log(`[Refresh] ❌ Session expired - redirected to login`);
      return false;
    }

    // Проверить на блокировку
    const errorText = await page.locator('text="Could not log you in"').count();
    if (errorText > 0) {
      console.log(`[Refresh] ❌ Account blocked`);
      return false;
    }

    // Сохранить обновлённые cookies
    const newCookies = await context.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(newCookies, null, 2));
    
    // Сохранить storage state
    await context.storageState({ path: sessionPath });

    console.log(`[Refresh] ✅ Session refreshed successfully (${newCookies.length} cookies)`);
    return true;

  } catch (error: any) {
    console.error(`[Refresh] Error:`, error.message);
    return false;
  } finally {
    await browser.close();
  }
}

async function refreshAllSessions(): Promise<void> {
  console.log('=== Twitter Session Auto-Refresh ===\n');
  
  const sessions = await loadSessions();
  const activeSessions = sessions.filter(s => s.status === 'active');

  console.log(`Found ${activeSessions.length} active sessions\n`);

  for (const session of activeSessions) {
    const success = await refreshSession(session);
    
    // Обновить статус
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      sessions[idx].status = success ? 'active' : 'expired';
      sessions[idx].lastUsed = Date.now();
    }
  }

  await saveSessions(sessions);
  console.log('\n=== Refresh complete ===');
}

// Запуск по расписанию
async function startScheduler(): Promise<void> {
  console.log(`Starting session refresh scheduler (every ${REFRESH_INTERVAL_HOURS} hours)\n`);
  
  // Первый запуск
  await refreshAllSessions();
  
  // Периодический запуск
  setInterval(async () => {
    await refreshAllSessions();
  }, REFRESH_INTERVAL_HOURS * 60 * 60 * 1000);
}

// Запуск
const args = process.argv.slice(2);

if (args.includes('--once')) {
  // Однократный запуск
  refreshAllSessions().catch(console.error);
} else if (args.includes('--session')) {
  // Обновить конкретную сессию
  const sessionId = args[args.indexOf('--session') + 1];
  if (sessionId) {
    loadSessions().then(sessions => {
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        refreshSession(session).then(success => {
          process.exit(success ? 0 : 1);
        });
      } else {
        console.log(`Session not found: ${sessionId}`);
        process.exit(1);
      }
    });
  }
} else {
  // Запуск планировщика
  startScheduler().catch(console.error);
}
