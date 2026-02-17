// Twitter Parser V2 - Session Manager
// Manages Twitter sessions with cookie-based authentication

import { Page, BrowserContext } from 'playwright';
import { browserManager } from './browser-manager.js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

export interface TwitterSession {
  id: string;
  username: string;
  status: 'active' | 'expired' | 'banned' | 'unknown';
  lastUsed: number;
  requestsInWindow: number;
  windowStart: number;
  proxyUrl?: string;
}

export interface SessionCheckResult {
  valid: boolean;
  username?: string;
  error?: string;
}

export class SessionManager {
  private sessions: Map<string, TwitterSession> = new Map();
  private sessionsFile: string;

  constructor() {
    this.sessionsFile = path.join(config.sessionsDir, '_sessions.json');
    this.loadSessions();
  }

  private loadSessions(): void {
    try {
      if (fs.existsSync(this.sessionsFile)) {
        const data = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf-8'));
        for (const session of data) {
          this.sessions.set(session.id, session);
        }
        console.log(`[SessionManager] Loaded ${this.sessions.size} sessions`);
      }
    } catch (error) {
      console.error('[SessionManager] Error loading sessions:', error);
    }
  }

  private saveSessions(): void {
    try {
      const data = Array.from(this.sessions.values());
      fs.writeFileSync(this.sessionsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[SessionManager] Error saving sessions:', error);
    }
  }

  async checkSession(page: Page): Promise<SessionCheckResult> {
    try {
      // Navigate to Twitter home
      await page.goto('https://x.com/home', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      // Wait a bit for page to settle
      await page.waitForTimeout(3000);

      // Check if we're logged in by looking for specific elements
      const url = page.url();
      
      // If redirected to login, session is invalid
      if (url.includes('/login') || url.includes('/i/flow/login')) {
        return { valid: false, error: 'Redirected to login page' };
      }

      // Check for "Could not log you in" error
      const errorText = await page.locator('text="Could not log you in"').count();
      if (errorText > 0) {
        return { valid: false, error: 'Account blocked or rate limited' };
      }

      // Try to get username from page
      try {
        // Look for avatar link which contains username
        const avatarLink = await page.locator('a[data-testid="AppTabBar_Profile_Link"]').getAttribute('href', { timeout: 5000 });
        if (avatarLink) {
          const username = avatarLink.replace('/', '');
          return { valid: true, username };
        }
      } catch {
        // Avatar link not found, try alternative
      }

      // Check if we can see the compose tweet button (indicates logged in)
      const composeTweet = await page.locator('a[data-testid="SideNav_NewTweet_Button"]').count();
      if (composeTweet > 0) {
        return { valid: true, username: 'unknown' };
      }

      return { valid: false, error: 'Could not verify session' };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  async addSession(
    sessionId: string, 
    username: string, 
    cookies: any[], 
    proxyUrl?: string
  ): Promise<void> {
    // Save cookies
    const cookiesPath = path.join(config.cookiesDir, `${sessionId}.json`);
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

    // Create session record
    const session: TwitterSession = {
      id: sessionId,
      username,
      status: 'active',
      lastUsed: Date.now(),
      requestsInWindow: 0,
      windowStart: Date.now(),
      proxyUrl,
    };

    this.sessions.set(sessionId, session);
    this.saveSessions();
    console.log(`[SessionManager] Added session: ${sessionId} (${username})`);
  }

  getSession(sessionId: string): TwitterSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): TwitterSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(): TwitterSession[] {
    return this.getAllSessions().filter(s => s.status === 'active');
  }

  // Get best available session (least used, not in cooldown)
  getBestSession(): TwitterSession | null {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;

    const available = this.getActiveSessions().filter(session => {
      // Reset window if hour passed
      if (now - session.windowStart > hourMs) {
        session.requestsInWindow = 0;
        session.windowStart = now;
        this.saveSessions();
      }
      // Check if under rate limit
      return session.requestsInWindow < config.requestsPerHour;
    });

    if (available.length === 0) return null;

    // Return least used session
    return available.sort((a, b) => a.requestsInWindow - b.requestsInWindow)[0];
  }

  incrementUsage(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.requestsInWindow++;
      session.lastUsed = Date.now();
      this.saveSessions();
    }
  }

  markSessionStatus(sessionId: string, status: TwitterSession['status']): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      this.saveSessions();
      console.log(`[SessionManager] Session ${sessionId} marked as ${status}`);
    }
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    
    // Remove cookie file
    const cookiesPath = path.join(config.cookiesDir, `${sessionId}.json`);
    if (fs.existsSync(cookiesPath)) {
      fs.unlinkSync(cookiesPath);
    }
    
    // Remove session file
    const sessionPath = path.join(config.sessionsDir, `${sessionId}.json`);
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
    }

    this.saveSessions();
    console.log(`[SessionManager] Removed session: ${sessionId}`);
  }
}

export const sessionManager = new SessionManager();
