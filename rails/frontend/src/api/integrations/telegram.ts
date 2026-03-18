import { api } from "../client";
import type { TelegramChat } from "../types";

export interface TelegramStatus {
  status: "connected" | "disconnected" | "connecting" | "error";
  bot: { id: number; username: string; first_name: string } | null;
}

export interface TelegramContact {
  contact_id: string;
  type: "user" | "chat";
  name: string;
  username: string | null;
}

export const telegramApi = {
  status: () => api.get<TelegramStatus>("/integrations/telegram/status"),
  settings: () => api.get<{ bot_token: string }>("/integrations/telegram/settings"),
  connect: () => api.post<{ ok: boolean }>("/integrations/telegram/connect"),
  disconnect: () => api.post<{ ok: boolean }>("/integrations/telegram/disconnect"),
  updateSettings: (data: { bot_token: string }) =>
    api.patch<{ bot_token: string }>("/integrations/telegram/settings", data),
  contacts: () => api.get<TelegramContact[]>("/integrations/telegram/contacts"),
  chats: () => api.get<TelegramChat[]>("/integrations/telegram_chats"),
  updateChatLabel: (chat_id: string, label: string) =>
    api.put<TelegramChat>(`/integrations/telegram_chats/${encodeURIComponent(chat_id)}`, {
      telegram_chat: { label },
    }),
};
