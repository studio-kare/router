export type AdapterChoice = "anthropic" | "openai" | "openrouter"
export type RoutingMode = "cost" | "performance" | "privacy"

export interface PrivacyStrategy {
  readonly adapter: AdapterChoice
  readonly costMultiplier: number
}

const strategies: Record<RoutingMode, PrivacyStrategy> = {
  cost: { adapter: "openrouter", costMultiplier: 0.3 },
  performance: { adapter: "openai", costMultiplier: 1.0 },
  privacy: { adapter: "anthropic", costMultiplier: 2.5 },
}

export const privacyToStrategy = (mode: RoutingMode = "performance"): PrivacyStrategy =>
  strategies[mode]
