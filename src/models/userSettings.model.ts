import { AiProvider } from "./ai.model";

export interface AiSettings {
  provider: AiProvider;
  model: string | undefined;
}

export interface DisplaySettings {
  theme: "light" | "dark" | "system";
}

// CAREERFLOW: Phase 3 — notification preferences. Stored inside the existing
// UserSettings JSON blob (no schema migration needed). browserEnabled /
// emailEnabled are the per-user defaults applied to new tasks; defaultLeadMinutes
// is how far ahead of a due date the task form pre-fills remindAt.
export interface NotificationSettings {
  browserEnabled: boolean;
  emailEnabled: boolean;
  defaultLeadMinutes: number;
}

export interface UserSettingsData {
  ai: AiSettings;
  display: DisplaySettings;
  notifications: NotificationSettings;
}

export interface UserSettings {
  userId: string;
  settings: UserSettingsData;
}

export const defaultUserSettings: UserSettingsData = {
  ai: {
    provider: AiProvider.OLLAMA,
    model: undefined,
  },
  display: {
    theme: "system",
  },
  notifications: {
    browserEnabled: true,
    emailEnabled: false,
    defaultLeadMinutes: 60,
  },
};
