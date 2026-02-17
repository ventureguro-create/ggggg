// Twitter Parser V2 - Test Session Tool
// Tests if a saved session is still valid

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIES_DIR = path.resolve(__dirname, '../../cookies');
const SESSIONS_DIR = path.resolve(__dirname, '../../sessions');

const sessionId = process.argv[2];

if (!sessionId) {
  console.log('Usage: npx tsx src/tools/test-session.ts <sessionId>');
  console.log('\nAvailable sessions:');
  
  if (fs.existsSync(SESSIONS_DIR)) {
    const indexPath = path.join(SESSIONS_DIR, '_sessions.json');
    if (fs.existsSync(indexPath)) {
      const sessions = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      sessions.forEach((s: any) => {
        console.log(`  - ${s.id} (@${s.username}) [${s.status}]`);
      });
    }
  }
  process.exit(1);
}

async function testSession() {
  console.log(`\nTesting session: ${sessionId}\n`);

  const sessionPath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  const cookiesPath = path.join(COOKIES_DIR, `${sessionId}.json`);

  if (!fs.existsSync(sessionPath) && !fs.existsSync(cookiesPath)) {
    console.log('❌ Session not found');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const contextOptions: any = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  };

  // Load storage state if exists
  if (fs.existsSync(sessionPath)) {
    contextOptions.storageState = sessionPath;
    console.log('Loaded storage state');
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // Load cookies if exists and no storage state
  if (!fs.existsSync(sessionPath) && fs.existsSync(cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
    await context.addCookies(cookies);
    console.log(`Loaded ${cookies.length} cookies`);
  }

  console.log('Navigating to Twitter home...');
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  const url = page.url();
  console.log(`Current URL: ${url}`);

  // Take screenshot
  const screenshotPath = path.join(SESSIONS_DIR, `${sessionId}_test.png`);
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved: ${screenshotPath}`);

  // Check login status
  if (url.includes('/login') || url.includes('/i/flow/login')) {
    console.log('\n❌ Session EXPIRED - redirected to login');
    await updateSessionStatus(sessionId, 'expired');
  } else {
    // Try to find username
    try {
      const profileLink = await page.locator('a[data-testid="AppTabBar_Profile_Link"]').getAttribute('href', { timeout: 5000 });
      if (profileLink) {
        const username = profileLink.replace('/', '');
        console.log(`\n✅ Session VALID - logged in as @${username}`);
        await updateSessionStatus(sessionId, 'active');
      } else {
        console.log('\n✅ Session appears VALID');
        await updateSessionStatus(sessionId, 'active');
      }
    } catch {
      // Check for error message
      const errorText = await page.locator('text="Could not log you in"').count();
      if (errorText > 0) {
        console.log('\n❌ Session BANNED - "Could not log you in" error');
        await updateSessionStatus(sessionId, 'banned');
      } else {
        console.log('\n⚠️ Session status UNKNOWN');
        await updateSessionStatus(sessionId, 'unknown');
      }
    }
  }

  await browser.close();
}

async function updateSessionStatus(sessionId: string, status: string) {
  const indexPath = path.join(SESSIONS_DIR, '_sessions.json');
  if (fs.existsSync(indexPath)) {
    const sessions = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const session = sessions.find((s: any) => s.id === sessionId);
    if (session) {
      session.status = status;
      fs.writeFileSync(indexPath, JSON.stringify(sessions, null, 2));
      console.log(`Updated session status to: ${status}`);
    }
  }
}

testSession().catch(console.error);
