export type CredentialType = "api-key" | "base-url";
export type ProviderCategory = "cloud" | "local";

export interface ProviderRegistryEntry {
  id: string;
  displayName: string;
  credentialType: CredentialType;
  category: ProviderCategory;
  envVar?: string;
  defaultCredential?: string;
  modelsEndpoint?: string;
  parseModelsResponse?: (data: any) => string[];
  // When true, the model picker lets the user type an arbitrary model id
  // instead of forcing a selection from the fetched list. Fetched models are
  // still offered as autocomplete suggestions. Used for providers like
  // OpenRouter that expose hundreds of free-form `vendor/model` slugs.
  allowCustomModel?: boolean;
  // Placeholder shown in the manual model input when allowCustomModel is set.
  modelPlaceholder?: string;
  requiresRunningCheck: boolean;
  supportsKeepAlive: boolean;
  keyConfig: {
    placeholder: string;
    inputType: "password" | "text";
    description: string;
    sensitive: boolean;
  };
}

export const PROVIDER_REGISTRY: Record<string, ProviderRegistryEntry> = {
  ollama: {
    id: "ollama",
    displayName: "Ollama",
    credentialType: "base-url",
    category: "local",
    envVar: "OLLAMA_BASE_URL",
    defaultCredential: "http://127.0.0.1:11434",
    modelsEndpoint: "ollama/tags",
    parseModelsResponse: (data) => data.models?.map((m: any) => m.name) ?? [],
    requiresRunningCheck: false,
    supportsKeepAlive: true,
    keyConfig: {
      placeholder: "http://127.0.0.1:11434",
      inputType: "text",
      description: "Base URL for your Ollama instance",
      sensitive: false,
    },
  },

  openai: {
    id: "openai",
    displayName: "OpenAI",
    credentialType: "api-key",
    category: "cloud",
    envVar: "OPENAI_API_KEY",
    modelsEndpoint: "openai/models",
    parseModelsResponse: (data) =>
      (data.data?.map((m: any) => m.id) ?? [])
        .filter((id: string) => id.startsWith("gpt-") || id.startsWith("o"))
        .sort(),
    requiresRunningCheck: false,
    supportsKeepAlive: false,
    keyConfig: {
      placeholder: "sk-...",
      inputType: "password",
      description: "Used for GPT models in resume review and job matching",
      sensitive: true,
    },
  },

  deepseek: {
    id: "deepseek",
    displayName: "DeepSeek",
    credentialType: "api-key",
    category: "cloud",
    envVar: "DEEPSEEK_API_KEY",
    modelsEndpoint: "deepseek/models",
    parseModelsResponse: (data) => data.data?.map((m: any) => m.id) ?? [],
    requiresRunningCheck: false,
    supportsKeepAlive: false,
    keyConfig: {
      placeholder: "sk-...",
      inputType: "password",
      description: "Used for DeepSeek models in resume review and job matching",
      sensitive: true,
    },
  },
  openrouter: {
    id: "openrouter",
    displayName: "OpenRouter",
    credentialType: "api-key",
    category: "cloud",
    envVar: "OPENROUTER_API_KEY",
    modelsEndpoint: "openrouter/models",
    parseModelsResponse: (data) =>
      (data.data?.map((m: any) => m.id) ?? []).sort(),
    allowCustomModel: true,
    modelPlaceholder: "e.g. openai/gpt-4o",
    requiresRunningCheck: false,
    supportsKeepAlive: false,
    keyConfig: {
      placeholder: "sk-or-...",
      inputType: "password",
      description: "Access 200+ models from multiple providers via OpenRouter",
      sensitive: true,
    },
  },

  gemini: {
    id: "gemini",
    displayName: "Google Gemini",
    credentialType: "api-key",
    category: "cloud",
    envVar: "GEMINI_API_KEY",
    modelsEndpoint: "gemini/models",
    parseModelsResponse: (data) =>
      data.models?.map((m: any) => m.name?.replace("models/", "")) ?? [],
    requiresRunningCheck: false,
    supportsKeepAlive: false,
    keyConfig: {
      placeholder: "AIza...",
      inputType: "password",
      description: "Used for Gemini models in resume review and job matching",
      sensitive: true,
    },
  },
};

export const AI_PROVIDERS = ["ollama", "openai", "deepseek", "openrouter", "gemini"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export function getAiProviders(): ProviderRegistryEntry[] {
  return AI_PROVIDERS.map((id) => PROVIDER_REGISTRY[id]);
}
