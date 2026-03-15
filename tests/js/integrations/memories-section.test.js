import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as memoriesSection from '/mee6/web/static/js/modules/integrations/memories-section.js';
import * as apiClient from '/mee6/web/static/js/modules/integrations/api-client.js';
import * as validator from '/mee6/web/static/js/modules/integrations/validator.js';

vi.mock('/mee6/web/static/js/modules/integrations/api-client.js', () => ({
  listMemories: vi.fn(), listMemoryLabels: vi.fn(), createMemory: vi.fn(), deleteMemory: vi.fn(),
}));

vi.mock('/mee6/web/static/js/modules/integrations/validator.js', () => ({
  validateMemoryForm: vi.fn(), displayErrors: vi.fn(), clearErrors: vi.fn(),
}));

// Polyfill :has-text() pseudo-selector (Playwright-only, not supported in JSDOM)
let _origQS;

describe('integrations/memories-section', () => {
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

  describe('initMemories', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div class="card"><div class="card-header">Memory Configurations</div><div class="card-body"><form id="memory-form"><input type="text" id="label" name="label"><input type="number" id="max_memories" name="max_memories" value="100"><input type="number" id="ttl_hours" name="ttl_hours" value="24"><input type="number" id="max_value_size" name="max_value_size" value="2000"><button type="submit">Add</button></form><table><tbody id="memories-list"><tr data-label="old"><td>Old</td><td>0</td><td>100</td><td>24</td><td>2000</td><td><button data-action="delete" data-label="old" class="sm danger">Delete</button></td></tr></tbody></table></div></div><div id="form-errors" style="display:none;"></div>`;
    memoriesSection.initMemories(apiClient, callbacks);
  });

    it('does nothing when label is empty', async () => {
      // The module guards with `if (data.label)` — no API call and no validation when label is empty
      const form = document.getElementById('memory-form');
      document.getElementById('label').value = '';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.createMemory).not.toHaveBeenCalled();
      expect(validator.validateMemoryForm).not.toHaveBeenCalled();
    });

    it('rejects label with invalid characters', async () => {
      validator.validateMemoryForm.mockReturnValue(['Label can only contain letters, numbers, underscores, and hyphens']);
      apiClient.createMemory.mockResolvedValue({ label: 'new', max_memories: 100, ttl_hours: 24, max_value_size: 2000, count: 0 });
      const form = document.getElementById('memory-form');
      document.getElementById('label').value = 'invalid@label';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      expect(validator.displayErrors).toHaveBeenCalledWith('form-errors', expect.arrayContaining([expect.stringContaining('letters, numbers')]));
    });

    it('calls createMemory with correct fields', async () => {
      const data = { label: 'new', max_memories: 100, ttl_hours: 24, max_value_size: 2000 };
      validator.validateMemoryForm.mockReturnValue([]);
      apiClient.createMemory.mockResolvedValue({ ...data, count: 0 });
      const form = document.getElementById('memory-form');
      document.getElementById('label').value = 'new';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.createMemory).toHaveBeenCalledWith(data);
    });

    it('prepends row on success', async () => {
      const data = { label: 'new', max_memories: 100, ttl_hours: 24, max_value_size: 2000 };
      validator.validateMemoryForm.mockReturnValue([]);
      apiClient.createMemory.mockResolvedValue({ ...data, count: 0 });
      const form = document.getElementById('memory-form');
      document.getElementById('label').value = 'new';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      const tbody = document.querySelector('#memories-list');
      expect(tbody.children.length).toBe(2);
      expect(tbody.children[0].dataset.label).toBe('new');
      expect(tbody.children[1].dataset.label).toBe('old');
    });

    it('resets form on success', async () => {
      const data = { label: 'new', max_memories: 100, ttl_hours: 24, max_value_size: 2000 };
      validator.validateMemoryForm.mockReturnValue([]);
      apiClient.createMemory.mockResolvedValue({ ...data, count: 0 });
      const form = document.getElementById('memory-form');
      document.getElementById('label').value = 'test';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      expect(form.querySelector('#label').value).toBe('');
    });

    it('clears errors and shows success on success', async () => {
      const data = { label: 'new', max_memories: 100, ttl_hours: 24, max_value_size: 2000 };
      validator.validateMemoryForm.mockReturnValue([]);
      apiClient.createMemory.mockResolvedValue({ ...data, count: 0 });
      const form = document.getElementById('memory-form');
      document.getElementById('label').value = 'new';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      expect(validator.clearErrors).toHaveBeenCalledWith('form-errors');
      expect(callbacks.onSuccess).toHaveBeenCalledWith('Memory config created');
    });

    it('calls onError on API failure', async () => {
      const data = { label: 'new', max_memories: 100, ttl_hours: 24, max_value_size: 2000 };
      validator.validateMemoryForm.mockReturnValue([]);
      apiClient.createMemory.mockRejectedValue(new Error('API Error'));
      const form = document.getElementById('memory-form');
      document.getElementById('label').value = 'new';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 10));
      expect(callbacks.onError).toHaveBeenCalledWith('API Error');
    });

    it('calls deleteMemory after confirm', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      apiClient.deleteMemory.mockResolvedValue();
      document.body.innerHTML = `<div class="card"><div class="card-header">Memory Configurations</div><div class="card-body"><table><tbody id="memories-list"><tr data-label="mem1"><td>mem1</td><td>5</td><td>100</td><td>24</td><td>2000</td><td><button data-action="delete" data-label="mem1" class="sm danger">Delete</button></td></tr></tbody></table></div></div>`;
      memoriesSection.initMemories(apiClient, callbacks);
      document.querySelector('[data-action="delete"]').click();
      await new Promise(r => setTimeout(r, 10));
      expect(window.confirm).toHaveBeenCalledWith('Delete memory config "mem1"?');
      expect(apiClient.deleteMemory).toHaveBeenCalledWith('mem1');
    });

    it('removes row on success', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      apiClient.deleteMemory.mockResolvedValue();
      document.body.innerHTML = `<div class="card"><div class="card-header">Memory Configurations</div><div class="card-body"><table><tbody id="memories-list"><tr data-label="mem1"><td>mem1</td><td>5</td><td>100</td><td>24</td><td>2000</td><td><button data-action="delete" data-label="mem1" class="sm danger">Delete</button></td></tr></tbody></table></div></div>`;
      memoriesSection.initMemories(apiClient, callbacks);
      document.querySelector('[data-action="delete"]').click();
      await new Promise(r => setTimeout(r, 10));
      expect(document.querySelector('tr[data-label="mem1"]')).toBeNull();
      expect(callbacks.onSuccess).toHaveBeenCalledWith('Memory config deleted');
    });

    it('does nothing when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      apiClient.deleteMemory.mockResolvedValue();
      document.body.innerHTML = `<div class="card"><div class="card-header">Memory Configurations</div><div class="card-body"><table><tbody id="memories-list"><tr data-label="mem1"><td>mem1</td><td>5</td><td>100</td><td>24</td><td>2000</td><td><button data-action="delete" data-label="mem1" class="sm danger">Delete</button></td></tr></tbody></table></div></div>`;
      memoriesSection.initMemories(apiClient, callbacks);
      document.querySelector('[data-action="delete"]').click();
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.deleteMemory).not.toHaveBeenCalled();
    });

    it('calls onError on API failure', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      apiClient.deleteMemory.mockRejectedValue(new Error('Delete failed'));
      document.body.innerHTML = `<div class="card"><div class="card-header">Memory Configurations</div><div class="card-body"><table><tbody id="memories-list"><tr data-label="mem1"><td>mem1</td><td>5</td><td>100</td><td>24</td><td>2000</td><td><button data-action="delete" data-label="mem1" class="sm danger">Delete</button></td></tr></tbody></table></div></div>`;
      memoriesSection.initMemories(apiClient, callbacks);
      document.querySelector('[data-action="delete"]').click();
      await new Promise(r => setTimeout(r, 10));
      expect(callbacks.onError).toHaveBeenCalledWith('Delete failed');
    });
  });

  describe('renderMemoryRow', () => {
    it('escapes HTML in label', () => {
      const row = memoriesSection.renderMemoryRow({ label: '<script>alert("xss")</script>', max_memories: 100, ttl_hours: 24, max_value_size: 2000, count: 0 });
      expect(row).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('includes count field', () => {
      const row = memoriesSection.renderMemoryRow({ label: 'mem1', max_memories: 100, ttl_hours: 24, max_value_size: 2000, count: 5 });
      expect(row).toContain('>5<');
    });

    it('includes all columns in order', () => {
      const row = memoriesSection.renderMemoryRow({ label: 'mem1', max_memories: 100, ttl_hours: 24, max_value_size: 2000, count: 5 });
      const temp = document.createElement('table');
      temp.innerHTML = `<tbody>${row}</tbody>`;
      const tds = temp.querySelectorAll('td');
      expect(tds.length).toBe(6);
      expect(tds[0].textContent).toBe('mem1');
      expect(tds[1].textContent).toBe('5');
      expect(tds[2].textContent).toBe('100');
      expect(tds[3].textContent).toBe('24');
      expect(tds[4].textContent).toBe('2000');
      expect(tds[5].querySelector('button')?.textContent).toBe('Delete');
    });

    it('includes delete button with correct data attributes', () => {
      const row = memoriesSection.renderMemoryRow({ label: 'mem1', max_memories: 100, ttl_hours: 24, max_value_size: 2000, count: 5 });
      expect(row).toContain('data-action="delete"');
      expect(row).toContain('data-label="mem1"');
      expect(row).toContain('class="sm danger"');
    });
  });
});
