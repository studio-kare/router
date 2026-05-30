import { Context, Layer, Effect } from "effect"

export interface RateLimitConfig {
  fairness: {
    requestsPerSec: number // 100
    type: "token_bucket"
  }
  abuse: {
    requestsPerSec: number // 1000
    type: "circuit_breaker"
    cooldownMs: number // 300000 (5 min)
  }
  budget: {
    tokensPerDay: number // 1_000_000
    type: "token_counter"
  }
}

export interface QuotaStatus {
  fairness: {
    remaining: number
    resetAt: number
  }
  abuse: {
    blocked: boolean
    blockedUntil: number | null
  }
  budget: {
    used: number
    remaining: number
    resetAt: number
  }
  panic: boolean // true if any limit is critical (>80%)
}

export interface PublicIpQuotaStatus {
  ipAddress: string
  tokensUsedToday: number
  poolRemaining: number
  poolTotal: number
  fairnessRemaining: number
  panic: boolean
}

interface KeyLimits {
  fairness: {
    tokens: number
    lastRefill: number
  }
  abuse: {
    requestCount: number
    windowStart: number
    blockedUntil: number | null
  }
  budget: {
    tokensUsed: number
    lastReset: number
  }
}

const DEFAULT_CONFIG: RateLimitConfig = {
  fairness: { requestsPerSec: 100, type: "token_bucket" },
  abuse: { requestsPerSec: 1000, type: "circuit_breaker", cooldownMs: 300000 },
  budget: { tokensPerDay: 1_000_000, type: "token_counter" },
}

const REFILL_INTERVAL_MS = 100 // Refill fairness bucket every 100ms

export class RateLimiter extends Context.Service<
  RateLimiter,
  {
    readonly checkFairness: (key: string) => Effect.Effect<boolean>
    readonly checkAbuse: (key: string) => Effect.Effect<boolean>
    readonly checkBudget: (key: string, tokens: number) => Effect.Effect<boolean>
    readonly recordTokens: (key: string, tokens: number) => Effect.Effect<void>
    readonly getQuota: (key: string) => Effect.Effect<QuotaStatus>
    readonly resetBudget: (key: string) => Effect.Effect<void>
    // Public/IP-based rate limiting
    readonly checkFairnessForIp: (ip: string) => Effect.Effect<boolean>
    readonly recordTokensForIp: (ip: string, tokens: number) => Effect.Effect<void>
    readonly getIpQuota: (ip: string, poolTotal: number) => Effect.Effect<PublicIpQuotaStatus>
    readonly getIpUsageToday: (ip: string) => Effect.Effect<number>
    readonly getAllIpUsageToday: () => Effect.Effect<Map<string, number>>
    readonly resetDailyPool: () => Effect.Effect<void>
  }
>()("RateLimiter") {}

