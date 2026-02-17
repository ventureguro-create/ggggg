// Background script - автоматическая синхронизация cookies

const SERVER_URL = 'http://localhost:5001'; // Изменить на свой сервер
const SYNC_INTERVAL_MINUTES = 30; // Каждые 30 минут

// Получить cookies Twitter
async function getTwitterCookies() {
  const cookies = await chrome.cookies.getAll({ domain: '.x.com' });
  const twitterCookies = await chrome.cookies.getAll({ domain: '.twitter.com' });
  return [...cookies, ...twitterCookies];
}

// Отправить cookies на сервер
async function syncCookies() {
  try {
    const cookies = await getTwitterCookies();
    
    if (cookies.length === 0) {
      console.log('[CookieSync] No Twitter cookies found');
      return { success: false, error: 'No cookies' };
    }

    // Получить настройки
    const { sessionId, serverUrl } = await chrome.storage.local.get(['sessionId', 'serverUrl']);
    const url = serverUrl || SERVER_URL;
    const id = sessionId || 'default';

    // Найти username из cookies
    const twidCookie = cookies.find(c => c.name === 'twid');
    let username = 'unknown';
    if (twidCookie) {
      // twid format: u%3D1234567890
      const match = twidCookie.value.match(/u%3D(\d+)/);
      if (match) username = `user_${match[1]}`;
    }

    // Форматировать cookies для Playwright
    const formattedCookies = cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : c.sameSite,
      expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined
    }));

    // Отправить на сервер
    const response = await fetch(`${url}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: id,
        username,
        cookies: formattedCookies
      })
    });

    const result = await response.json();
    
    // Сохранить время последней синхронизации
    await chrome.storage.local.set({ 
      lastSync: Date.now(),
      lastSyncStatus: result.ok ? 'success' : 'error',
      cookiesCount: cookies.length
    });

    console.log(`[CookieSync] Synced ${cookies.length} cookies:`, result);
    return { success: result.ok, cookies: cookies.length };

  } catch (error) {
    console.error('[CookieSync] Error:', error);
    await chrome.storage.local.set({ 
      lastSync: Date.now(),
      lastSyncStatus: 'error',
      lastError: error.message
    });
    return { success: false, error: error.message };
  }
}

// Слушать изменения cookies
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.cookie.domain.includes('x.com') || 
      changeInfo.cookie.domain.includes('twitter.com')) {
    // Debounce - не синхронизировать на каждое изменение
    chrome.alarms.create('syncCookies', { delayInMinutes: 0.5 });
  }
});

// Периодическая синхронизация
chrome.alarms.create('periodicSync', { periodInMinutes: SYNC_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncCookies' || alarm.name === 'periodicSync') {
    syncCookies();
  }
});

// Обработка сообщений от popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'syncNow') {
    syncCookies().then(sendResponse);
    return true; // async response
  }
  if (message.action === 'getStatus') {
    chrome.storage.local.get(['lastSync', 'lastSyncStatus', 'cookiesCount', 'sessionId', 'serverUrl'])
      .then(sendResponse);
    return true;
  }
});

// Синхронизировать при старте
chrome.runtime.onInstalled.addListener(() => {
  syncCookies();
});
