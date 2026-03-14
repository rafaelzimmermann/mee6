import { esc } from '../../utils/esc.js';

let pollInterval = null;

function startPolling(apiClient, callbacks) {
  if (pollInterval) return;
  pollInterval = setInterval(async () => {
    try {
      const s = await apiClient.getWhatsAppStatus();
      updateStatusUI(s);
      if (['connected', 'disconnected', 'error'].includes(s.status)) stopPolling();
    } catch {}
  }, 2000);
}

function stopPolling() { clearInterval(pollInterval); pollInterval = null; }

function updateStatusUI(s) {
  const card = document.getElementById('whatsapp-card');
  if (!card) return;
  const qrWrap = card.querySelector('.qr-wrap');
  const badge = card.querySelector('.badge');
  if (badge) badge.textContent = s.status;
  if (s.status === 'pending_qr' && qrWrap && s.qr_svg) qrWrap.innerHTML = s.qr_svg;
  else if (qrWrap) qrWrap.innerHTML = '';
}

async function handleConnect(apiClient, callbacks) {
  try { await apiClient.connectWhatsApp(); startPolling(apiClient, callbacks); } catch (e) { callbacks.onError(e.message); }
}

async function handleSavePhone(phone, apiClient, callbacks) {
  if (!phone?.trim()) return callbacks.onError('Phone number is required');
  try { await apiClient.setPhone(phone); callbacks.onSuccess('Phone number saved'); } catch (e) { callbacks.onError(e.message); }
}

async function handleSync(apiClient, callbacks) {
  try { const r = await apiClient.syncGroups(); callbacks.onSuccess(`Synced ${r.updated} groups`); } catch (e) { callbacks.onError(e.message); }
}

async function handleUpdateGroupLabel(jid, label, apiClient, callbacks) {
  try { await apiClient.updateGroupLabel(jid, label); callbacks.onSuccess('Group label updated'); } catch (e) { callbacks.onError(e.message); }
}

async function handleDeleteGroup(jid, apiClient, callbacks) {
  try { await apiClient.deleteGroup(jid); document.querySelector(`tr[data-jid="${esc(jid)}"]`)?.remove(); callbacks.onSuccess('Group removed'); } catch (e) { callbacks.onError(e.message); }
}

async function handleTestWhatsApp(phone, apiClient, callbacks) {
  if (!phone?.trim()) return callbacks.onError('Phone number is required');
  try { await apiClient.testWhatsApp(phone); callbacks.onSuccess('Test message sent'); } catch (e) { callbacks.onError(e.message.includes('503') || e.message.includes('not connected') ? 'WhatsApp is not connected' : e.message); }
}

export function initWhatsApp(apiClient, callbacks) {
  apiClient.getWhatsAppStatus().then(s => { updateStatusUI(s); if (['pending_qr', 'connecting'].includes(s.status)) startPolling(apiClient, callbacks); }).catch(() => {});

  const card = document.getElementById('whatsapp-card');
  if (!card) return;

  card.addEventListener('submit', async (e) => {
    const f = e.target.closest('form');
    if (!f) return;
    e.preventDefault();
    if (f.id === 'connect-btn-form') handleConnect(apiClient, callbacks);
    else if (f.id === 'phone-form') { const i = f.querySelector('input[name="phone"]'); if (i) handleSavePhone(i.value, apiClient, callbacks); }
    else if (f.id === 'test-form') { const i = f.querySelector('input[name="phone"]'); if (i) handleTestWhatsApp(i.value, apiClient, callbacks); }
  });

  card.addEventListener('click', async (e) => {
    if (e.target.id === 'sync-btn') {
      e.preventDefault();
      handleSync(apiClient, callbacks);
    }
  });

  card.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action="delete-group"]');
    if (b) { e.preventDefault(); const jid = b.dataset.jid; if (jid) handleDeleteGroup(jid, apiClient, callbacks); }
  });

  card.addEventListener('change', async (e) => {
    if (e.target.matches('input[type="text"].input-label')) {
      e.preventDefault();
      const jid = e.target.dataset.jid;
      if (jid) handleUpdateGroupLabel(jid, e.target.value, apiClient, callbacks);
    }
  });
}
