"use client";

import { useEffect, useState } from "react";
import AiSettings from "@/components/settings/AiSettings";
import ApiKeySettings from "@/components/settings/ApiKeySettings";
import DisplaySettings from "@/components/settings/DisplaySettings";
// CAREERFLOW: Phase 1 — Gmail integration settings panel.
import IntegrationsSettings from "@/components/settings/IntegrationsSettings";
// CAREERFLOW: Phase 2 — AI usage panel.
import UsageSettings from "@/components/settings/UsageSettings";
import SettingsSidebar, { type SettingsSection } from "@/components/settings/SettingsSidebar";

function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("ai-provider");

  // CAREERFLOW: deep-link via ?section=integrations from the Gmail OAuth
  // callback so users land back in the right tab.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");
    if (
      section === "ai-provider" ||
      section === "api-keys" ||
      section === "integrations" ||
      section === "usage" ||
      section === "appearance"
    ) {
      setActiveSection(section);
    }
  }, []);

  return (
    <div className="flex flex-col col-span-3">
      <h3 className="text-2xl font-semibold leading-none tracking-tight mb-4">
        Settings
      </h3>
      <div className="flex gap-6">
        <SettingsSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <div className="flex-1 min-w-0">
          {activeSection === "ai-provider" && <AiSettings />}
          {activeSection === "api-keys" && <ApiKeySettings />}
          {activeSection === "integrations" && <IntegrationsSettings />}
          {activeSection === "usage" && <UsageSettings />}
          {activeSection === "appearance" && <DisplaySettings />}
        </div>
      </div>
    </div>
  );
}

export default Settings;
