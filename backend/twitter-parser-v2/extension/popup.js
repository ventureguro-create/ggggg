// Popup script

const statusEl = document.getElementById('status');
const infoEl = document.getElementById('info');
const sessionIdEl = document.getElementById('sessionId');
const serverUrlEl = document.getElementById('serverUrl');
const syncBtn = document.getElementById('syncBtn');
const saveBtn = document.getElementById('saveBtn');

// Загрузить статус
async function loadStatus() {
  chrome.runtime.sendMessage({ action: 'getStatus' }, (data) => {
    if (data) {
      sessionIdEl.value = data.sessionId || '';
      serverUrlEl.value = data.serverUrl || 'http://localhost:5001';
      
      if (data.lastSync) {
        const date = new Date(data.lastSync);
        const timeAgo = Math.round((Date.now() - data.lastSync) / 60000);
        
        if (data.lastSyncStatus === 'success') {
          statusEl.className = 'status success';
          statusEl.textContent = `✅ Synced ${data.cookiesCount} cookies (${timeAgo} min ago)`;
        } else {
          statusEl.className = 'status error';
          statusEl.textContent = `❌ Sync failed (${timeAgo} min ago)`;
        }
        
        infoEl.textContent = `Last sync: ${date.toLocaleString()}`;
      } else {
        statusEl.className = 'status pending';
        statusEl.textContent = '⏳ Not synced yet';
      }
    }
  });
}

// Синхронизировать сейчас
syncBtn.addEventListener('click', async () => {
  syncBtn.disabled = true;
  syncBtn.textContent = '⏳ Syncing...';
  
  chrome.runtime.sendMessage({ action: 'syncNow' }, (result) => {
    syncBtn.disabled = false;
    syncBtn.textContent = '🔄 Sync Now';
    
    if (result && result.success) {
      statusEl.className = 'status success';
      statusEl.textContent = `✅ Synced ${result.cookies} cookies`;
    } else {
      statusEl.className = 'status error';
      statusEl.textContent = `❌ ${result?.error || 'Sync failed'}`;
    }
  });
});

// Сохранить настройки
saveBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    sessionId: sessionIdEl.value,
    serverUrl: serverUrlEl.value
  });
  saveBtn.textContent = '✅ Saved!';
  setTimeout(() => { saveBtn.textContent = '💾 Save Settings'; }, 2000);
});

// Загрузить при открытии
loadStatus();
