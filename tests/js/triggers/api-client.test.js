import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as apiClient from '/mee6/web/static/js/modules/triggers/api-client.js';

global.fetch = vi.fn();

describe('triggers/api-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTrigger', () => {
    it('sends POST to /api/v1/triggers with correct headers and body', async () => {
      const mockResponse = { ok: true, json: async () => ({ id: 'job-1', pipeline_name: 'Test' }) };
      global.fetch.mockResolvedValue(mockResponse);

      const data = {
        pipeline_id: 'pipe-1',
        trigger_type: 'cron',
        cron_expr: '0 9 * * *',
        enabled: false,
      };

      await apiClient.createTrigger(data);

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/triggers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    });

    it('returns parsed JSON on success', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ id: 'job-1', pipeline_name: 'Test', enabled: true }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      const result = await apiClient.createTrigger({ pipeline_id: 'pipe-1', trigger_type: 'cron', enabled: false });

      expect(result).toEqual({ id: 'job-1', pipeline_name: 'Test', enabled: true });
    });

    it('throws with detail message on non-OK response', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Invalid pipeline_id' }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      await expect(apiClient.createTrigger({ pipeline_id: '', trigger_type: 'cron' })).rejects.toThrow('Invalid pipeline_id');
    });

    it('throws with status code when no detail in response body', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: async () => ({}),
      };
      global.fetch.mockResolvedValue(mockResponse);

      await expect(apiClient.createTrigger({ pipeline_id: 'pipe-1', trigger_type: 'cron' })).rejects.toThrow('Request failed: 500');
    });
  });

  describe('toggleTrigger', () => {
    it('sends POST to /api/v1/triggers/{id}/toggle', async () => {
      const mockResponse = { ok: true, json: async () => ({ id: 'job-1', enabled: true }) };
      global.fetch.mockResolvedValue(mockResponse);

      await apiClient.toggleTrigger('job-1');

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/triggers/job-1/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('returns { id, enabled } on success', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ id: 'job-1', enabled: false }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      const result = await apiClient.toggleTrigger('job-1');

      expect(result).toEqual({ id: 'job-1', enabled: false });
    });
  });

  describe('runNow', () => {
    it('sends POST to /api/v1/triggers/{id}/run-now', async () => {
      const mockResponse = { ok: true, json: async () => ({ ok: true }) };
      global.fetch.mockResolvedValue(mockResponse);

      await apiClient.runNow('job-1');

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/triggers/job-1/run-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('returns { ok: true } on success', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ ok: true }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      const result = await apiClient.runNow('job-1');

      expect(result).toEqual({ ok: true });
    });
  });

  describe('deleteTrigger', () => {
    it('sends DELETE to /api/v1/triggers/{id}', async () => {
      const mockResponse = { ok: true, status: 204 };
      global.fetch.mockResolvedValue(mockResponse);

      await apiClient.deleteTrigger('job-1');

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/triggers/job-1', {
        method: 'DELETE',
      });
    });

    it('does not call res.json() on 204 response', async () => {
      const mockJson = vi.fn();
      const mockResponse = {
        ok: true,
        status: 204,
        json: mockJson,
      };
      global.fetch.mockResolvedValue(mockResponse);

      await apiClient.deleteTrigger('job-1');

      expect(mockJson).not.toHaveBeenCalled();
    });

    it('throws on non-204 error response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Trigger not found' }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      await expect(apiClient.deleteTrigger('job-1')).rejects.toThrow('Trigger not found');
    });
  });
});
