import { esc } from '../../utils/esc.js';
import * as v from './validator.js';

export function renderMemoryRow(m) {
  return `<tr data-label="${esc(m.label)}"><td>${esc(m.label)}</td><td>${m.count}</td><td>${m.max_memories}</td><td>${m.ttl_hours}</td><td>${m.max_value_size}</td><td><button data-action="delete" data-label="${esc(m.label)}" class="sm danger">Delete</button></td></tr>`;
}

async function handleCreateMemory(data, apiClient, callbacks) {
  const errors = v.validateMemoryForm(data);
  if (errors.length) { v.displayErrors('form-errors', errors); return; }
  v.clearErrors('form-errors');
  try {
    const mem = await apiClient.createMemory(data);
    const tbody = document.querySelector('#memories-list');
    if (tbody) tbody.insertAdjacentHTML('afterbegin', renderMemoryRow(mem));
    document.getElementById('memory-form')?.reset();
    callbacks.onSuccess('Memory config created');
  } catch (e) {
    callbacks.onError(e.message);
  }
}

async function handleDeleteMemory(label, apiClient, callbacks) {
  if (!window.confirm(`Delete memory config "${label}"?`)) return;
  try {
    await apiClient.deleteMemory(label);
    document.querySelector(`tr[data-label="${esc(label)}"]`)?.remove();
    callbacks.onSuccess('Memory config deleted');
  } catch (e) {
    callbacks.onError(e.message);
  }
}

export function initMemories(apiClient, callbacks) {
  const card = Array.from(document.querySelectorAll('.card')).find(
    c => c.querySelector('.card-header')?.textContent?.includes('Memory')
  );
  if (!card) return;

  const form = document.getElementById('memory-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        label: form.querySelector('#label')?.value,
        max_memories: parseInt(form.querySelector('#max_memories')?.value || '20'),
        ttl_hours: parseInt(form.querySelector('#ttl_hours')?.value || '720'),
        max_value_size: parseInt(form.querySelector('#max_value_size')?.value || '2000'),
      };
      if (data.label) await handleCreateMemory(data, apiClient, callbacks);
    });
  }

  card.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (btn?.dataset.label) { e.preventDefault(); handleDeleteMemory(btn.dataset.label, apiClient, callbacks); }
  });
}
