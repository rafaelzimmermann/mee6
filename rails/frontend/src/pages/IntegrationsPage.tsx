import { useState } from "react";
import { MemoriesSection } from "../components/integrations/MemoriesSection";
import { CalendarsSection } from "../components/integrations/CalendarsSection";
import { WhatsAppSection } from "../components/integrations/WhatsAppSection";
import { TelegramSection } from "../components/integrations/TelegramSection";
import { AdminSection } from "../components/integrations/AdminSection";

type Tab = "memories" | "calendars" | "whatsapp" | "telegram" | "admin";

const TABS: { id: Tab; label: string }[] = [
  { id: "memories",  label: "Memories" },
  { id: "calendars", label: "Calendars" },
  { id: "whatsapp",  label: "WhatsApp" },
  { id: "telegram",  label: "Telegram" },
  { id: "admin",     label: "Admin" },
];

export function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("memories");

  return (
    <div>
      <h1>Integrations</h1>

      <div role="tablist" className="flex border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={
              activeTab === tab.id
                ? "px-4 py-2 text-sm font-medium text-indigo-600 border-b-2 border-indigo-600 -mb-px"
                : "px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300 -mb-px"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === "memories"  && <MemoriesSection />}
        {activeTab === "calendars" && <CalendarsSection />}
        {activeTab === "whatsapp"  && <WhatsAppSection />}
        {activeTab === "telegram"  && <TelegramSection />}
        {activeTab === "admin"     && <AdminSection />}
      </div>
    </div>
  );
}
