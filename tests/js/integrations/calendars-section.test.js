import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as calendarsSection from '/mee6/web/static/js/modules/integrations/calendars-section.js';
import * as apiClient from '/mee6/web/static/js/modules/integrations/api-client.js';
import * as validator from '/mee6/web/static/js/modules/integrations/validator.js';

vi.mock('/mee6/web/static/js/modules/integrations/api-client.js', () => ({
  listCalendars: vi.fn(),
  createCalendar: vi.fn(),
  deleteCalendar: vi.fn(),
}));

vi.mock('/mee6/web/static/js/modules/integrations/validator.js', () => ({
  validateCalendarForm: vi.fn(),
  displayErrors: vi.fn(),
  clearErrors: vi.fn(),
}));

// Polyfill :has-text() pseudo-selector (Playwright-only, not supported in JSDOM)
let _origQS;

describe('integrations/calendars-section', () => {
  let callbacks;

  beforeAll(() => {
    _origQS = Document.prototype.querySelector;
    Document.prototype.querySelector = function(sel) {
      const m = sel.match(/^(.+):has-text\("([^"]+)"\)$/);
      if (m) {
        const [, base, text] = m;
        for (const el of this.querySelectorAll(base)) {
          if (el.textContent.includes(text)) return el;
        }
        return null;
      }
      return _origQS.call(this, sel);
    };
  });

  afterAll(() => {
    Document.prototype.querySelector = _origQS;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = { onSuccess: vi.fn(), onError: vi.fn() };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('initCalendars', () => {
    beforeEach(() => {
      document.body.innerHTML = `<div class="card"><div class="card-header">Google Calendar</div><div class="card-body"><form action="/integrations/calendars"><input type="text" name="label" id="label-input"><input type="text" name="calendar_id" id="calendar-input"><button type="submit">Add</button></form><table id="calendars-table"><tbody></tbody></table></div></div><div id="form-errors" style="display:none;"></div>`;
      calendarsSection.initCalendars(apiClient, callbacks);
    });

    it('does nothing when label is empty', async () => {
      // The module guards with `if (label && calendarId)` — no API call and no validation when label is empty
      const form = document.querySelector('form[action*="/calendars"]');
      document.getElementById('label-input').value = '';
      document.getElementById('calendar-input').value = 'cal1';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.createCalendar).not.toHaveBeenCalled();
      expect(validator.validateCalendarForm).not.toHaveBeenCalled();
    });

    it('calls createCalendar with correct args', async () => {
      validator.validateCalendarForm.mockReturnValue([]);
      apiClient.createCalendar.mockResolvedValue({ id: '1', label: 'Work', calendar_id: 'cal1' });
      const form = document.querySelector('form[action*="/calendars"]');
      document.getElementById('label-input').value = 'Work';
      document.getElementById('calendar-input').value = 'cal1';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.createCalendar).toHaveBeenCalledWith('Work', 'cal1');
    });

    it('appends row on success', async () => {
      validator.validateCalendarForm.mockReturnValue([]);
      apiClient.createCalendar.mockResolvedValue({ id: '1', label: 'Work', calendar_id: 'cal1' });
      const form = document.querySelector('form[action*="/calendars"]');
      document.getElementById('label-input').value = 'Work';
      document.getElementById('calendar-input').value = 'cal1';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      const tbody = document.querySelector('#calendars-table tbody');
      expect(tbody.children.length).toBe(1);
      expect(tbody.children[0].dataset.calId).toBe('1');
    });

    it('clears errors and shows success on success', async () => {
      validator.validateCalendarForm.mockReturnValue([]);
      apiClient.createCalendar.mockResolvedValue({ id: '1', label: 'Work', calendar_id: 'cal1' });
      const form = document.querySelector('form[action*="/calendars"]');
      document.getElementById('label-input').value = 'Work';
      document.getElementById('calendar-input').value = 'cal1';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      expect(validator.clearErrors).toHaveBeenCalledWith('form-errors');
      expect(callbacks.onSuccess).toHaveBeenCalledWith('Calendar added');
    });

    it('calls onError on API failure', async () => {
      validator.validateCalendarForm.mockReturnValue([]);
      apiClient.createCalendar.mockRejectedValue(new Error('API Error'));
      const form = document.querySelector('form[action*="/calendars"]');
      document.getElementById('label-input').value = 'Work';
      document.getElementById('calendar-input').value = 'cal1';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      expect(callbacks.onError).toHaveBeenCalledWith('API Error');
    });

    it('calls deleteCalendar after confirm', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      apiClient.deleteCalendar.mockResolvedValue();
      document.body.innerHTML = `<div class="card"><div class="card-header">Google Calendar</div><div class="card-body"><form action="/integrations/calendars"><input type="text" name="label"><input type="text" name="calendar_id"><button>Add</button></form><table id="calendars-table"><tbody><tr data-cal-id="1"><td>Work</td><td><code>cal1</code></td><td><button data-action="delete" data-cal-id="1" class="sm danger">Remove</button></td></tr></tbody></table></div></div>`;
      calendarsSection.initCalendars(apiClient, callbacks);
      document.querySelector('[data-action="delete"]').click();
      await new Promise(r => setTimeout(r, 10));
      expect(window.confirm).toHaveBeenCalledWith('Delete this calendar?');
      expect(apiClient.deleteCalendar).toHaveBeenCalledWith('1');
    });

    it('removes row on success', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      apiClient.deleteCalendar.mockResolvedValue();
      document.body.innerHTML = `<div class="card"><div class="card-header">Google Calendar</div><div class="card-body"><form action="/integrations/calendars"><input type="text" name="label"><input type="text" name="calendar_id"><button>Add</button></form><table id="calendars-table"><tbody><tr data-cal-id="1"><td>Work</td><td><code>cal1</code></td><td><button data-action="delete" data-cal-id="1" class="sm danger">Remove</button></td></tr></tbody></table></div></div>`;
      calendarsSection.initCalendars(apiClient, callbacks);
      document.querySelector('[data-action="delete"]').click();
      await new Promise(r => setTimeout(r, 10));
      expect(document.querySelector('tr[data-cal-id="1"]')).toBeNull();
      expect(callbacks.onSuccess).toHaveBeenCalledWith('Calendar deleted');
    });

    it('does nothing when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      apiClient.deleteCalendar.mockResolvedValue();
      document.body.innerHTML = `<div class="card"><div class="card-header">Google Calendar</div><div class="card-body"><form action="/integrations/calendars"><input type="text" name="label"><input type="text" name="calendar_id"><button>Add</button></form><table id="calendars-table"><tbody><tr data-cal-id="1"><td>Work</td><td><code>cal1</code></td><td><button data-action="delete" data-cal-id="1" class="sm danger">Remove</button></td></tr></tbody></table></div></div>`;
      calendarsSection.initCalendars(apiClient, callbacks);
      document.querySelector('[data-action="delete"]').click();
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.deleteCalendar).not.toHaveBeenCalled();
    });

    it('calls onError on API failure', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      apiClient.deleteCalendar.mockRejectedValue(new Error('Delete failed'));
      document.body.innerHTML = `<div class="card"><div class="card-header">Google Calendar</div><div class="card-body"><form action="/integrations/calendars"><input type="text" name="label"><input type="text" name="calendar_id"><button>Add</button></form><table id="calendars-table"><tbody><tr data-cal-id="1"><td>Work</td><td><code>cal1</code></td><td><button data-action="delete" data-cal-id="1" class="sm danger">Remove</button></td></tr></tbody></table></div></div>`;
      calendarsSection.initCalendars(apiClient, callbacks);
      document.querySelector('[data-action="delete"]').click();
      await new Promise(r => setTimeout(r, 10));
      expect(callbacks.onError).toHaveBeenCalledWith('Delete failed');
    });
  });

  describe('renderCalendarRow', () => {
    it('escapes HTML in label', () => {
      const row = calendarsSection.renderCalendarRow({ id: '1', label: '<script>alert("xss")</script>', calendar_id: 'cal1' });
      expect(row).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('escapes HTML in calendar_id', () => {
      const row = calendarsSection.renderCalendarRow({ id: '1', label: 'Work', calendar_id: '<script>alert("xss")</script>' });
      expect(row).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('includes data-cal-id attribute', () => {
      const row = calendarsSection.renderCalendarRow({ id: '1', label: 'Work', calendar_id: 'cal1' });
      expect(row).toContain('data-cal-id="1"');
    });

    it('includes delete button with correct data attribute', () => {
      const row = calendarsSection.renderCalendarRow({ id: '1', label: 'Work', calendar_id: 'cal1' });
      expect(row).toContain('data-action="delete"');
      expect(row).toContain('data-cal-id="1"');
    });
  });
});
