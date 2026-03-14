/*
PRE-CODING QUESTIONS ANSWERS:
1. Status values from GET /whatsapp/status: "pending_qr", "connecting", "connected", "disconnected", "error"
2. WhatsApp status element: <span class="badge badge-{{ wa_status }}"> inside <div id="whatsapp-card">. QR SVG goes into <div class="qr-wrap">
3. Toggle button class in groups table: No toggle button - uses class="sm" for Save and class="sm danger" for Remove
4. Memory form fields: label, max_memories, ttl_hours, max_value_size (from MemoryConfigRequestEnhanced)
5. Memories table columns: Memory Label, Entry Count, Max Memories, TTL (hours), Max Value Size, Actions
6. action-banner: Does not exist in templates yet - Phase 3 adds it, so showBanner handles null case
*/

import * as apiClient from './modules/integrations/api-client.js';
import { initWhatsApp } from './modules/integrations/whatsapp-section.js';
import { initCalendars } from './modules/integrations/calendars-section.js';
import { initMemories } from './modules/integrations/memories-section.js';

export function initializeIntegrationsPage() {
  const banner = document.getElementById('action-banner');
  const callbacks = {
    onSuccess: (msg) => showBanner(banner, msg, 'success'),
    onError: (msg) => showBanner(banner, msg, 'error'),
  };
  initWhatsApp(apiClient, callbacks);
  initCalendars(apiClient, callbacks);
}

export function initializeMemoriesPage() {
  const banner = document.getElementById('action-banner');
  const callbacks = {
    onSuccess: (msg) => showBanner(banner, msg, 'success'),
    onError: (msg) => showBanner(banner, msg, 'error'),
  };
  initMemories(apiClient, callbacks);
}

function showBanner(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = `save-banner ${type === 'error' ? 'error' : ''}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}
