// Privacy level [0, 1] determines adapter selection and cost
// 0.8 is the baseline anchor for cost multiplier

export type AdapterChoice = "anthropic" | "openai" | "openrouter"

export interface PrivacyStrategy {
  readonly adapter: AdapterChoice
  readonly costMultiplier: number // 1.0 at privacy=0.8
  readonly probabilities: Record<AdapterChoice, number> // routing probabilities per provider
}

const PRIVACY_BASELINE = 0.8

export const privacyToStrategy = (privacy: number = PRIVACY_BASELINE): PrivacyStrategy => {
  // Clamp to [0, 1]
  const p = Math.max(0, Math.min(1, privacy))

  // Cost multiplier: baseline at 0.8, higher privacy = higher cost
  // At 0: 0.1x (cheapest), at 1.0: 3.0x (most expensive)
  const costMultiplier = 0.1 + (p * 2.9)

  // Deterministic adapter selection based on privacy level
  let adapter: AdapterChoice
  if (p >= 0.85) {
    adapter = "anthropic"
  } else if (p >= 0.5) {
    adapter = "openai"
  } else {
    adapter = "openrouter"
  }

  // Probabilities: selected adapter gets 1.0, others get 0.0
  const probabilities: Record<AdapterChoice, number> = {
    anthropic: adapter === "anthropic" ? 1.0 : 0.0,
    openai: adapter === "openai" ? 1.0 : 0.0,
    openrouter: adapter === "openrouter" ? 1.0 : 0.0,
  }

  return {
    adapter,
    costMultiplier,
    probabilities,
  }
}
