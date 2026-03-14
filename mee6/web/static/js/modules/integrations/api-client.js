async function handleResponse(r) {
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || `Request failed: ${r.status}`);
  }
}

async function get(url) { const r = await fetch(url); await handleResponse(r); return r.json(); }
async function post(url, body) { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); await handleResponse(r); return r.json(); }
async function postEmpty(url) { const r = await fetch(url, { method: 'POST' }); if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || `Request failed: ${r.status}`); } }
async function del(url) { const r = await fetch(url, { method: 'DELETE' }); if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || `Request failed: ${r.status}`); } }
async function patch(url, body) { const r = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || `Request failed: ${r.status}`); } }

export async function getWhatsAppStatus() { return get('/api/v1/integrations/whatsapp/status'); }
export async function connectWhatsApp() { postEmpty('/api/v1/integrations/whatsapp/connect'); }
export async function setPhone(phone) { post('/api/v1/integrations/whatsapp/phone', { phone }); }
export async function syncGroups() { return post('/api/v1/integrations/whatsapp/sync'); }
export async function listGroups() { return get('/api/v1/integrations/whatsapp/groups'); }
export async function updateGroupLabel(jid, label) { patch(`/api/v1/integrations/whatsapp/groups/${encodeURIComponent(jid)}/label`, { label }); }
export async function deleteGroup(jid) { del(`/api/v1/integrations/whatsapp/groups/${encodeURIComponent(jid)}`); }
export async function testWhatsApp(phone) { return post('/api/v1/integrations/whatsapp/test', { phone }); }
export async function listCalendars() { return get('/api/v1/integrations/calendars'); }
export async function createCalendar(label, calendarId) { return post('/api/v1/integrations/calendars', { label, calendar_id: calendarId }); }
export async function deleteCalendar(id) { del(`/api/v1/integrations/calendars/${id}`); }
export async function listMemories() { return get('/api/v1/integrations/memories'); }
export async function listMemoryLabels() { return get('/api/v1/integrations/memories/labels'); }
export async function createMemory(data) { return post('/api/v1/integrations/memories', data); }
export async function deleteMemory(label) { del(`/api/v1/integrations/memories/${encodeURIComponent(label)}`); }
