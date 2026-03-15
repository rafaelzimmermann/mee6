import { useState } from "react";
import { MemoriesSection } from "../components/integrations/MemoriesSection";
import { CalendarsSection } from "../components/integrations/CalendarsSection";
import { WhatsAppSection } from "../components/integrations/WhatsAppSection";
import { AdminSection } from "../components/integrations/AdminSection";

type Tab = "memories" | "calendars" | "whatsapp" | "admin";

const TABS: { id: Tab; label: string }[] = [
  { id: "memories",  label: "Memories" },
  { id: "calendars", label: "Calendars" },
  { id: "whatsapp",  label: "WhatsApp" },
  { id: "admin",     label: "Admin" },
];

export function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("memories");

  return (
    <div>
      <h1>Integrations</h1>

      <div role="tablist" className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? "tab active" : "tab"}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === "memories"  && <MemoriesSection />}
        {activeTab === "calendars" && <CalendarsSection />}
        {activeTab === "whatsapp"  && <WhatsAppSection />}
        {activeTab === "admin"     && <AdminSection />}
      </div>
    </div>
  );
}
