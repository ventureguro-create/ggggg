/**
 * Minimal Server - Connections + Admin Auth only
 */

import 'dotenv/config';
import { buildMinimalApp } from './app-minimal.js';
import { connectMongo, disconnectMongo } from './db/mongoose.js';
import { env } from './config/env.js';
import { startTelegramPolling, stopTelegramPolling } from './telegram-polling.worker.js';

async function main(): Promise<void> {
  console.log('[Server] Starting FOMO Backend (Minimal Mode)...');
  
  // Connect to MongoDB
  console.log('[Server] Connecting to MongoDB...');
  await connectMongo();

  // Build minimal Fastify app
  const app = buildMinimalApp();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}, shutting down...`);
    stopTelegramPolling();
    await app.close();
    await disconnectMongo();
    console.log('[Server] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start server
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`[Server] ✓ Backend started on port ${env.PORT}`);
    console.log(`[Server] Mode: MINIMAL (Connections + Admin only)`);
    console.log(`[Server] Environment: ${env.NODE_ENV}`);
    
    // Start Telegram polling for bot commands
    startTelegramPolling().catch(err => {
      console.error('[Server] Telegram polling error:', err);
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});
