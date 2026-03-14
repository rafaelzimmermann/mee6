import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupEventDelegation, teardown } from '/mee6/web/static/js/modules/triggers/event-delegation.js';

describe('triggers/event-delegation', () => {
  let dom, container, form, mockApiClient, callbacks;

  function setupDOM() {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html><body>
        <div id="triggers-container">
          <table><tbody id="triggers-list">
            <tr data-trigger-id="trigger-1">
              <td>
                <button data-action="toggle" data-trigger-id="trigger-1">Toggle</button>
                <button data-action="run-now" data-trigger-id="trigger-1">Run</button>
                <button data-action="delete" data-trigger-id="trigger-1">Delete</button>
              </td>
            </tr>
          </tbody></table>
        </div>
        <form id="add-trigger-form">
          <select id="trigger_type" name="trigger_type">
            <option value="cron" selected>Cron</option>
          </select>
          <div id="field-cron"><input name="cron_expr" value="0 9 * * *"></div>
          <div id="field-whatsapp" class="hidden"><input name="phone" value=""></div>
          <div id="field-wa-group" class="hidden"><select name="group_jid"></select></div>
          <select name="pipeline_id"><option value="pipe-1">My Pipeline</option></select>
          <input type="checkbox" name="enabled" checked>
          <button type="submit">Add</button>
        </form>
      </body></html>
    `);
    global.document = dom.window.document;
    global.window.confirm = vi.fn(() => true);
    container = document.getElementById('triggers-container');
    form = document.getElementById('add-trigger-form');
  }

  beforeEach(() => {
    vi.useFakeTimers();
    setupDOM();
    mockApiClient = {
      createTrigger: vi.fn().mockResolvedValue({ id: 'new-1', pipeline_name: 'New' }),
      toggleTrigger: vi.fn().mockResolvedValue({ id: 'trigger-1', enabled: true }),
      runNow: vi.fn().mockResolvedValue({ ok: true }),
      deleteTrigger: vi.fn().mockResolvedValue(undefined),
    };
    callbacks = {
      onAdded: vi.fn(),
      onToggled: vi.fn(),
      onRan: vi.fn(),
      onDeleted: vi.fn(),
      onError: vi.fn(),
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    teardown();
    vi.useRealTimers();
  });

  it('form submit calls onAdded with trigger on success', async () => {
    setupEventDelegation(container, form, mockApiClient, callbacks);

    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.runAllTimersAsync();
    expect(mockApiClient.createTrigger).toHaveBeenCalled();
    expect(callbacks.onAdded).toHaveBeenCalled();
  });

  it('form submit calls onError on validation failure', async () => {
    const formInvalid = dom.window.document.getElementById('add-trigger-form');
    formInvalid.querySelector('[name="pipeline_id"]').value = '';

    setupEventDelegation(container, formInvalid, mockApiClient, callbacks);
    formInvalid.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.runAllTimersAsync();
    expect(callbacks.onError).toHaveBeenCalled();
  });

  it('form submit calls onError on API failure', async () => {
    mockApiClient.createTrigger.mockRejectedValue(new Error('API error'));
    setupEventDelegation(container, form, mockApiClient, callbacks);

    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.runAllTimersAsync();
    expect(callbacks.onError).toHaveBeenCalledWith('API error');
  });

  it('form submit prevents default page reload', () => {
    setupEventDelegation(container, form, mockApiClient, callbacks);

    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('trigger_type change calls handleTypeChange (field visibility changes)', () => {
    setupEventDelegation(container, form, mockApiClient, callbacks);

    const cronField = document.getElementById('field-cron');
    const whatsappField = document.getElementById('field-whatsapp');

    expect(cronField.classList.contains('hidden')).toBe(false);
    expect(whatsappField.classList.contains('hidden')).toBe(true);

    const triggerTypeSelect = form.querySelector('#trigger_type');
    triggerTypeSelect.value = 'whatsapp';
    triggerTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(cronField.classList.contains('hidden')).toBe(true);
  });

  it('click on toggle button calls onToggled with id and new enabled state', async () => {
    setupEventDelegation(container, form, mockApiClient, callbacks);

    const toggleBtn = container.querySelector('[data-action="toggle"]');
    toggleBtn.click();

    await vi.runAllTimersAsync();
    expect(callbacks.onToggled).toHaveBeenCalledWith('trigger-1', true);
  });

  it('click on run-now button calls onRan with id', async () => {
    setupEventDelegation(container, form, mockApiClient, callbacks);

    const runBtn = container.querySelector('[data-action="run-now"]');
    runBtn.click();

    await vi.runAllTimersAsync();
    expect(callbacks.onRan).toHaveBeenCalledWith('trigger-1');
  });

  it('click on delete button calls onDeleted after confirm', async () => {
    setupEventDelegation(container, form, mockApiClient, callbacks);

    const deleteBtn = container.querySelector('[data-action="delete"]');
    deleteBtn.click();

    await vi.runAllTimersAsync();
    expect(global.window.confirm).toHaveBeenCalledWith('Delete this trigger?');
    expect(callbacks.onDeleted).toHaveBeenCalledWith('trigger-1');
  });

  it('click on delete button does NOT call onDeleted when confirm is cancelled', async () => {
    global.window.confirm.mockReturnValueOnce(false);
    setupEventDelegation(container, form, mockApiClient, callbacks);

    const deleteBtn = container.querySelector('[data-action="delete"]');
    deleteBtn.click();

    await vi.runAllTimersAsync();
    expect(callbacks.onDeleted).not.toHaveBeenCalled();
  });

  it('teardown prevents form submit from firing', () => {
    setupEventDelegation(container, form, mockApiClient, callbacks);
    teardown();

    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('teardown prevents container clicks from firing', async () => {
    setupEventDelegation(container, form, mockApiClient, callbacks);
    teardown();

    const toggleBtn = container.querySelector('[data-action="toggle"]');
    toggleBtn.click();

    await vi.runAllTimersAsync();
    expect(callbacks.onToggled).not.toHaveBeenCalled();
  });

  it('double-registration: calling setupEventDelegation twice does not double-fire', async () => {
    setupEventDelegation(container, form, mockApiClient, callbacks);

    const toggleBtn = container.querySelector('[data-action="toggle"]');
    toggleBtn.click();

    await vi.runAllTimersAsync();
    const callCount = callbacks.onToggled.mock.calls.length;

    setupEventDelegation(container, form, mockApiClient, callbacks);
    toggleBtn.click();

    await vi.runAllTimersAsync();
    expect(callbacks.onToggled.mock.calls.length).toBe(callCount + 1);
  });
});
