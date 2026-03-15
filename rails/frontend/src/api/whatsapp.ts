import { api } from "./client";
import type { WhatsAppGroup } from "./types";

export const whatsappApi = {
  groups: () => api.get<WhatsAppGroup[]>("/whatsapp/groups"),
};
