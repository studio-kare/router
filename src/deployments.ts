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
  readonly name: "development" | "staging" | "production"
  readonly routes: InfraProviderRoute[]
  readonly description: string
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
 * Select deployment based on environment
 */
export const getDeploymentConfig = (env: string): DeploymentConfig => {
  switch (env) {
    case "staging":
      return StagingConfig
    case "production":
      return ProductionConfig
    case "development":
    default:
      return DevelopmentConfig
  }
}

export const DevelopmentLive = Layer.succeed(Deployment)(DevelopmentConfig)
export const StagingLive = Layer.succeed(Deployment)(StagingConfig)
export const ProductionLive = Layer.succeed(Deployment)(ProductionConfig)

export const DeploymentFromEnv = Layer.succeed(Deployment)(
  getDeploymentConfig(process.env.DEPLOYMENT ?? "development")
)
