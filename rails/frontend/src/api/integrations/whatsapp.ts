import { api } from "../client";
import type { WhatsAppGroup } from "../types";

export interface WhatsAppStatus {
  status: "connected" | "disconnected" | "pending_qr" | "connecting" | "error";
  qr_svg: string | null;
  phone_number: string;
}

export const whatsappApi = {
  status: () => api.get<WhatsAppStatus>("/integrations/whatsapp/status"),
  settings: () => api.get<{ phone_number: string }>("/integrations/whatsapp/settings"),
  connect: () => api.post<{ ok: boolean }>("/integrations/whatsapp/connect"),
  disconnect: () => api.post<{ ok: boolean }>("/integrations/whatsapp/disconnect"),
  updateSettings: (data: { phone_number: string }) =>
    api.patch<{ phone_number: string }>("/integrations/whatsapp/settings", data),
  groups: () => api.get<WhatsAppGroup[]>("/integrations/whatsapp_groups"),
  updateGroupLabel: (jid: string, label: string) =>
    api.put<WhatsAppGroup>(`/integrations/whatsapp_groups/${encodeURIComponent(jid)}`, {
      whatsapp_group: { label },
    }),
  syncGroups: () => api.post<{ ok: boolean }>("/integrations/whatsapp_groups/sync"),
};