const createRateLimiterService = () => {
  const limits = new Map<string, KeyLimits>()
  const config = DEFAULT_CONFIG

  // IP-based tracking for public deployment
  const ipLimits = new Map<string, KeyLimits>()
  const dailyIpUsage = new Map<string, number>()
  let dailyPoolResetAt = Date.now() + 24 * 60 * 60 * 1000

  const getOrCreateLimits = (key: string, limitsMap?: Map<string, KeyLimits>): KeyLimits => {
    const map = limitsMap || limits
    if (!map.has(key)) {
      const now = Date.now()
      map.set(key, {
        fairness: {
          tokens: config.fairness.requestsPerSec * 10, // Start with 10 seconds worth
          lastRefill: now,
        },
        abuse: {
          requestCount: 0,
          windowStart: now,
          blockedUntil: null,
        },
        budget: {
          tokensUsed: 0,
          lastReset: now,
        },
      })
    }
    return map.get(key)!
  }

  const refillFairnessTokens = (keyLimits: KeyLimits): void => {
    const now = Date.now()
    const elapsed = now - keyLimits.fairness.lastRefill
    const tokensToAdd = (elapsed / 1000) * config.fairness.requestsPerSec
    const maxTokens = config.fairness.requestsPerSec * 10 // Max 10 seconds worth

    keyLimits.fairness.tokens = Math.min(
      maxTokens,
      keyLimits.fairness.tokens + tokensToAdd
    )
    keyLimits.fairness.lastRefill = now
  }

  const resetAbuseWindow = (keyLimits: KeyLimits): void => {
    const now = Date.now()
    const windowAge = now - keyLimits.abuse.windowStart
    if (windowAge > 1000) {
      keyLimits.abuse.requestCount = 0
      keyLimits.abuse.windowStart = now
    }
  }

  const resetBudgetIfNeeded = (keyLimits: KeyLimits): void => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const elapsed = now - keyLimits.budget.lastReset
    if (elapsed > dayMs) {
      keyLimits.budget.tokensUsed = 0
      keyLimits.budget.lastReset = now
    }
  }

  const resetDailyPoolIfNeeded = (): void => {
    const now = Date.now()
    if (now > dailyPoolResetAt) {
      dailyIpUsage.clear()
      dailyPoolResetAt = now + 24 * 60 * 60 * 1000
    }
  }

  return {
    checkFairness: (key: string) =>
      Effect.sync(() => {
        const keyLimits = getOrCreateLimits(key)
        refillFairnessTokens(keyLimits)

        if (keyLimits.fairness.tokens >= 1) {
          keyLimits.fairness.tokens -= 1
          return true
        }
        return false
      }),

    checkAbuse: (key: string) =>
      Effect.sync(() => {
        const keyLimits = getOrCreateLimits(key)
        const now = Date.now()

        // Check if key is blocked
        if (
          keyLimits.abuse.blockedUntil !== null &&
          now < keyLimits.abuse.blockedUntil
        ) {
          return false
        }

        keyLimits.abuse.blockedUntil = null

        // Reset window if needed
        resetAbuseWindow(keyLimits)

        // Check if adding this request exceeds limit
        if (
          keyLimits.abuse.requestCount + 1 >
          config.abuse.requestsPerSec
        ) {
          keyLimits.abuse.blockedUntil = now + config.abuse.cooldownMs
          return false
        }

        keyLimits.abuse.requestCount += 1
        return true
      }),

    checkBudget: (key: string, tokens: number) =>
      Effect.sync(() => {
        const keyLimits = getOrCreateLimits(key)
        resetBudgetIfNeeded(keyLimits)

        const wouldExceed =
          keyLimits.budget.tokensUsed + tokens > config.budget.tokensPerDay

        return !wouldExceed
      }),

    recordTokens: (key: string, tokens: number) =>
      Effect.sync(() => {
        const keyLimits = getOrCreateLimits(key)
        resetBudgetIfNeeded(keyLimits)
        keyLimits.budget.tokensUsed += tokens
      }),

    getQuota: (key: string) =>
      Effect.sync(() => {
        const keyLimits = getOrCreateLimits(key)
        const now = Date.now()

        refillFairnessTokens(keyLimits)
        resetBudgetIfNeeded(keyLimits)

        const fairnessRemaining = Math.floor(keyLimits.fairness.tokens)
        const fairnessResetAt =
          keyLimits.fairness.lastRefill + (1000 / config.fairness.requestsPerSec) * Math.max(1, 1 - keyLimits.fairness.tokens)

        const budgetRemaining = Math.max(
          0,
          config.budget.tokensPerDay - keyLimits.budget.tokensUsed
        )
        const budgetResetAt = keyLimits.budget.lastReset + 24 * 60 * 60 * 1000

        const fairnessCritical =
          fairnessRemaining < config.fairness.requestsPerSec * 0.2
        const budgetCritical =
          budgetRemaining < config.budget.tokensPerDay * 0.2
        const abuseCritical = keyLimits.abuse.blockedUntil !== null

        return {
          fairness: {
            remaining: fairnessRemaining,
            resetAt: Math.ceil(fairnessResetAt),
          },
          abuse: {
            blocked: keyLimits.abuse.blockedUntil !== null,
            blockedUntil: keyLimits.abuse.blockedUntil,
          },
          budget: {
            used: keyLimits.budget.tokensUsed,
            remaining: budgetRemaining,
            resetAt: budgetResetAt,
          },
          panic: fairnessCritical || budgetCritical || abuseCritical,
        }
      }),

    resetBudget: (key: string) =>
      Effect.sync(() => {
        const keyLimits = getOrCreateLimits(key)
        keyLimits.budget.tokensUsed = 0
        keyLimits.budget.lastReset = Date.now()
      }),

    // Public deployment: IP-based rate limiting
    checkFairnessForIp: (ip: string) =>
      Effect.sync(() => {
        const ipLimit = getOrCreateLimits(ip, ipLimits)
        refillFairnessTokens(ipLimit)

        if (ipLimit.fairness.tokens >= 1) {
          ipLimit.fairness.tokens -= 1
          return true
        }
        return false
      }),

    recordTokensForIp: (ip: string, tokens: number) =>
      Effect.sync(() => {
        resetDailyPoolIfNeeded()
        const current = dailyIpUsage.get(ip) || 0
        dailyIpUsage.set(ip, current + tokens)
      }),

    getIpQuota: (ip: string, poolTotal: number) =>
      Effect.sync(() => {
        resetDailyPoolIfNeeded()

        const ipUsed = dailyIpUsage.get(ip) || 0
        const poolUsed = Array.from(dailyIpUsage.values()).reduce((a, b) => a + b, 0)
        const poolRemaining = Math.max(0, poolTotal - poolUsed)

        const ipLimit = getOrCreateLimits(ip, ipLimits)
        refillFairnessTokens(ipLimit)

        const panic = poolRemaining < poolTotal * 0.2 || ipLimit.fairness.tokens < config.fairness.requestsPerSec * 0.2

        return {
          ipAddress: ip,
          tokensUsedToday: ipUsed,
          poolRemaining,
          poolTotal,
          fairnessRemaining: Math.floor(ipLimit.fairness.tokens),
          panic,
        }
      }),

    getIpUsageToday: (ip: string) =>
      Effect.sync(() => {
        resetDailyPoolIfNeeded()
        return dailyIpUsage.get(ip) || 0
      }),

    getAllIpUsageToday: () =>
      Effect.sync(() => {
        resetDailyPoolIfNeeded()
        return new Map(dailyIpUsage)
      }),

    resetDailyPool: () =>
      Effect.sync(() => {
        dailyIpUsage.clear()
        dailyPoolResetAt = Date.now() + 24 * 60 * 60 * 1000
      }),
  }
}

export const RateLimiterLive = Layer.succeed(RateLimiter)(createRateLimiterService())
