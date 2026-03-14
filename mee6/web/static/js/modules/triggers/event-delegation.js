import { handleTypeChange, handleAdd, handleToggle, handleRunNow, handleDelete } from './event-handlers.js';
import { displayErrors, clearErrors } from './validator.js';

let isSetup = false;
let boundHandlers = {};

function getFormData(form) {
  return {
    pipeline_id: form.querySelector('[name="pipeline_id"]').value,
    trigger_type: form.querySelector('[name="trigger_type"]').value,
    cron_expr: form.querySelector('[name="cron_expr"]')?.value ?? '',
    phone: form.querySelector('[name="phone"]')?.value ?? '',
    group_jid: form.querySelector('[name="group_jid"]')?.value ?? '',
    enabled: form.querySelector('[name="enabled"]').checked,
  };
}

export function setupEventDelegation(container, form, apiClient, callbacks) {
  if (isSetup) teardown();
  isSetup = true;

  const { onAdded, onToggled, onRan, onDeleted, onError } = callbacks;
  const fields = {
    cron: document.getElementById('field-cron'),
    whatsapp: document.getElementById('field-whatsapp'),
    waGroup: document.getElementById('field-wa-group'),
  };

  boundHandlers.submit = async (e) => {
    e.preventDefault();
    clearErrors();
    const formData = getFormData(form);
    const result = await handleAdd(formData, apiClient);
    result.ok ? onAdded(result.trigger) : onError(result.error);
  };

  boundHandlers.typeChange = (e) => handleTypeChange(e.target.value, fields);

  boundHandlers.click = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const { triggerId: id, action } = btn.dataset;

    if (action === 'toggle') {
      const r = await handleToggle(id, apiClient);
      r.ok ? onToggled(id, r.enabled) : onError(r.error);
    } else if (action === 'run-now') {
      const r = await handleRunNow(id, apiClient);
      r.ok ? onRan(id) : onError(r.error);
    } else if (action === 'delete') {
      if (!window.confirm('Delete this trigger?')) return;
      const r = await handleDelete(id, apiClient);
      r.ok ? onDeleted(id) : onError(r.error);
    }
  };

  form.addEventListener('submit', boundHandlers.submit);
  form.querySelector('#trigger_type').addEventListener('change', boundHandlers.typeChange);
  container.addEventListener('click', boundHandlers.click);
}

export function teardown() {
  if (!isSetup) return;

  const form = document.getElementById('add-trigger-form');
  const container = document.getElementById('triggers-container');

  form?.removeEventListener('submit', boundHandlers.submit);
  form?.querySelector('#trigger_type')?.removeEventListener('change', boundHandlers.typeChange);
  container?.removeEventListener('click', boundHandlers.click);

  boundHandlers = {};
  isSetup = false;
}
