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
    return {
      apiId: parseInt(secrets.TELEGRAM_API_ID, 10),
      apiHash: secrets.TELEGRAM_API_HASH,
      session: secrets.TELEGRAM_SESSION,
    };
  }

  // Fallback to env vars (for development without secrets.enc)
  const apiId = process.env.TG_API_ID;
  const apiHash = process.env.TG_API_HASH;
  const session = process.env.TG_STRING_SESSION;

  if (apiId && apiHash && session) {
    return {
      apiId: parseInt(apiId, 10),
      apiHash: apiHash,
      session: session,
    };
  }

  return null;
}

/**
 * Clear cached secrets (for testing)
 */
export function clearSecretsCache(): void {
  cachedSecrets = null;
}
