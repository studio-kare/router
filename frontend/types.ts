export interface DeploymentInfo {
  name: "development" | "staging" | "production"
  apiUrl: string
  features: {
    experimentalAdapters: boolean
    privacyModes: boolean
  }
}

export interface PrivacyInfo {
  privacy: number
  routing: {
    anthropic: { probability: number; costMultiplier: number }
    openai: { probability: number; costMultiplier: number }
    openrouter: { probability: number; costMultiplier: number }
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
