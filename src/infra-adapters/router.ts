/**
 * Infrastructure Provider Router
 *
 * Maps models to infrastructure adapters.
 * This is the configuration layer that can be changed independently
 * from the model registry and adapter implementations.
 *
 * Example:
 *  "claude-3.5-sonnet" could use DirectAPI in dev, ValTown in prod
 *  "gpt-4o" could use DirectAPI or Lambda depending on load
 */

import { Context, Effect, Layer } from "effect"
import type { StreamChatParams, StreamChunk } from "../types"
import type { InfraAdapter } from "./base"
import type { Stream } from "effect"

export type InfraProviderName = "direct-api" | "val-town" | "lambda" | "local"

export interface InfraProviderRoute {
  readonly model: string | "*" // "*" = default fallback
  readonly infra: InfraProviderName
  readonly priority?: number // Higher priority routes checked first
}

export class InfraAdapterRouter extends Context.Service<
  InfraAdapterRouter,
  {
    readonly getAdapter: (
      modelName: string
    ) => Effect.Effect<InfraAdapter, never>
    readonly addRoute: (route: InfraProviderRoute) => Effect.Effect<void>
  }
>()("InfraAdapterRouter") {}

export const createInfraAdapterRouter = (
  adapters: Map<InfraProviderName, InfraAdapter>
) => {
  const routes: InfraProviderRoute[] = [
    // Default routes (can be overridden per deployment)
    { model: "*", infra: "direct-api", priority: 0 },
  ]

  return {
    getAdapter: (modelName: string) => {
      // Find matching route (higher priority first)
      const sorted = [...routes].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      const route = sorted.find((r) => r.model === modelName || r.model === "*")

      if (!route) {
        return Effect.fail(new Error(`No adapter route for model: ${modelName}`))
      }

      const adapter = adapters.get(route.infra)
      if (!adapter) {
        return Effect.fail(new Error(`No adapter found for infra: ${route.infra}`))
      }

      return Effect.succeed(adapter)
    },

    addRoute: (route: InfraProviderRoute) =>
      Effect.sync(() => {
        routes.push(route)
      }),
  }
}

export const InfraAdapterRouterLive = (adapters: Map<InfraProviderName, InfraAdapter>) =>
  Layer.succeed(InfraAdapterRouter)(createInfraAdapterRouter(adapters))
