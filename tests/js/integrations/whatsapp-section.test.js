import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('/mee6/web/static/js/modules/integrations/api-client.js', () => ({
  getWhatsAppStatus: vi.fn(), connectWhatsApp: vi.fn(), setPhone: vi.fn(), syncGroups: vi.fn(), listGroups: vi.fn(), updateGroupLabel: vi.fn(), deleteGroup: vi.fn(), testWhatsApp: vi.fn(),
}));

describe('integrations/whatsapp-section', () => {
  let whatsappSection;
  let apiClient;
  let callbacks;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    whatsappSection = await import('/mee6/web/static/js/modules/integrations/whatsapp-section.js');
    apiClient = await import('/mee6/web/static/js/modules/integrations/api-client.js');
    callbacks = { onSuccess: vi.fn(), onError: vi.fn() };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    apiClient.getWhatsAppStatus.mockResolvedValue({ status: 'disconnected', qr_svg: null, error: null, notify_phone: '' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('initWhatsApp', () => {
    beforeEach(() => {
      document.body.innerHTML = `<div id="whatsapp-card"><p>Status: <span id="wa-status-badge" class="badge"></span></p><div id="qr-wrap" class="qr-wrap" style="display:none"></div><form id="connect-btn-form"><button id="connect-btn" type="submit">Connect</button></form><form id="phone-form"><input type="tel" name="phone" value="+34612345678"><button>Save</button></form><button id="sync-btn">Sync</button><table><tbody id="groups-list"><tr data-jid="jid1"><td>Group 1</td><td><input type="text" name="label" value="Label1" data-jid="jid1" class="input-label"><button type="button" data-action="save-label" data-jid="jid1" class="sm">Save</button></td><td><code>jid1</code></td><td><button type="button" data-action="delete-group" data-jid="jid1" class="sm danger">Remove</button></td></tr></tbody></table><form id="test-form"><input type="tel" id="test-phone" name="phone" value="+34612345678"><button type="submit">Send test</button></form><div id="test-result"></div></div>`;
    });

    it('calls getWhatsAppStatus on init', async () => {
      apiClient.getWhatsAppStatus.mockResolvedValue({ status: 'connected', qr_svg: null, error: null, notify_phone: '+34612345678' });
      whatsappSection.initWhatsApp(apiClient, callbacks);
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.getWhatsAppStatus).toHaveBeenCalled();
    });

    it('shows badge when status is connected', async () => {
      apiClient.getWhatsAppStatus.mockResolvedValue({ status: 'connected', qr_svg: null, error: null, notify_phone: '+34612345678' });
      whatsappSection.initWhatsApp(apiClient, callbacks);
      await new Promise(r => setTimeout(r, 10));
      expect(document.querySelector('.badge')?.textContent).toBe('connected');
    });

    it('starts polling when status is pending_qr', async () => {
      vi.useFakeTimers();
      apiClient.getWhatsAppStatus.mockResolvedValue({ status: 'pending_qr', qr_svg: '<svg>QR</svg>', error: null, notify_phone: null });
      whatsappSection.initWhatsApp(apiClient, callbacks);
      await vi.advanceTimersByTimeAsync(2000);
      expect(apiClient.getWhatsAppStatus).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('starts polling when status is connecting', async () => {
      vi.useFakeTimers();
      apiClient.getWhatsAppStatus.mockResolvedValue({ status: 'connecting', qr_svg: null, error: null, notify_phone: null });
      whatsappSection.initWhatsApp(apiClient, callbacks);
      await vi.advanceTimersByTimeAsync(2000);
      expect(apiClient.getWhatsAppStatus).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('does not start polling when status is connected', async () => {
      vi.useFakeTimers();
      apiClient.getWhatsAppStatus.mockResolvedValue({ status: 'connected', qr_svg: null, error: null, notify_phone: '+34612345678' });
      whatsappSection.initWhatsApp(apiClient, callbacks);
      await vi.advanceTimersByTimeAsync(2000);
      expect(apiClient.getWhatsAppStatus).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('does not start polling when status is disconnected', async () => {
      vi.useFakeTimers();
      apiClient.getWhatsAppStatus.mockResolvedValue({ status: 'disconnected', qr_svg: null, error: null, notify_phone: null });
      whatsappSection.initWhatsApp(apiClient, callbacks);
      await vi.advanceTimersByTimeAsync(2000);
      expect(apiClient.getWhatsAppStatus).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('polling stops when status becomes connected', async () => {
      vi.useFakeTimers();
      apiClient.getWhatsAppStatus.mockResolvedValueOnce({ status: 'pending_qr', qr_svg: '<svg>QR</svg>', error: null, notify_phone: null }).mockResolvedValueOnce({ status: 'connected', qr_svg: null, error: null, notify_phone: '+34612345678' });
      whatsappSection.initWhatsApp(apiClient, callbacks);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);
      expect(apiClient.getWhatsAppStatus).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2000);
      expect(apiClient.getWhatsAppStatus).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('polling stops when status becomes disconnected', async () => {
      vi.useFakeTimers();
      apiClient.getWhatsAppStatus.mockResolvedValueOnce({ status: 'pending_qr', qr_svg: '<svg>QR</svg>', error: null, notify_phone: null }).mockResolvedValueOnce({ status: 'disconnected', qr_svg: null, error: null, notify_phone: null });
      whatsappSection.initWhatsApp(apiClient, callbacks);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);
      expect(apiClient.getWhatsAppStatus).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2000);
      expect(apiClient.getWhatsAppStatus).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('polling stops when status becomes error', async () => {
      vi.useFakeTimers();
      apiClient.getWhatsAppStatus.mockResolvedValueOnce({ status: 'pending_qr', qr_svg: '<svg>QR</svg>', error: null, notify_phone: null }).mockResolvedValueOnce({ status: 'error', qr_svg: null, error: 'Connection failed', notify_phone: null });
      whatsappSection.initWhatsApp(apiClient, callbacks);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);
      expect(apiClient.getWhatsAppStatus).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2000);
      expect(apiClient.getWhatsAppStatus).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('connect button calls connectWhatsApp', async () => {
      vi.useFakeTimers();
      apiClient.connectWhatsApp.mockResolvedValue();
      apiClient.getWhatsAppStatus.mockResolvedValue({ status: 'connecting', qr_svg: null, error: null, notify_phone: null });
      whatsappSection.initWhatsApp(apiClient, callbacks);
      document.querySelector('#connect-btn').click();
      await vi.advanceTimersByTimeAsync(10);
      expect(apiClient.connectWhatsApp).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('connect button calls onError on API failure', async () => {
      apiClient.connectWhatsApp.mockRejectedValue(new Error('Connection failed'));
      whatsappSection.initWhatsApp(apiClient, callbacks);
      document.querySelector('#connect-btn').click();
      await new Promise(r => setTimeout(r, 10));
      expect(callbacks.onError).toHaveBeenCalledWith('Connection failed');
    });

    it('save phone calls setPhone with correct value', async () => {
      apiClient.setPhone.mockResolvedValue();
      whatsappSection.initWhatsApp(apiClient, callbacks);
      const phoneInput = document.querySelector('input[name="phone"]');
      phoneInput.value = '+1234567890';
      document.querySelector('#phone-form button').click();
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.setPhone).toHaveBeenCalledWith('+1234567890');
      expect(callbacks.onSuccess).toHaveBeenCalledWith('Phone number saved');
    });

    it('save phone calls onError for empty phone', async () => {
      whatsappSection.initWhatsApp(apiClient, callbacks);
      const phoneInput = document.querySelector('input[name="phone"]');
      phoneInput.value = '';
      document.querySelector('#phone-form button').click();
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.setPhone).not.toHaveBeenCalled();
      expect(callbacks.onError).toHaveBeenCalledWith('Phone number is required');
    });

    it('sync groups calls syncGroups', async () => {
      apiClient.syncGroups.mockResolvedValue({ updated: 5, message: 'Synced 5 groups.' });
      whatsappSection.initWhatsApp(apiClient, callbacks);
      document.querySelector('#sync-btn').click();
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.syncGroups).toHaveBeenCalled();
      expect(callbacks.onSuccess).toHaveBeenCalledWith('Synced 5 groups');
    });

    it('sync groups calls onError on failure', async () => {
      apiClient.syncGroups.mockRejectedValue(new Error('Sync failed'));
      whatsappSection.initWhatsApp(apiClient, callbacks);
      document.querySelector('#sync-btn').click();
      await new Promise(r => setTimeout(r, 10));
      expect(callbacks.onError).toHaveBeenCalledWith('Sync failed');
    });

    it('delete group calls deleteGroup and removes row', async () => {
      apiClient.deleteGroup.mockResolvedValue();
      whatsappSection.initWhatsApp(apiClient, callbacks);
      document.querySelector('[data-action="delete-group"]').click();
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.deleteGroup).toHaveBeenCalledWith('jid1');
      expect(document.querySelector('tr[data-jid="jid1"]')).toBeNull();
      expect(callbacks.onSuccess).toHaveBeenCalledWith('Group removed');
    });

    it('test whatsapp calls testWhatsApp', async () => {
      apiClient.testWhatsApp.mockResolvedValue({ ok: true });
      whatsappSection.initWhatsApp(apiClient, callbacks);
      const phoneInput = document.querySelector('#test-phone');
      phoneInput.value = '+1234567890';
      document.querySelector('#test-form button').click();
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.testWhatsApp).toHaveBeenCalledWith('+1234567890');
      expect(callbacks.onSuccess).toHaveBeenCalledWith('Test message sent');
    });

    it('test whatsapp calls onError on 503', async () => {
      apiClient.testWhatsApp.mockRejectedValue(new Error('503 Service Unavailable'));
      whatsappSection.initWhatsApp(apiClient, callbacks);
      const phoneInput = document.querySelector('#test-phone');
      phoneInput.value = '+1234567890';
      document.querySelector('#test-form button').click();
      await new Promise(r => setTimeout(r, 10));
      expect(callbacks.onError).toHaveBeenCalledWith('WhatsApp is not connected');
    });

    it('test whatsapp calls onError for empty phone', async () => {
      whatsappSection.initWhatsApp(apiClient, callbacks);
      const phoneInput = document.querySelector('#test-phone');
      phoneInput.value = '';
      document.querySelector('#test-form button').click();
      await new Promise(r => setTimeout(r, 10));
      expect(apiClient.testWhatsApp).not.toHaveBeenCalled();
      expect(callbacks.onError).toHaveBeenCalledWith('Phone number is required');
    });
  });
});
