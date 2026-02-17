// Twitter Parser V2 - Configuration
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env.PORT || '5001'),
  
  // Proxy
  proxyUrl: process.env.PROXY_URL || '',
  
  // Directories
  sessionsDir: path.resolve(__dirname, '..', process.env.SESSIONS_DIR || './sessions'),
  cookiesDir: path.resolve(__dirname, '..', process.env.COOKIES_DIR || './cookies'),
  
  // Rate limiting
  requestsPerHour: parseInt(process.env.REQUESTS_PER_HOUR || '200'),
  cooldownMinutes: parseInt(process.env.COOLDOWN_MINUTES || '15'),
  
  // Browser
  headless: process.env.HEADLESS !== 'false',
  slowMo: parseInt(process.env.SLOW_MO || '50'),
  
  // User Agent (realistic)
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // Viewport
  viewport: { width: 1920, height: 1080 },
};
