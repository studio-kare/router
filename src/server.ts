import { Effect, Layer, ManagedRuntime, Stream, Context } from "effect"
import { AnthropicAdapter } from "./adapters/anthropic"
import { OpenAIAdapter } from "./adapters/openai"
import { OpenRouterAdapter } from "./adapters/openrouter"
import type { StreamChatParams } from "./types"
import { ValidationError } from "./types"
import { validateStreamChatParams } from "./validation"
import { logInfo, logError } from "./logging"
import { privacyToStrategy } from "./privacy"
import { Deployment } from "./deployments"
import { KeyService } from "./keys"
import { RateLimiter } from "./rate-limit"
import { LedgerService } from "./ledger"
import { getPlaceholderHtml } from "./placeholder"
import type { InfraAdapter } from "./infra-adapters/base"
import { createPublicMetrics } from "./public-metrics"
import { createBanManager } from "./public-bans"

// Val.town adapter service (from index.ts)
class ValTownAdapterService extends Context.Service<ValTownAdapterService, InfraAdapter>()(
  "ValTownAdapterService"
) { }

// --- SSE helpers ---

const encoder = new TextEncoder()

const sseChunk = (text: string, model: string): string =>
  `data: ${JSON.stringify({
    id: `farmer-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: { content: text }, finish_reason: null, logprobs: null }],
  })}\n\n`

const sseDone = "data: [DONE]\n\n"

// --- Adapter selection ---

const selectAndStream = (
  params: StreamChatParams,
  strategy: ReturnType<typeof privacyToStrategy>,
  useValTown: boolean
) => {
  // Production: route through Val.town
  if (useValTown) {
    return Effect.gen(function*() {
      const adapter = yield* ValTownAdapterService
      return yield* adapter.streamChat(params)
    })
  }

  // Development: use privacy-based strategy
  if (strategy.adapter === "anthropic") {
    return Effect.gen(function*() {
      const adapter = yield* AnthropicAdapter
      return yield* adapter.streamChat(params)
    })
  }
  if (strategy.adapter === "openai") {
    return Effect.gen(function*() {
      const adapter = yield* OpenAIAdapter
      return yield* adapter.streamChat(params)
    })
  }
  return Effect.gen(function*() {
    const adapter = yield* OpenRouterAdapter
    return yield* adapter.streamChat(params)
  })
}

// --- Handler (requires all three adapters in context) ---

export type AdapterEnv =
  | OpenRouterAdapter
  | OpenAIAdapter
  | AnthropicAdapter
  | ValTownAdapterService
  | Deployment
  | KeyService
  | RateLimiter
  | LedgerService

export const handleChatCompletions = (
  req: Request
): Effect.Effect<Response, never, AdapterEnv> =>
  Effect.gen(function*() {
    // Validate API key
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const apiKey = authHeader.slice(7)
    const keyService = yield* KeyService
    const validKey = yield* keyService.validateKey(apiKey)

    if (!validKey) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    // Check rate limits
    const rateLimiter = yield* RateLimiter
    const fairnessOk = yield* rateLimiter.checkFairness(apiKey)
    const abuseOk = yield* rateLimiter.checkAbuse(apiKey)

    if (!fairnessOk || !abuseOk) {
      const quota = yield* rateLimiter.getQuota(apiKey)
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-RateLimit-Panic": quota.panic ? "true" : "false",
        "X-RateLimit-Fairness-Remaining": String(quota.fairness.remaining),
        "X-RateLimit-Fairness-Reset": String(quota.fairness.resetAt),
        "X-RateLimit-Budget-Used": String(quota.budget.used),
        "X-RateLimit-Budget-Remaining": String(quota.budget.remaining),
        "X-RateLimit-Budget-Reset": String(quota.budget.resetAt),
      }
      if (quota.abuse.blockedUntil) {
        const retryAfter = Math.ceil((quota.abuse.blockedUntil - Date.now()) / 1000)
        headers["Retry-After"] = String(retryAfter)
      }

      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          quota,
        }),
        { status: 429, headers }
      )
    }

    // Record usage
    yield* keyService.recordUsage(apiKey)

    const body = yield* Effect.tryPromise({
      try: () => req.json() as Promise<unknown>,
      catch: () => new Error("malformed JSON"),
    })

    const params = yield* validateStreamChatParams(body)
    const strategy = privacyToStrategy(params.privacy)

    // Check if we should route through Val.town (production deployment)
    const deployment = yield* Deployment
    const useValTown = deployment.name === "production"

    const chunkStream = yield* selectAndStream(params, strategy, useValTown)

    const responseBody = new ReadableStream({
      async start(controller) {
        try {
          let totalTokens = 0
          await Effect.runPromise(
            Stream.runForEach(chunkStream, (chunk) => {
              if (chunk.text) {
                controller.enqueue(encoder.encode(sseChunk(chunk.text, params.model)))
              }
              // Track tokens from the final chunk with usage info
              if (chunk.done && chunk.usage) {
                totalTokens = chunk.usage.inputTokens + chunk.usage.outputTokens
              }
              return Effect.void
            })
          )

          // Record total tokens used for this request
          if (totalTokens > 0) {
            await Effect.runPromise(rateLimiter.recordTokens(apiKey, totalTokens))
          }

          controller.enqueue(encoder.encode(sseDone))
          controller.close()
        } catch (e) {
          controller.error(e)
        }
      },
    })

    return new Response(responseBody, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }).pipe(
    Effect.catch((e) => {
      if (e instanceof ValidationError) {
        return logError("validation_failed", {
          field: e.field,
          constraint: e.constraint,
        }).pipe(
          Effect.map(() =>
            new Response(
              JSON.stringify({
                error: e.message,
                field: e.field,
                constraint: e.constraint,
              }),
              { status: 400 }
            )
          )
        )
      }
      return logError("request_failed", { error: String(e) }).pipe(
        Effect.map(() => new Response(JSON.stringify({ error: String(e) }), { status: 500 }))
      )
    })
  )

// --- Public deployment handler ---

export const handlePublicChatCompletions = (
  req: Request,
  metrics: ReturnType<typeof createPublicMetrics>,
  banManager: ReturnType<typeof createBanManager>,
  publicConfig: any
): Effect.Effect<Response, never, AdapterEnv> =>
  Effect.gen(function*() {
    // Get client IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1"

    // Check if IP is banned
    if (banManager.isBanned(ip)) {
      return new Response(
        JSON.stringify({ error: "IP address has been banned" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    }

    // Validate public API key
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const apiKey = authHeader.slice(7)
    if (apiKey !== publicConfig.publicApiKey) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    // Check IP-based rate limiting
    const rateLimiter = yield* RateLimiter
    const fairnessOk = yield* rateLimiter.checkFairnessForIp(ip)

    if (!fairnessOk) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      )
    }

    // Parse and validate request
    const body = yield* Effect.tryPromise({
      try: () => req.json() as Promise<unknown>,
      catch: () => new Error("malformed JSON"),
    })

    const params = yield* validateStreamChatParams(body)
    const strategy = privacyToStrategy(params.privacy)

    const deployment = yield* Deployment
    const useValTown = deployment.name === "production"

    const chunkStream = yield* selectAndStream(params, strategy, useValTown)

    // Get pool info for response headers
    const poolQuota = yield* rateLimiter.getIpQuota(ip, publicConfig.dailyPoolTokens)

    const responseBody = new ReadableStream({
      async start(controller) {
        try {
          let totalTokens = 0
          await Effect.runPromise(
            Stream.runForEach(chunkStream, (chunk) => {
              if (chunk.text) {
                controller.enqueue(encoder.encode(sseChunk(chunk.text, params.model)))
              }
              if (chunk.done && chunk.usage) {
                totalTokens = chunk.usage.inputTokens + chunk.usage.outputTokens
              }
              return Effect.void
            })
          )

          // Record usage synchronously after stream
          if (totalTokens > 0) {
            // Record to in-memory rate limiter
            await Effect.runPromise(rateLimiter.recordTokensForIp(ip, totalTokens))
            // Record to database
            metrics.recordUsage({
              ip,
              inputTokens: 0,
              outputTokens: totalTokens,
              model: params.model,
              costUsd: totalTokens * 0.000001,
            })
          }

          controller.enqueue(encoder.encode(sseDone))
          controller.close()
        } catch (e) {
          controller.error(e)
        }
      },
    })

    return new Response(responseBody, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-RateLimit-IpUsage": String(poolQuota.tokensUsedToday),
        "X-RateLimit-PoolRemaining": String(poolQuota.poolRemaining),
        "X-RateLimit-PoolReset": String(poolQuota.poolRemaining <= 0 ? "pool depleted" : "resets at midnight UTC"),
        "X-RateLimit-Panic": poolQuota.panic ? "true" : "false",
      },
    })
  }).pipe(
    Effect.catch((e) => {
      if (e instanceof ValidationError) {
        return logError("validation_failed", { field: e.field, constraint: e.constraint }).pipe(
          Effect.map(() =>
            new Response(
              JSON.stringify({ error: e.message, field: e.field, constraint: e.constraint }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            )
          )
        )
      }
      return logError("request_failed", { error: String(e) }).pipe(
        Effect.map(() => new Response(JSON.stringify({ error: String(e) }), { status: 500 }))
      )
    })
  )

// --- Bun server ---
// ManagedRuntime builds the layer once at server start and reuses services across
// requests — no layer traversal per request.

import indexHtml from "../index.html"
import publicLandingHtml from "../frontend/public-landing.html"

export const startServer = (adapters: Layer.Layer<AdapterEnv>, port = 3000) => {
  const runtime = ManagedRuntime.make(adapters)

  // Initialize public deployment services
  const publicMetrics = createPublicMetrics("./farmer.db")
  const banManager = createBanManager("./farmer.db")

  return Bun.serve({
    port,
    routes: {
      "/": indexHtml,
    },
    development: {
      hmr: true,
      console: true,
    },
    async fetch(req) {
      const url = new URL(req.url)

      // Check deployment mode
      const deployment = await runtime.runPromise(
        Effect.gen(function*() {
          const dep = yield* Deployment
          return dep
        })
      )

      // Public deployment routes
      if (deployment.name === "public") {
        if (req.method === "GET" && url.pathname === "/") {
          return new Response(publicLandingHtml, {
            headers: { "Content-Type": "text/html" },
          })
        }
        if (req.method === "GET" && url.pathname === "/public/stats") {
          const totalStats = publicMetrics.getTotalUsageStats(24)
          const usage = publicMetrics.getDailyUsageTrend(1)
          return new Response(
            JSON.stringify({
              poolRemaining: deployment.dailyPoolTokens! - (usage[0]?.tokens || 0),
              requestsToday: totalStats.totalRequests,
              activeIps: totalStats.uniqueIps,
              tokensUsed: usage[0]?.tokens || 0,
            }),
            { headers: { "Content-Type": "application/json" } }
          )
        }
        if (req.method === "GET" && url.pathname === "/admin/metrics") {
          const adminToken = req.headers.get("Authorization")?.slice(7)
          if (!adminToken || adminToken !== deployment.adminToken) {
            return new Response("Unauthorized", { status: 401 })
          }
          const topIps = publicMetrics.getTopIpsByUsage(20, 24)
          const banned = banManager.getBannedIps(50)
          const total = publicMetrics.getTotalUsageStats(24)
          return new Response(
            JSON.stringify({
              topIps,
              banned,
              poolRemaining: deployment.dailyPoolTokens! - (total.totalTokens || 0),
              poolTotal: deployment.dailyPoolTokens,
            }),
            { headers: { "Content-Type": "application/json" } }
          )
        }
        if (req.method === "POST" && url.pathname === "/admin/ban") {
          const adminToken = req.headers.get("Authorization")?.slice(7)
          if (!adminToken || adminToken !== deployment.adminToken) {
            return new Response("Unauthorized", { status: 401 })
          }
          try {
            const { ip, reason } = await req.json() as { ip: string; reason: string }
            banManager.ban(ip, reason, "admin")
            return new Response(JSON.stringify({ ok: true }), {
              headers: { "Content-Type": "application/json" },
            })
          } catch (e) {
            return new Response("Invalid request", { status: 400 })
          }
        }
        if (req.method === "POST" && url.pathname === "/admin/unban") {
          const adminToken = req.headers.get("Authorization")?.slice(7)
          if (!adminToken || adminToken !== deployment.adminToken) {
            return new Response("Unauthorized", { status: 401 })
          }
          try {
            const { ip } = await req.json() as { ip: string }
            banManager.unban(ip)
            return new Response(JSON.stringify({ ok: true }), {
              headers: { "Content-Type": "application/json" },
            })
          } catch (e) {
            return new Response("Invalid request", { status: 400 })
          }
        }
        if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
          return runtime.runPromise(handlePublicChatCompletions(req, publicMetrics, banManager, deployment))
        }
      }

      if (req.method === "GET" && url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
        })
      }
      if (req.method === "GET" && url.pathname === "/v1/deployment") {
        return runtime.runPromise(
          Effect.gen(function*() {
            const deployment = yield* Deployment
            const response = {
              name: deployment.name,
              apiUrl: `http://localhost:${port}`,
              features: {
                experimentalAdapters: deployment.name === "production",
                privacyModes: true,
              },
            }
            return new Response(JSON.stringify(response), {
              headers: { "Content-Type": "application/json" },
            })
          })
        )
      }
      if (req.method === "GET" && url.pathname === "/v1/placeholder") {
        return runtime.runPromise(
          Effect.gen(function*() {
            const deployment = yield* Deployment
            const html = getPlaceholderHtml(deployment.name)
            return new Response(html, {
              headers: { "Content-Type": "text/html" },
            })
          })
        )
      }
      if (req.method === "GET" && url.pathname === "/v1/privacy/info") {
        const privacyParam = url.searchParams.get("privacy")
        let privacy = 0.8

        if (privacyParam !== null) {
          const parsed = parseFloat(privacyParam)
          if (isNaN(parsed) || parsed < 0 || parsed > 1) {
            return new Response(
              JSON.stringify({ error: "privacy must be a number between 0 and 1" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            )
          }
          privacy = parsed
        }

        const strategy = privacyToStrategy(privacy)
        return new Response(
          JSON.stringify({
            privacy,
            routing: {
              anthropic: {
                probability: strategy.probabilities.anthropic,
                costMultiplier: strategy.costMultiplier,
              },
              openai: {
                probability: strategy.probabilities.openai,
                costMultiplier: strategy.costMultiplier,
              },
              openrouter: {
                probability: strategy.probabilities.openrouter,
                costMultiplier: strategy.costMultiplier,
              },
            },
          }),
          { headers: { "Content-Type": "application/json" } }
        )
      }
      if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
        return runtime.runPromise(handleChatCompletions(req))
      }
      if (req.method === "POST" && url.pathname === "/v1/keys/generate") {
        return runtime.runPromise(
          Effect.gen(function*() {
            const keyService = yield* KeyService
            const newKey = yield* keyService.generateKey()
            return new Response(JSON.stringify(newKey), {
              headers: { "Content-Type": "application/json" },
              status: 201,
            })
          })
        )
      }
      if (req.method === "GET" && url.pathname === "/v1/keys") {
        return runtime.runPromise(
          Effect.gen(function*() {
            const keyService = yield* KeyService
            const keys = yield* keyService.listKeys()
            // Don't expose full keys to the client, only show masked versions
            const maskedKeys = keys.map((k) => ({
              id: k.id,
              key: k.key.slice(0, 7) + "..." + k.key.slice(-4),
              createdAt: k.createdAt,
              lastUsed: k.lastUsed,
              revokedAt: k.revokedAt,
            }))
            return new Response(JSON.stringify(maskedKeys), {
              headers: { "Content-Type": "application/json" },
            })
          })
        )
      }
      if (req.method === "POST" && url.pathname === "/v1/keys/revoke") {
        try {
          const body = (await req.json()) as { key?: string }
          if (!body.key) {
            return new Response(
              JSON.stringify({ error: "Missing key field" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            )
          }
          return runtime.runPromise(
            Effect.gen(function*() {
              const keyService = yield* KeyService
              yield* keyService.revokeKey(body.key)
              return new Response(JSON.stringify({ ok: true }), {
                headers: { "Content-Type": "application/json" },
              })
            })
          )
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
      }
      if (req.method === "POST" && url.pathname === "/v1/keys/clear") {
        return runtime.runPromise(
          Effect.gen(function*() {
            const keyService = yield* KeyService
            yield* keyService.clearAllKeys()
            return new Response(JSON.stringify({ ok: true }), {
              headers: { "Content-Type": "application/json" },
            })
          })
        )
      }
      if (req.method === "GET" && url.pathname === "/v1/quota") {
        const authHeader = req.headers.get("authorization")
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response(
            JSON.stringify({ error: "Missing or invalid authorization header" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          )
        }
        const apiKey = authHeader.slice(7)
        return runtime.runPromise(
          Effect.gen(function*() {
            const rateLimiter = yield* RateLimiter
            const quota = yield* rateLimiter.getQuota(apiKey)
            return new Response(JSON.stringify(quota), {
              headers: { "Content-Type": "application/json" },
            })
          })
        )
      }
      if (req.method === "GET" && url.pathname.match(/^\/v1\/keys\/[^/]+\/ledger$/)) {
        const keyId = url.pathname.split("/")[3]
        return runtime.runPromise(
          Effect.gen(function*() {
            const ledger = yield* LedgerService
            const entries = yield* ledger.getKeyLedger(keyId)
            return new Response(JSON.stringify(entries), {
              headers: { "Content-Type": "application/json" },
            })
          })
        )
      }
      return new Response("Not found", { status: 404 })
    },
  })
}
