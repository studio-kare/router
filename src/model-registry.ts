// Model registry: maps model names to their origin provider
// Open for extension: just add entries, no code changes needed

export type ModelProvider = "anthropic" | "openai" | "openrouter"

export interface ModelInfo {
  readonly name: string
  readonly provider: ModelProvider
  readonly maxTokens: number
}

const MODELS: Record<string, ModelInfo> = {
  // Anthropic models
  "claude-3.5-sonnet": { name: "claude-3.5-sonnet", provider: "anthropic", maxTokens: 200000 },
  "claude-3.5-haiku": { name: "claude-3.5-haiku", provider: "anthropic", maxTokens: 200000 },
  "claude-3-opus": { name: "claude-3-opus", provider: "anthropic", maxTokens: 200000 },
  "claude-3-sonnet": { name: "claude-3-sonnet", provider: "anthropic", maxTokens: 200000 },

  // OpenAI models
  "gpt-4": { name: "gpt-4", provider: "openai", maxTokens: 8192 },
  "gpt-4-turbo": { name: "gpt-4-turbo", provider: "openai", maxTokens: 128000 },
  "gpt-4o": { name: "gpt-4o", provider: "openai", maxTokens: 128000 },
  "gpt-4o-mini": { name: "gpt-4o-mini", provider: "openai", maxTokens: 128000 },
  "gpt-3.5-turbo": { name: "gpt-3.5-turbo", provider: "openai", maxTokens: 4096 },

  // OpenRouter models (sample)
  "meta-llama/llama-3.1-8b-instruct": {
    name: "meta-llama/llama-3.1-8b-instruct",
    provider: "openrouter",
    maxTokens: 131072,
  },
  "mistralai/mistral-7b-instruct": {
    name: "mistralai/mistral-7b-instruct",
    provider: "openrouter",
    maxTokens: 32768,
  },
}

export const getModelInfo = (modelName: string): ModelInfo | null => {
  return MODELS[modelName] ?? null
}

export const getModelProvider = (modelName: string): ModelProvider | null => {
  return MODELS[modelName]?.provider ?? null
}

export const listModels = (): ModelInfo[] => {
  return Object.values(MODELS)
}

export const registerModel = (info: ModelInfo): void => {
  MODELS[info.name] = info
}
