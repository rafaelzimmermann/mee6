import * as apiClient from './modules/triggers/api-client.js';
import { handleTypeChange } from './modules/triggers/event-handlers.js';
import { setupEventDelegation } from './modules/triggers/event-delegation.js';
import { esc } from './utils/esc.js';

function getTypeText(t) {
  return t === 'whatsapp' ? 'WhatsApp DM' : t === 'wa_group' ? 'WhatsApp Group' : 'Cron';
}

function getScheduleText(t) {
  return t.trigger_type === 'whatsapp' ? esc(t.config.phone || '')
    : t.trigger_type === 'wa_group' ? esc(t.config.group_jid || '')
    : esc(t.cron_expr || '');
}

function renderTriggerRow(t) {
  const cls = t.enabled ? 'on' : '';
  const ttl = t.enabled ? 'Disable' : 'Enable';
  return `<tr data-trigger-id="${esc(t.id)}">
    <td>${esc(t.pipeline_name)}</td><td>${getTypeText(t.trigger_type)}</td>
    <td>${getScheduleText(t)}</td>
    <td><div class="row-actions">
      <button data-action="toggle" data-trigger-id="${esc(t.id)}" class="toggle ${cls}" title="${ttl}"></button>
      <button data-action="run-now" data-trigger-id="${esc(t.id)}" class="sm">Run now</button>
      <button data-action="delete" data-trigger-id="${esc(t.id)}" class="sm danger">Delete</button>
    </div></td></tr>`;
}

function showBanner(el, msg, type) {
  el.textContent = msg;
  el.className = type === 'success' ? 'save-banner' : 'validation-summary';
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

export function initializeTriggerEditor() {
  const container = document.getElementById('triggers-container');
  const form = document.getElementById('add-trigger-form');
  const saveBanner = document.getElementById('save-banner');
  const validationBanner = document.getElementById('validation-banner');

  if (!container || !form) return;

  const fields = {
    cron: document.getElementById('field-cron'),
    whatsapp: document.getElementById('field-whatsapp'),
    waGroup: document.getElementById('field-wa-group'),
  };

  handleTypeChange(form.querySelector('#trigger_type').value, fields);

  setupEventDelegation(container, form, apiClient, {
    onAdded: (t) => {
      const tbody = container.querySelector('tbody');
      tbody?.insertAdjacentHTML('afterbegin', renderTriggerRow(t));
      form.reset();
      handleTypeChange('cron', fields);
      if (saveBanner) showBanner(saveBanner, 'Trigger added successfully', 'success');
    },
    onToggled: (id, enabled) => {
      const btn = container.querySelector(`[data-action="toggle"][data-trigger-id="${id}"]`);
      if (btn) { btn.className = `toggle ${enabled ? 'on' : ''}`; btn.title = enabled ? 'Disable' : 'Enable'; }
    },
    onRan: () => { if (saveBanner) showBanner(saveBanner, 'Pipeline queued for execution', 'success'); },
    onDeleted: (id) => { container.querySelector(`tr[data-trigger-id="${id}"]`)?.remove(); },
    onError: (msg) => { if (validationBanner) showBanner(validationBanner, msg, 'error'); },
  });
}
