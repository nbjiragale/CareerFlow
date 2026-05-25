"use client";

// CAREERFLOW: Phase 1 — added "integrations" section for Gmail.
// CAREERFLOW: Phase 2 — added "usage" section for AI audit log.
// CAREERFLOW: Phase 3 — added "notifications" section for reminders.
// CAREERFLOW: Phase 3 (PR #9) — added "data" section for export.
import { Bot, Key, Palette, Plug, BarChart3, Bell, Database } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

export type SettingsSection =
  | "ai-provider"
  | "api-keys"
  | "integrations"
  | "usage"
  | "notifications"
  | "data"
  | "appearance";

const SETTINGS_SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: typeof Bot;
}[] = [
  { id: "ai-provider", label: "AI Provider", icon: Bot },
  { id: "api-keys", label: "API Keys", icon: Key },
  // CAREERFLOW: Phase 1 — Gmail integration lives here.
  { id: "integrations", label: "Integrations", icon: Plug },
  // CAREERFLOW: Phase 2 — AI usage + soft cap.
  { id: "usage", label: "Usage", icon: BarChart3 },
  // CAREERFLOW: Phase 3 — reminder notifications.
  { id: "notifications", label: "Notifications", icon: Bell },
  // CAREERFLOW: Phase 3 (PR #9) — data export.
  { id: "data", label: "Data", icon: Database },
  { id: "appearance", label: "Appearance", icon: Palette },
];

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export default function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  return (
    <nav className="flex flex-col gap-1 w-48 shrink-0">
      {SETTINGS_SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        return (
          <Button
            key={section.id}
            variant="ghost"
            className={cn(
              "justify-start gap-2 rounded-none border-l-2",
              isActive
                ? "border-l-primary bg-muted font-medium"
                : "border-l-transparent hover:border-l-muted-foreground/25",
            )}
            onClick={() => onSectionChange(section.id)}
          >
            <Icon className="h-4 w-4" />
            {section.label}
          </Button>
        );
      })}
    </nav>
  );
}
