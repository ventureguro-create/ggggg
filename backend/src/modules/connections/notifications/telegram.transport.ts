/**
 * Connections Telegram Transport
 * Phase 2.3: Uses port-based telegram integration
 * 
 * Uses existing bot token - bot is "dumb receiver", platform is "brain"
 * INTEGRATION: Uses ITelegramPort from ports
 */

import { sendTelegramMessage } from '../ports/port-access.js';

export interface TelegramTransportConfig {
  botToken: string;
}

export class TelegramTransport {
  private botToken: string;

  constructor(config: TelegramTransportConfig) {
    this.botToken = config.botToken;
  }

  /**
   * Send message to Telegram chat/channel
   * Uses port for platform telegram service for consistency
   */
  async sendMessage(chatId: string, text: string): Promise<any> {
    if (!chatId) {
      throw new Error('Telegram chat_id is missing');
    }

    // Use port-based telegram service
    const success = await sendTelegramMessage(chatId, text);
    
    if (!success) {
      throw new Error('Telegram send failed');
    }
    
    return { ok: true };
  }

  /**
   * Get bot info (for validation) - uses direct API
   */
  async getMe(): Promise<any> {
    if (!this.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is missing');
    }

    const url = `https://api.telegram.org/bot${this.botToken}/getMe`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to get bot info: ${response.status}`);
    }

    return response.json();
  }
}
