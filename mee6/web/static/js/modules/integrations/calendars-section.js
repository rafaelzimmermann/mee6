import { esc } from '../../utils/esc.js';
import * as v from './validator.js';

export function renderCalendarRow(c) {
  return `<tr data-cal-id="${esc(c.id)}"><td>${esc(c.label)}</td><td><code>${esc(c.calendar_id)}</code></td><td><button data-action="delete" data-cal-id="${esc(c.id)}" class="sm danger">Remove</button></td></tr>`;
}

async function handleCreateCalendar(label, calendarId, apiClient, callbacks) {
  const errors = v.validateCalendarForm({ label, calendar_id: calendarId });
  if (errors.length) { v.displayErrors('form-errors', errors); return; }
  v.clearErrors('form-errors');
  try {
    const cal = await apiClient.createCalendar(label, calendarId);
    const tbody = document.querySelector('#calendars-table tbody');
    if (tbody) tbody.insertAdjacentHTML('beforeend', renderCalendarRow(cal));
    callbacks.onSuccess('Calendar added');
  } catch (e) {
    callbacks.onError(e.message);
  }
}

async function handleDeleteCalendar(id, apiClient, callbacks) {
  if (!window.confirm('Delete this calendar?')) return;
  try {
    await apiClient.deleteCalendar(id);
    document.querySelector(`tr[data-cal-id="${esc(id)}"]`)?.remove();
    callbacks.onSuccess('Calendar deleted');
  } catch (e) {
    callbacks.onError(e.message);
  }
}

export function initCalendars(apiClient, callbacks) {
  const card = document.querySelector('.card-header:has-text("Google Calendar")')?.closest('.card');
  if (!card) return;

  const form = card.querySelector('form[action*="/calendars"]');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = form.querySelector('input[name="label"]')?.value;
    const calendarId = form.querySelector('input[name="calendar_id"]')?.value;
    if (label && calendarId) {
      await handleCreateCalendar(label, calendarId, apiClient, callbacks);
      form.reset();
    }
  });

  card.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (btn?.dataset.calId) { e.preventDefault(); handleDeleteCalendar(btn.dataset.calId, apiClient, callbacks); }
  });
}
