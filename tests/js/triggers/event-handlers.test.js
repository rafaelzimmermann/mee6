import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { handleTypeChange, handleAdd, handleToggle, handleRunNow, handleDelete } from '/mee6/web/static/js/modules/triggers/event-handlers.js';

describe('triggers/event-handlers', () => {
  describe('handleTypeChange', () => {
    let dom, cronField, whatsappField, waGroupField;

    beforeEach(() => {
      dom = new JSDOM(`
        <!DOCTYPE html>
        <html><body>
          <span id="field-cron"><input type="text" name="cron_expr"></span>
          <span id="field-whatsapp" class="hidden"><input type="tel" name="phone"></span>
          <span id="field-wa-group" class="hidden"><select name="group_jid"></select></span>
        </body></html>
      `);
      global.document = dom.window.document;
      cronField = document.getElementById('field-cron');
      whatsappField = document.getElementById('field-whatsapp');
      waGroupField = document.getElementById('field-wa-group');
    });

    it('shows cron field, hides others, sets cron_expr required', () => {
      handleTypeChange('cron', { cron: cronField, whatsapp: whatsappField, waGroup: waGroupField });

      expect(cronField.classList.contains('hidden')).toBe(false);
      expect(whatsappField.classList.contains('hidden')).toBe(true);
      expect(waGroupField.classList.contains('hidden')).toBe(true);
      expect(cronField.querySelector('input').required).toBe(true);
      expect(whatsappField.querySelector('input').required).toBe(false);
      expect(waGroupField.querySelector('select').required).toBe(false);
    });

    it('shows whatsapp field, hides others, sets phone required', () => {
      handleTypeChange('whatsapp', { cron: cronField, whatsapp: whatsappField, waGroup: waGroupField });

      expect(cronField.classList.contains('hidden')).toBe(true);
      expect(whatsappField.classList.contains('hidden')).toBe(false);
      expect(waGroupField.classList.contains('hidden')).toBe(true);
      expect(cronField.querySelector('input').required).toBe(false);
      expect(whatsappField.querySelector('input').required).toBe(true);
      expect(waGroupField.querySelector('select').required).toBe(false);
    });

    it('shows wa_group field, hides others, sets group_jid required', () => {
      handleTypeChange('wa_group', { cron: cronField, whatsapp: whatsappField, waGroup: waGroupField });

      expect(cronField.classList.contains('hidden')).toBe(true);
      expect(whatsappField.classList.contains('hidden')).toBe(true);
      expect(waGroupField.classList.contains('hidden')).toBe(false);
      expect(cronField.querySelector('input').required).toBe(false);
      expect(whatsappField.querySelector('input').required).toBe(false);
      expect(waGroupField.querySelector('select').required).toBe(true);
    });

    it('removes required from hidden fields', () => {
      handleTypeChange('cron', { cron: cronField, whatsapp: whatsappField, waGroup: waGroupField });

      expect(cronField.querySelector('input').required).toBe(true);
      expect(whatsappField.querySelector('input').required).toBe(false);
      expect(waGroupField.querySelector('select').required).toBe(false);
    });
  });

  describe('handleAdd', () => {
    let mockApiClient;

    beforeEach(() => {
      mockApiClient = {
        createTrigger: vi.fn().mockResolvedValue({ id: 'job-1', pipeline_name: 'Test' }),
      };
      vi.clearAllMocks();
    });

    it('returns error without calling apiClient when validation fails', async () => {
      const result = await handleAdd({ pipeline_id: '', trigger_type: 'cron' }, mockApiClient);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('pipeline_id');
      expect(mockApiClient.createTrigger).not.toHaveBeenCalled();
    });

    it('calls apiClient.createTrigger with correct payload for cron type', async () => {
      const formData = {
        pipeline_id: 'pipe-1',
        trigger_type: 'cron',
        cron_expr: '0 9 * * *',
        phone: '',
        group_jid: '',
        enabled: true,
      };

      await handleAdd(formData, mockApiClient);

      expect(mockApiClient.createTrigger).toHaveBeenCalledWith(formData);
    });

    it('calls apiClient.createTrigger with correct payload for whatsapp type', async () => {
      const formData = {
        pipeline_id: 'pipe-1',
        trigger_type: 'whatsapp',
        cron_expr: '',
        phone: '+1234567890',
        group_jid: '',
        enabled: false,
      };

      await handleAdd(formData, mockApiClient);

      expect(mockApiClient.createTrigger).toHaveBeenCalledWith(formData);
    });

    it('calls apiClient.createTrigger with correct payload for wa_group type', async () => {
      const formData = {
        pipeline_id: 'pipe-1',
        trigger_type: 'wa_group',
        cron_expr: '',
        phone: '',
        group_jid: 'group-123@g.us',
        enabled: true,
      };

      await handleAdd(formData, mockApiClient);

      expect(mockApiClient.createTrigger).toHaveBeenCalledWith(formData);
    });

    it('returns { ok: true, trigger } on API success', async () => {
      const result = await handleAdd({ pipeline_id: 'pipe-1', trigger_type: 'cron', cron_expr: '0 9 * * *', enabled: false }, mockApiClient);

      expect(result.ok).toBe(true);
      expect(result.trigger).toEqual({ id: 'job-1', pipeline_name: 'Test' });
    });

    it('returns { ok: false, error } on API failure', async () => {
      mockApiClient.createTrigger.mockRejectedValue(new Error('API error'));

      const result = await handleAdd({ pipeline_id: 'pipe-1', trigger_type: 'cron', cron_expr: '0 9 * * *', enabled: false }, mockApiClient);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('API error');
    });
  });

  describe('handleToggle', () => {
    let mockApiClient;

    beforeEach(() => {
      mockApiClient = {
        toggleTrigger: vi.fn().mockResolvedValue({ id: 'job-1', enabled: true }),
      };
      vi.clearAllMocks();
    });

    it('calls apiClient.toggleTrigger with correct id', async () => {
      await handleToggle('job-1', mockApiClient);

      expect(mockApiClient.toggleTrigger).toHaveBeenCalledWith('job-1');
    });

    it('returns { ok: true, enabled } on success', async () => {
      const result = await handleToggle('job-1', mockApiClient);

      expect(result.ok).toBe(true);
      expect(result.enabled).toBe(true);
    });

    it('returns { ok: false, error } on API failure', async () => {
      mockApiClient.toggleTrigger.mockRejectedValue(new Error('Toggle failed'));

      const result = await handleToggle('job-1', mockApiClient);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Toggle failed');
    });
  });

  describe('handleRunNow', () => {
    let mockApiClient;

    beforeEach(() => {
      mockApiClient = {
        runNow: vi.fn().mockResolvedValue({ ok: true }),
      };
      vi.clearAllMocks();
    });

    it('calls apiClient.runNow with correct id', async () => {
      await handleRunNow('job-1', mockApiClient);

      expect(mockApiClient.runNow).toHaveBeenCalledWith('job-1');
    });

    it('returns { ok: true } on success', async () => {
      const result = await handleRunNow('job-1', mockApiClient);

      expect(result.ok).toBe(true);
    });
  });

  describe('handleDelete', () => {
    let mockApiClient;

    beforeEach(() => {
      mockApiClient = {
        deleteTrigger: vi.fn().mockResolvedValue(undefined),
      };
      vi.clearAllMocks();
    });

    it('calls apiClient.deleteTrigger with correct id', async () => {
      await handleDelete('job-1', mockApiClient);

      expect(mockApiClient.deleteTrigger).toHaveBeenCalledWith('job-1');
    });

    it('returns { ok: true } on success', async () => {
      const result = await handleDelete('job-1', mockApiClient);

      expect(result.ok).toBe(true);
    });

    it('returns { ok: false, error } on API failure', async () => {
      mockApiClient.deleteTrigger.mockRejectedValue(new Error('Delete failed'));

      const result = await handleDelete('job-1', mockApiClient);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });
});
