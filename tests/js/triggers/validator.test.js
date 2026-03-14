import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { validateTriggerForm, displayErrors, clearErrors } from '/mee6/web/static/js/modules/triggers/validator.js';

describe('triggers/validator', () => {
  let container;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="form-errors" style="display:none"></div></body></html>');
    global.document = dom.window.document;
    container = document.getElementById('form-errors');
  });

  describe('validateTriggerForm', () => {
    it('returns error for empty pipeline_id', () => {
      const errors = validateTriggerForm({ pipeline_id: '', trigger_type: 'cron', cron_expr: '0 9 * * *' });
      expect(errors).toContain('pipeline_id is required');
    });

    it('returns error for whitespace-only pipeline_id', () => {
      const errors = validateTriggerForm({ pipeline_id: '   ', trigger_type: 'cron', cron_expr: '0 9 * * *' });
      expect(errors).toContain('pipeline_id is required');
    });

    it('returns error for cron type with empty cron_expr', () => {
      const errors = validateTriggerForm({ pipeline_id: 'pipe-1', trigger_type: 'cron', cron_expr: '' });
      expect(errors).toContain('cron_expr is required for cron type');
    });

    it('returns error for cron type with single-field cron expr', () => {
      const errors = validateTriggerForm({ pipeline_id: 'pipe-1', trigger_type: 'cron', cron_expr: 'daily' });
      expect(errors).toContain('cron_expr must have 5 fields separated by spaces');
    });

    it('returns no error for cron type with valid 5-field expr', () => {
      const errors = validateTriggerForm({ pipeline_id: 'pipe-1', trigger_type: 'cron', cron_expr: '0 9 * * *' });
      expect(errors).toEqual([]);
    });

    it('returns error for whatsapp type with empty phone', () => {
      const errors = validateTriggerForm({ pipeline_id: 'pipe-1', trigger_type: 'whatsapp', phone: '' });
      expect(errors).toContain('phone is required for whatsapp type');
    });

    it('returns no error for whatsapp type with non-empty phone', () => {
      const errors = validateTriggerForm({ pipeline_id: 'pipe-1', trigger_type: 'whatsapp', phone: '+1234567890' });
      expect(errors).toEqual([]);
    });

    it('returns error for wa_group type with empty group_jid', () => {
      const errors = validateTriggerForm({ pipeline_id: 'pipe-1', trigger_type: 'wa_group', group_jid: '' });
      expect(errors).toContain('group_jid is required for wa_group type');
    });

    it('returns no error for wa_group type with non-empty group_jid', () => {
      const errors = validateTriggerForm({ pipeline_id: 'pipe-1', trigger_type: 'wa_group', group_jid: 'group-123@g.us' });
      expect(errors).toEqual([]);
    });

    it('returns empty array when all fields valid', () => {
      const errors = validateTriggerForm({ pipeline_id: 'pipe-1', trigger_type: 'cron', cron_expr: '0 9 * * *' });
      expect(errors).toEqual([]);
    });

    it('returns multiple errors when multiple fields invalid', () => {
      const errors = validateTriggerForm({ pipeline_id: '', trigger_type: 'cron', cron_expr: '' });
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors.some(e => e.includes('pipeline_id'))).toBe(true);
      expect(errors.some(e => e.includes('cron_expr'))).toBe(true);
    });
  });

  describe('displayErrors / clearErrors', () => {
    it('displays errors in #form-errors list', () => {
      displayErrors(['Error 1', 'Error 2']);

      expect(container.style.display).toBe('block');
      const ul = container.querySelector('ul');
      expect(ul).toBeTruthy();
      const items = ul.querySelectorAll('li');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe('Error 1');
      expect(items[1].textContent).toBe('Error 2');
    });

    it('hides #form-errors when errors array is empty', () => {
      displayErrors(['Error 1']);
      expect(container.style.display).toBe('block');

      displayErrors([]);

      expect(container.style.display).toBe('none');
    });

    it('clearErrors hides and empties #form-errors', () => {
      displayErrors(['Error 1']);
      expect(container.style.display).toBe('block');

      clearErrors();

      expect(container.style.display).toBe('none');
      expect(container.innerHTML).toBe('');
    });
  });
});
