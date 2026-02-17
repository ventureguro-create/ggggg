/**
 * Telegram Polling Worker (TEMPORARY FIX)
 * 
 * This is a workaround for Kubernetes Ingress issue
 * Uses polling instead of webhook until infrastructure is fixed
 * 
 * TEMPORARY - Remove when ingress routing for /api/* is fixed
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
const POLL_INTERVAL = 1000; // 1 second

let offset = 0;
let isPolling = false;

/**
 * Process incoming update (same logic as webhook handler)
 */
async function processUpdate(update: any) {
  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id.toString();
  const text = message.text || '';
  const username = message.from?.username;
  const firstName = message.from?.first_name;

  console.log(`[TG Polling] Incoming update from chatId: ${chatId}, text: "${text}"`);

  try {
    // Import telegram service dynamically
    const telegramService = await import('./core/notifications/telegram.service.js');

    // Handle /start with link_<token> (P1 Deep-Link Flow)
    if (text.startsWith('/start link_')) {
      const token = text.replace('/start link_', '').trim();
      
      // Find pending connection by token
      const pendingConnection = await telegramService.TelegramConnectionModel.findOne({
        pendingLinkToken: token,
        pendingLinkExpires: { $gt: new Date() }
      });

      if (pendingConnection?.userId) {
        // Complete the connection
        await telegramService.TelegramConnectionModel.updateOne(
          { userId: pendingConnection.userId },
          {
            $set: {
              chatId,
              username,
              firstName,
              isActive: true,
              connectedAt: new Date(),
            },
            $unset: {
              pendingLinkToken: 1,
              pendingLinkExpires: 1
            }
          }
        );
        
        await telegramService.sendTelegramMessage(
          chatId,
          `✅ <b>Telegram connected successfully!</b>

You will now receive notifications about your Twitter session status.

🔔 <b>Notification Types:</b>
• Session restored (🟢)
• Session stale (🟠)  
• Session invalid (🔴)
• Parse completed/aborted

You can configure notifications in the Settings section on the website.

Commands: /status /disconnect /help`,
          { parseMode: 'HTML' }
        );
        
        console.log(`[TG Polling] Successfully linked user ${pendingConnection.userId} to chatId ${chatId}`);
      } else {
        await telegramService.sendTelegramMessage(
          chatId,
          `❌ <b>Invalid or expired link</b>

Please get a new link from the website and try again.

Or type /start for instructions.`,
          { parseMode: 'HTML' }
        );
      }
    }
    // Handle /start with old code format (backwards compatibility)
    else if (text.startsWith('/start ')) {
      const code = text.replace('/start ', '').trim();
      const connection = await telegramService.TelegramConnectionModel.findOne({ code });

      if (connection?.userId) {
        await telegramService.saveTelegramConnection(
          connection.userId,
          chatId,
          username,
          firstName
        );
        await telegramService.sendTelegramMessage(
          chatId,
          `✅ <b>Telegram connected successfully</b>

You'll now receive alerts here when your monitored tokens or wallets show important activity.

ℹ️ <b>What happens next:</b>
• Create alert rules on the website
• I'll notify you when conditions are met
• You can mute or adjust alerts anytime

Type /help for available commands.`,
          { parseMode: 'HTML' }
        );
      } else {
        await telegramService.sendTelegramMessage(
          chatId,
          `❌ <b>Invalid connection code</b>

Please get a new connection link from the website and try again.

Or type /start for more information.`,
          { parseMode: 'HTML' }
        );
      }
    }
    // Handle plain /start - register for alerts
    else if (text === '/start') {
      // Create/update connection for this chatId
      // This enables user to receive alerts immediately
      await telegramService.TelegramConnectionModel.updateOne(
        { chatId },
        {
          $set: {
            chatId,
            username,
            firstName,
            isActive: true,
            connectedAt: new Date(),
          },
          $setOnInsert: {
            userId: `tg_${chatId}`, // Auto-generate userId for direct bot users
          }
        },
        { upsert: true }
      );
      
      await telegramService.sendTelegramMessage(
        chatId,
        `👋 <b>Welcome to FOMO Alerts</b>

You're now subscribed to receive alerts:

<b>📊 Connections (Influencer)</b>
• 🚀 Early Breakout signals
• 📈 Strong Acceleration  
• 🔄 Trend Changes

<b>🐦 Twitter / Parser</b>
• Session status alerts
• Parse completion/abort

<b>Commands:</b>
/alerts - Manage all alert settings ⚙️
/connections off - Mute influencer alerts
/twitter off - Mute twitter alerts
/help - All commands

No spam — only valuable signals.`,
        { parseMode: 'HTML' }
      );
      
      console.log(`[TG Polling] Registered chatId ${chatId} for alerts`);
    }
    // Handle /link FOMO-XXXX (D1 Signals linking)
    else if (text.startsWith('/link ')) {
      const code = text.replace('/link ', '').trim();
      
      try {
        // Import D1 telegram link service
        const d1TelegramLink = await import('./core/d1_signals/d1_telegram_link.service.js');
        const userId = d1TelegramLink.validateLinkCode(code);
        
        if (userId) {
          // Save the link
          await d1TelegramLink.saveTelegramLink(userId, chatId);
          
          await telegramService.sendTelegramMessage(
            chatId,
            `✅ <b>Telegram successfully linked to your FOMO account.</b>

You will now receive high-severity structural alerts here.

• Only important signals (severity = HIGH)
• No spam, no trading advice
• Rule-based observations only

Type /status to check your connection anytime.`,
            { parseMode: 'HTML' }
          );
        } else {
          await telegramService.sendTelegramMessage(
            chatId,
            `❌ <b>Invalid or expired code</b>

The code "${code}" is not valid or has expired.

Please generate a new code from the Signals page and try again.`,
            { parseMode: 'HTML' }
          );
        }
      } catch (err) {
        console.error('[TG Polling] Link error:', err);
        await telegramService.sendTelegramMessage(
          chatId,
          `❌ <b>Link failed</b>

Something went wrong. Please try again later.`,
          { parseMode: 'HTML' }
        );
      }
    }
    // Handle /help
    else if (text === '/help') {
      await telegramService.sendTelegramMessage(
        chatId,
        `📖 <b>Available Commands</b>

<b>General:</b>
/start - Welcome & setup
/link FOMO-XXXX - Link account
/status - Connection status
/alerts - Manage all alerts ⚙️
/disconnect - Stop ALL alerts

<b>Quick toggles:</b>
/connections on|off - Influencer alerts
/twitter on|off - Twitter/Parser alerts

/help - This message

🌐 Full settings on the website.`,
        { parseMode: 'HTML' }
      );
    }
    // Handle /status
    else if (text === '/status') {
      // Check both old connections and D1 links
      const connection = await telegramService.TelegramConnectionModel.findOne({ chatId });
      
      let d1Link = null;
      try {
        const d1TelegramLink = await import('./core/d1_signals/d1_telegram_link.service.js');
        const links = await d1TelegramLink.TelegramLinkModel.find({ telegramChatId: chatId, isActive: true });
        d1Link = links.length > 0 ? links[0] : null;
      } catch (err) {
        // D1 link module not available
      }

      if (connection?.isActive || d1Link) {
        const linkedAt = d1Link?.linkedAt || connection?.connectedAt;
        await telegramService.sendTelegramMessage(
          chatId,
          `✅ <b>Connection Active</b>

Linked: ${linkedAt?.toLocaleDateString() || 'Unknown'}
You will receive high-severity structural alerts here.

Manage settings on the website.`,
          { parseMode: 'HTML' }
        );
      } else {
        await telegramService.sendTelegramMessage(
          chatId,
          `❌ <b>Not Connected</b>

To receive alerts:
1. Go to the Signals page
2. Click "Connect Telegram"
3. Use the code: /link FOMO-XXXX

Or type /start for more info.`,
          { parseMode: 'HTML' }
        );
      }
    }
    // Handle /disconnect
    else if (text === '/disconnect') {
      await telegramService.TelegramConnectionModel.updateOne(
        { chatId },
        { isActive: false }
      );
      
      // Also disconnect D1 links
      try {
        const d1TelegramLink = await import('./core/d1_signals/d1_telegram_link.service.js');
        await d1TelegramLink.TelegramLinkModel.updateMany(
          { telegramChatId: chatId },
          { isActive: false }
        );
      } catch (err) {
        // D1 link module not available
      }

      await telegramService.sendTelegramMessage(
        chatId,
        `👋 <b>Disconnected</b>

You will no longer receive alerts here. 

Type /start to reconnect anytime.`,
        { parseMode: 'HTML' }
      );
    }
    // Handle /connections - Show Connections alerts status
    else if (text === '/connections') {
      const connection = await telegramService.TelegramConnectionModel.findOne({ chatId });
      
      if (!connection?.isActive) {
        await telegramService.sendTelegramMessage(
          chatId,
          `❌ <b>Not Connected</b>

Link your account first to manage Connections alerts.
Type /start for instructions.`,
          { parseMode: 'HTML' }
        );
      } else {
        const prefs = connection.connectionsPreferences || { enabled: true, earlyBreakout: true, strongAcceleration: true, trendReversal: true };
        const status = prefs.enabled ? '🟢 ON' : '🔴 OFF';
        
        await telegramService.sendTelegramMessage(
          chatId,
          `📊 <b>Connections Alerts</b>

Status: ${status}

<b>Alert Types:</b>
• Early Breakout: ${prefs.earlyBreakout ? '✅' : '❌'}
• Strong Acceleration: ${prefs.strongAcceleration ? '✅' : '❌'}
• Trend Reversal: ${prefs.trendReversal ? '✅' : '❌'}

<b>Commands:</b>
/connections on - Enable all
/connections off - Disable all

Manage individual types on the website.`,
          { parseMode: 'HTML' }
        );
      }
    }
    // Handle /connections on - Enable Connections alerts
    else if (text === '/connections on') {
      const result = await telegramService.TelegramConnectionModel.updateOne(
        { chatId, isActive: true },
        { 
          $set: { 
            'connectionsPreferences.enabled': true,
            'connectionsPreferences.earlyBreakout': true,
            'connectionsPreferences.strongAcceleration': true,
            'connectionsPreferences.trendReversal': true,
          } 
        }
      );
      
      if (result.matchedCount === 0) {
        await telegramService.sendTelegramMessage(
          chatId,
          `❌ <b>Not Connected</b>

Link your account first. Type /start for instructions.`,
          { parseMode: 'HTML' }
        );
      } else {
        await telegramService.sendTelegramMessage(
          chatId,
          `✅ <b>Connections Alerts Enabled</b>

You will now receive influencer alerts:
• 🚀 Early Breakout
• 📈 Strong Acceleration
• 🔄 Trend Reversal

Type /connections off to disable.`,
          { parseMode: 'HTML' }
        );
      }
    }
    // Handle /connections off - Disable Connections alerts
    else if (text === '/connections off') {
      const result = await telegramService.TelegramConnectionModel.updateOne(
        { chatId, isActive: true },
        { $set: { 'connectionsPreferences.enabled': false } }
      );
      
      if (result.matchedCount === 0) {
        await telegramService.sendTelegramMessage(
          chatId,
          `❌ <b>Not Connected</b>

Link your account first. Type /start for instructions.`,
          { parseMode: 'HTML' }
        );
      } else {
        await telegramService.sendTelegramMessage(
          chatId,
          `🔇 <b>Connections Alerts Disabled</b>

You will no longer receive influencer alerts.

Type /connections on to re-enable anytime.`,
          { parseMode: 'HTML' }
        );
      }
    }
    // Handle /alerts - Unified alerts menu
    else if (text === '/alerts') {
      const connection = await telegramService.TelegramConnectionModel.findOne({ chatId });
      
      if (!connection?.isActive) {
        await telegramService.sendTelegramMessage(
          chatId,
          `❌ <b>Not Connected</b>

Link your account first to manage alerts.
Type /start for instructions.`,
          { parseMode: 'HTML' }
        );
      } else {
        const connPrefs = connection.connectionsPreferences || { enabled: true };
        const twitterPrefs = connection.eventPreferences || { 
          sessionOk: true, sessionStale: true, sessionInvalid: true,
          parseCompleted: false, parseAborted: true, cooldown: false, highRisk: false 
        };
        
        // Calculate Twitter status
        const twitterEnabled = twitterPrefs.sessionOk || twitterPrefs.sessionStale || 
                               twitterPrefs.sessionInvalid || twitterPrefs.parseAborted;
        
        await telegramService.sendTelegramMessage(
          chatId,
          `⚙️ <b>Alert Settings</b>

<b>📊 Connections (Influencer)</b>
Status: ${connPrefs.enabled ? '🟢 ON' : '🔴 OFF'}
• Early Breakout, Acceleration, Reversal
→ /connections on|off

<b>🐦 Twitter / Parser</b>
Status: ${twitterEnabled ? '🟢 ON' : '🔴 OFF'}
• Session alerts: ${twitterPrefs.sessionOk ? '✅' : '❌'}
• Parse alerts: ${twitterPrefs.parseAborted ? '✅' : '❌'}
→ /twitter on|off

<b>Quick actions:</b>
/connections off - Mute influencer alerts
/twitter off - Mute twitter alerts
/disconnect - Stop ALL alerts

🌐 Fine-tune settings on the website.`,
          { parseMode: 'HTML' }
        );
      }
    }
    // Handle /twitter - Show Twitter alerts status
    else if (text === '/twitter') {
      const connection = await telegramService.TelegramConnectionModel.findOne({ chatId });
      
      if (!connection?.isActive) {
        await telegramService.sendTelegramMessage(
          chatId,
          `❌ <b>Not Connected</b>

Link your account first. Type /start for instructions.`,
          { parseMode: 'HTML' }
        );
      } else {
        const prefs = connection.eventPreferences || { 
          sessionOk: true, sessionStale: true, sessionInvalid: true,
          parseCompleted: false, parseAborted: true, cooldown: false, highRisk: false 
        };
        
        await telegramService.sendTelegramMessage(
          chatId,
          `🐦 <b>Twitter / Parser Alerts</b>

<b>Session alerts:</b>
• Session OK: ${prefs.sessionOk ? '✅' : '❌'}
• Session Stale: ${prefs.sessionStale ? '✅' : '❌'}
• Session Invalid: ${prefs.sessionInvalid ? '✅' : '❌'}

<b>Parser alerts:</b>
• Parse Completed: ${prefs.parseCompleted ? '✅' : '❌'}
• Parse Aborted: ${prefs.parseAborted ? '✅' : '❌'}

<b>Other:</b>
• Cooldown: ${prefs.cooldown ? '✅' : '❌'}
• High Risk: ${prefs.highRisk ? '✅' : '❌'}

<b>Commands:</b>
/twitter on - Enable all
/twitter off - Disable all

🌐 Fine-tune on the website.`,
          { parseMode: 'HTML' }
        );
      }
    }
    // Handle /twitter on - Enable Twitter alerts
    else if (text === '/twitter on') {
      const result = await telegramService.TelegramConnectionModel.updateOne(
        { chatId, isActive: true },
        { 
          $set: { 
            'eventPreferences.sessionOk': true,
            'eventPreferences.sessionStale': true,
            'eventPreferences.sessionInvalid': true,
            'eventPreferences.parseAborted': true,
          } 
        }
      );
      
      if (result.matchedCount === 0) {
        await telegramService.sendTelegramMessage(
          chatId,
          `❌ <b>Not Connected</b>

Link your account first. Type /start for instructions.`,
          { parseMode: 'HTML' }
        );
      } else {
        await telegramService.sendTelegramMessage(
          chatId,
          `✅ <b>Twitter Alerts Enabled</b>

You will now receive:
• 🟢 Session status alerts
• ⚠️ Parse abort alerts

Type /twitter off to disable.`,
          { parseMode: 'HTML' }
        );
      }
    }
    // Handle /twitter off - Disable Twitter alerts
    else if (text === '/twitter off') {
      const result = await telegramService.TelegramConnectionModel.updateOne(
        { chatId, isActive: true },
        { 
          $set: { 
            'eventPreferences.sessionOk': false,
            'eventPreferences.sessionStale': false,
            'eventPreferences.sessionInvalid': false,
            'eventPreferences.parseCompleted': false,
            'eventPreferences.parseAborted': false,
            'eventPreferences.cooldown': false,
            'eventPreferences.highRisk': false,
          } 
        }
      );
      
      if (result.matchedCount === 0) {
        await telegramService.sendTelegramMessage(
          chatId,
          `❌ <b>Not Connected</b>

Link your account first. Type /start for instructions.`,
          { parseMode: 'HTML' }
        );
      } else {
        await telegramService.sendTelegramMessage(
          chatId,
          `🔇 <b>Twitter Alerts Disabled</b>

You will no longer receive Twitter/parser alerts.

Type /twitter on to re-enable anytime.`,
          { parseMode: 'HTML' }
        );
      }
    }
  } catch (error) {
    console.error('[TG Polling] Error processing update:', error);
  }
}

/**
 * Start polling for updates
 */
export async function startTelegramPolling() {
  if (isPolling) {
    console.log('[TG Polling] Already running');
    return;
  }

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[TG Polling] Bot token not configured');
    return;
  }

  isPolling = true;
  console.log('[TG Polling] Started (TEMPORARY FIX - uses polling instead of webhook)');

  while (isPolling) {
    try {
      const url = `${TELEGRAM_API_BASE}${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`;
      const response = await fetch(url);
      const data = await response.json() as { ok: boolean; result?: Array<{ update_id: number; message?: unknown }> };

      if (data.ok && data.result && data.result.length > 0) {
        for (const update of data.result) {
          await processUpdate(update);
          offset = update.update_id + 1;
        }
      }
    } catch (error) {
      console.error('[TG Polling] Error:', error);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s on error
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

/**
 * Stop polling
 */
export function stopTelegramPolling() {
  isPolling = false;
  console.log('[TG Polling] Stopped');
}
