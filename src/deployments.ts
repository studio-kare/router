/**
 * Deployment Configurations
 *
 * Each deployment can be configured independently.
 * Models can be routed to different infrastructure providers
 * based on deployment environment, load, or cost requirements.
 *
 * Example:
 * - dev: Use DirectAPI (fast iteration)
 * - staging: Use DirectAPI + ValTown (load test)
 * - prod: Use ValTown (cost optimization) + DirectAPI fallback
 */

import { Context, Layer, Effect } from "effect"
import type { InfraProviderRoute } from "./infra-adapters"

export interface DeploymentConfig {
  readonly name: "development" | "staging" | "production" | "public"
  readonly routes: InfraProviderRoute[]
  readonly description: string
  readonly publicApiKey?: string
  readonly dailyPoolTokens?: number
  readonly adminToken?: string
  readonly rateLimit?: {
    readonly fairLimitPerSecond: number
    readonly abuseLimitPerSecond: number
    readonly cooldownMs: number
  }
}

export class Deployment extends Context.Service<Deployment, DeploymentConfig>()("Deployment") {}

/**
 * Development: Use DirectAPI for all models
 * Fastest iteration, all providers directly accessible
 */
export const DevelopmentConfig: DeploymentConfig = {
  name: "development",
  description: "Local development - all models use DirectAPI",
  routes: [
    // Specific routes can go here
    // Fall back to DirectAPI for everything
    { model: "*", infra: "direct-api", priority: 0 },
  ],
}

/**
 * Staging: Use DirectAPI for everything
 * Mirrors production setup, but with extra logging
 */
export const StagingConfig: DeploymentConfig = {
  name: "staging",
  description: "Staging - testing production setup",
  routes: [
    { model: "*", infra: "direct-api", priority: 0 },
  ],
}

/**
 * Production: Route to ValTown for cost optimization
 * Can use DirectAPI as fallback or for specific models
 */
export const ProductionConfig: DeploymentConfig = {
  name: "production",
  description: "Production - optimized for cost and reliability",
  routes: [
    // Route all models to ValTown (proxy, cost-optimized)
    { model: "*", infra: "val-town", priority: 10 },
    // Optional: Direct API for failover (lower priority)
    { model: "*", infra: "direct-api", priority: 0 },
  ],
}

/**
 * Public: Shared free router powered by accumulated credits
 * Single shared API key, per-IP rate limiting, metrics & banning
 * Routes through DirectAPI (can be changed to ValTown for cost optimization)
 */
export const PublicConfig: DeploymentConfig = {
  name: "public",
  description: "Public router - free API with per-IP rate limiting",
  routes: [
    // Route to DirectAPI (can swap to val-town for cost optimization)
    { model: "*", infra: "direct-api", priority: 0 },
  ],
  publicApiKey: process.env.PUBLIC_API_KEY ?? "sk_public_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  dailyPoolTokens: parseInt(process.env.PUBLIC_DAILY_POOL ?? "10000000"),
  adminToken: process.env.PUBLIC_ADMIN_TOKEN ?? "admin_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  rateLimit: {
    fairLimitPerSecond: 100,
    abuseLimitPerSecond: 500,
    cooldownMs: 300000, // 5 minutes
  },
}

/**
 * Select deployment based on environment
 */
export const getDeploymentConfig = (env: string): DeploymentConfig => {
  switch (env) {
    case "staging":
      return StagingConfig
    case "production":
      return ProductionConfig
    case "public":
      return PublicConfig
    case "development":
    default:
      return DevelopmentConfig
  }
}

export const DevelopmentLive = Layer.succeed(Deployment)(DevelopmentConfig)
export const StagingLive = Layer.succeed(Deployment)(StagingConfig)
export const ProductionLive = Layer.succeed(Deployment)(ProductionConfig)
export const PublicLive = Layer.succeed(Deployment)(PublicConfig)

export const DeploymentFromEnv = Layer.succeed(Deployment)(
  getDeploymentConfig(process.env.DEPLOYMENT ?? "development")
)
