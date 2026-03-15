import { api } from "../client";
import type { Calendar } from "../types";

export const calendarsApi = {
  list: () => api.get<Calendar[]>("/integrations/calendars"),
  create: (data: Omit<Calendar, "id">) =>
    api.post<Calendar>("/integrations/calendars", { calendar: data }),
  delete: (id: string) => api.delete(`/integrations/calendars/${id}`),
};
