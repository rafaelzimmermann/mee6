import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { fetchSchemas, fetchPipeline, createPipeline, updatePipeline } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/api-client.js';

describe('API Client', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchSchemas()', () => {
    it('calls correct URL with correct method', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await fetchSchemas();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/agents/fields/batch', expect.anything());
      expect(mockFetch.mock.calls[0][1]).toEqual(expect.objectContaining({
        method: 'GET',
      }));
    });

    it('returns parsed JSON on success', async () => {
      const mockSchemas = { llm_agent: [{ name: 'prompt' }] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSchemas),
      });

      const result = await fetchSchemas();

      expect(result).toEqual(mockSchemas);
    });

    it('throws Error with status code on non-2xx response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error'),
      });

      await expect(fetchSchemas()).rejects.toThrow('Failed to fetch schemas: 500 Internal server error');
    });
  });

  describe('fetchPipeline(id)', () => {
    it('calls correct URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await fetchPipeline('test-id');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/pipelines/test-id', expect.anything());
      expect(mockFetch.mock.calls[0][1]).toEqual({});
    });

    it('returns parsed JSON on success', async () => {
      const mockPipeline = { id: 'test-id', name: 'Test', steps: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPipeline),
      });

      const result = await fetchPipeline('test-id');

      expect(result).toEqual(mockPipeline);
    });

    it('includes ID in error message on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      await expect(fetchPipeline('abc-123')).rejects.toThrow('Failed to fetch pipeline abc-123: 404 Not found');
    });
  });

  describe('createPipeline()', () => {
    it('calls correct URL with POST and correct body shape', async () => {
      const pipeline = { name: 'Test Pipeline', steps: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'new-id' }),
      });
      await createPipeline(pipeline);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/pipelines', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pipeline),
      }));
    });

    it('returns created pipeline object', async () => {
      const mockPipeline = { id: 'new-id', name: 'Test', steps: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPipeline),
      });

      const result = await createPipeline({ name: 'Test', steps: [] });

      expect(result).toEqual(mockPipeline);
    });

    it('throws Error with status code on non-2xx response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      });

      await expect(createPipeline({ name: 'Test', steps: [] }))
        .rejects.toThrow('Failed to create pipeline: 400 Bad request');
    });
  });

  describe('updatePipeline()', () => {
    it('calls correct URL with POST and correct body shape', async () => {
      const pipeline = { id: 'test-id', name: 'Updated', steps: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await updatePipeline(pipeline);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/pipelines/test-id', expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pipeline.name, steps: pipeline.steps }),
      }));
    });

    it('returns updated pipeline object', async () => {
      const mockPipeline = { id: 'test-id', name: 'Updated', steps: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPipeline),
      });

      const result = await updatePipeline(mockPipeline);

      expect(result).toEqual(mockPipeline);
    });

    it('throws Error with status code on non-2xx response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      await expect(updatePipeline({ id: 'test-id', name: 'Test', steps: [] }))
        .rejects.toThrow('Failed to update pipeline: 500 Server error');
    });
  });
});
