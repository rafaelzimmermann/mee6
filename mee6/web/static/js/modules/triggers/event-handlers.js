import { validateTriggerForm } from './validator.js';

export function handleTypeChange(type, fields) {
  const { cron, whatsapp, waGroup } = fields;

  cron.classList.toggle('hidden', type !== 'cron');
  whatsapp.classList.toggle('hidden', type !== 'whatsapp');
  waGroup.classList.toggle('hidden', type !== 'wa_group');

  const cronInput = cron.querySelector('input');
  const phoneInput = whatsapp.querySelector('input');
  const groupInput = waGroup.querySelector('select');

  cronInput.required = type === 'cron';
  phoneInput.required = type === 'whatsapp';
  groupInput.required = type === 'wa_group';
}

export async function handleAdd(formData, apiClient) {
  const errors = validateTriggerForm(formData);
  if (errors.length > 0) {
    return { ok: false, error: errors[0] };
  }

  try {
    const result = await apiClient.createTrigger(formData);
    return { ok: true, trigger: result };
  } catch (err) {
    return { ok: false, error: err.message || 'Failed to create trigger' };
  }
}

export async function handleToggle(triggerId, apiClient) {
  try {
    const result = await apiClient.toggleTrigger(triggerId);
    return { ok: true, enabled: result.enabled };
  } catch (err) {
    return { ok: false, error: err.message || 'Failed to toggle trigger' };
  }
}

export async function handleRunNow(triggerId, apiClient) {
  try {
    await apiClient.runNow(triggerId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'Failed to run trigger' };
  }
}

export async function handleDelete(triggerId, apiClient) {
  try {
    await apiClient.deleteTrigger(triggerId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'Failed to delete trigger' };
  }
}
