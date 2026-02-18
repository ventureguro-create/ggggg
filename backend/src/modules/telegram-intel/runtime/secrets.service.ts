/**
 * Secrets Service - Secure credential management
 * 
 * Decrypts secrets.enc using Fernet (AES-128-CBC + HMAC-SHA256)
 * Key is provided via TG_SECRETS_KEY environment variable
 * Secrets are held in memory only, never written to disk in plain text
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

interface TelegramSecrets {
  apiId: number;
  apiHash: string;
  session: string;
}

interface SecretsData {
  MONGO_URL?: string;
  DB_NAME?: string;
  TELEGRAM_API_ID?: string;
  TELEGRAM_API_HASH?: string;
  TELEGRAM_SESSION?: string;
  [key: string]: string | undefined;
}

let cachedSecrets: SecretsData | null = null;

/**
 * Fernet decryption implementation
 * Fernet = AES-128-CBC + HMAC-SHA256
 */
function fernetDecrypt(token: Buffer, key: Buffer): Buffer {
  // Fernet key is 32 bytes: 16 for signing, 16 for encryption
  const signingKey = key.subarray(0, 16);
  const encryptionKey = key.subarray(16, 32);

  // Token structure: version (1) + timestamp (8) + iv (16) + ciphertext + hmac (32)
  const version = token[0];
  if (version !== 0x80) {
    throw new Error('Invalid Fernet token version');
  }

  const timestamp = token.subarray(1, 9);
  const iv = token.subarray(9, 25);
  const ciphertext = token.subarray(25, -32);
  const hmac = token.subarray(-32);

  // Verify HMAC
  const hmacData = token.subarray(0, -32);
  const computedHmac = crypto.createHmac('sha256', signingKey).update(hmacData).digest();
  
  if (!crypto.timingSafeEqual(hmac, computedHmac)) {
    throw new Error('Invalid Fernet token: HMAC verification failed');
  }

  // Decrypt
  const decipher = crypto.createDecipheriv('aes-128-cbc', encryptionKey, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted;
}

/**
 * Load and decrypt secrets from secrets.enc
 */
export function loadSecrets(secretsPath?: string, keyOverride?: string): SecretsData {
  if (cachedSecrets) {
    return cachedSecrets;
  }

  const key = keyOverride || process.env.TG_SECRETS_KEY;
  if (!key) {
    console.warn('[Secrets] TG_SECRETS_KEY not set, using fallback env vars');
    return {};
  }

  const filePath = secretsPath || path.join(process.cwd(), '.secrets', 'secrets.enc');
  
  if (!fs.existsSync(filePath)) {
    console.warn(`[Secrets] File not found: ${filePath}`);
    return {};
  }

  try {
    const encryptedBase64 = fs.readFileSync(filePath, 'utf-8').trim();
    const encryptedBuffer = Buffer.from(encryptedBase64, 'base64url');
    const keyBuffer = Buffer.from(key, 'base64');
    
    const decrypted = fernetDecrypt(encryptedBuffer, keyBuffer);
    const data = JSON.parse(decrypted.toString('utf-8')) as SecretsData;
    
    cachedSecrets = data;
    console.log('[Secrets] Successfully loaded encrypted secrets');
    
    return data;
  } catch (err: any) {
    console.error('[Secrets] Failed to decrypt:', err?.message || err);
    return {};
  }
}

/**
 * Get Telegram-specific secrets
 */
export function getTelegramSecrets(): TelegramSecrets | null {
  const secrets = loadSecrets();
  
  // Try encrypted secrets first
  if (secrets.TELEGRAM_API_ID && secrets.TELEGRAM_API_HASH && secrets.TELEGRAM_SESSION) {
    const session = convertPyrogramToGramJS(secrets.TELEGRAM_SESSION);
    if (!session) {
      console.error('[Secrets] Failed to convert Pyrogram session to GramJS format');
      return null;
    }
    
    return {
      apiId: parseInt(secrets.TELEGRAM_API_ID, 10),
      apiHash: secrets.TELEGRAM_API_HASH,
      session,
    };
  }

  // Fallback to env vars (for development without secrets.enc)
  const apiId = process.env.TG_API_ID;
  const apiHash = process.env.TG_API_HASH;
  let session = process.env.TG_STRING_SESSION;

  if (apiId && apiHash && session) {
    const converted = convertPyrogramToGramJS(session);
    if (converted) {
      session = converted;
    }
    
    return {
      apiId: parseInt(apiId, 10),
      apiHash: apiHash,
      session,
    };
  }

  return null;
}

/**
 * Convert Pyrogram StringSession to GramJS StringSession format
 * 
 * Pyrogram format (271 bytes):
 * - dc_id: 1 byte
 * - api_id: 4 bytes (little-endian)
 * - test_mode: 1 byte
 * - auth_key: 256 bytes
 * - user_id: 8 bytes (little-endian)
 * - is_bot: 1 byte
 * 
 * GramJS format (263 bytes for IPv4):
 * - dc_id: 1 byte
 * - ip: 4 bytes (IPv4)
 * - port: 2 bytes (big-endian)
 * - auth_key: 256 bytes
 */
function convertPyrogramToGramJS(pyrogramSession: string): string | null {
  try {
    // Decode base64url
    let session = pyrogramSession;
    
    // Remove version prefix if present
    if (session[0] === '1') {
      session = session.slice(1);
    }
    
    // Ensure proper padding
    const padding = 4 - (session.length % 4);
    if (padding !== 4 && padding !== 0) {
      session += '='.repeat(padding);
    }
    
    // Convert base64url to standard base64
    session = session.replace(/-/g, '+').replace(/_/g, '/');
    
    const raw = Buffer.from(session, 'base64');
    
    // Check if this is Pyrogram format (271 bytes)
    if (raw.length !== 271) {
      // Not Pyrogram format, check if it's already GramJS
      if (raw.length === 263 || raw.length === 275) {
        // Already GramJS format, add version prefix
        return '1' + pyrogramSession;
      }
      console.warn(`[Secrets] Unknown session format, length: ${raw.length}`);
      return null;
    }
    
    // Parse Pyrogram format
    const dcId = raw[0];
    // Skip api_id (4 bytes) and test_mode (1 byte)
    const authKey = raw.subarray(6, 262);
    
    // DC to IP mapping for Telegram production servers
    const dcIpMap: Record<number, { ip: string; port: number }> = {
      1: { ip: '149.154.175.53', port: 443 },
      2: { ip: '149.154.167.50', port: 443 },
      3: { ip: '149.154.175.100', port: 443 },
      4: { ip: '149.154.167.92', port: 443 },
      5: { ip: '91.108.56.130', port: 443 },
    };
    
    const dc = dcIpMap[dcId];
    if (!dc) {
      console.error(`[Secrets] Unknown DC ID: ${dcId}`);
      return null;
    }
    
    // Build GramJS format
    const ipParts = dc.ip.split('.').map(p => parseInt(p, 10));
    const ipBuffer = Buffer.from(ipParts);
    const portBuffer = Buffer.alloc(2);
    portBuffer.writeInt16BE(dc.port, 0);
    
    const gramjsData = Buffer.concat([
      Buffer.from([dcId]),
      ipBuffer,
      portBuffer,
      authKey,
    ]);
    
    // Encode and add version prefix
    const gramjsSession = '1' + gramjsData.toString('base64');
    
    console.log(`[Secrets] Converted Pyrogram session (DC ${dcId}) to GramJS format`);
    return gramjsSession;
  } catch (err: any) {
    console.error('[Secrets] Session conversion error:', err?.message || err);
    return null;
  }
}

/**
 * Clear cached secrets (for testing)
 */
export function clearSecretsCache(): void {
  cachedSecrets = null;
}
