export interface DeploymentInfo {
  name: "development" | "staging" | "production"
  apiUrl: string
  features: {
    experimentalAdapters: boolean
    privacyModes: boolean
  }
}

export interface ApiKeyInfo {
  id: string
  key: string
  createdAt: number
  lastUsed: number | null
  revokedAt: number | null
}

export interface UsageLedgerEntry {
  id: string
  timestamp: number
  inputTokens: number
  outputTokens: number
  model: string
  adapter: "anthropic" | "openai" | "openrouter"
  costUsd: number
}
