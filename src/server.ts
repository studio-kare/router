import { Effect, Layer, ManagedRuntime, Stream } from "effect"
import { AnthropicAdapter } from "./adapters/anthropic"
import { OpenAIAdapter } from "./adapters/openai"
import { OpenRouterAdapter } from "./adapters/openrouter"
import type { StreamChatParams } from "./types"
import { ValidationError } from "./types"
import { validateStreamChatParams } from "./validation"
import { logInfo, logError } from "./logging"
import { privacyToStrategy } from "./privacy"
import { Deployment } from "./deployment"

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

// --- Adapter selection (by privacy strategy, not model) ---

const selectAndStream = (params: StreamChatParams, strategy: ReturnType<typeof privacyToStrategy>) => {
  // Privacy level determines which adapter to use
  if (strategy.adapter === "anthropic") {
    return Effect.gen(function* () {
      const adapter = yield* AnthropicAdapter
      return yield* adapter.streamChat(params)
    })
  }
  if (strategy.adapter === "openai") {
    return Effect.gen(function* () {
      const adapter = yield* OpenAIAdapter
      return yield* adapter.streamChat(params)
    })
  }
  return Effect.gen(function* () {
    const adapter = yield* OpenRouterAdapter
    return yield* adapter.streamChat(params)
  })
}

// --- Handler (requires all three adapters in context) ---

export type AdapterEnv = OpenRouterAdapter | OpenAIAdapter | AnthropicAdapter | Deployment

export const handleChatCompletions = (
  req: Request
): Effect.Effect<Response, never, AdapterEnv> =>
  Effect.gen(function* () {
    const body = yield* Effect.tryPromise({
      try: () => req.json() as Promise<unknown>,
      catch: () => new Error("malformed JSON"),
    })

    const params = yield* validateStreamChatParams(body)
    const strategy = privacyToStrategy(params.privacy)

    const chunkStream = yield* selectAndStream(params, strategy)

    const responseBody = new ReadableStream({
      async start(controller) {
        try {
          await Effect.runPromise(
            Stream.runForEach(chunkStream, (chunk) => {
              if (chunk.text) {
                controller.enqueue(encoder.encode(sseChunk(chunk.text, params.model)))
              }
              return Effect.void
            })
          )
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

// --- Bun server ---
// ManagedRuntime builds the layer once at server start and reuses services across
// requests — no layer traversal per request.

export const startServer = (adapters: Layer.Layer<AdapterEnv>, port = 3000) => {
  const runtime = ManagedRuntime.make(adapters)

  return Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url)
      if (req.method === "GET" && url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
        })
      }
      if (req.method === "GET" && url.pathname === "/v1/deployment") {
        return runtime.runPromise(
          Effect.gen(function* () {
            const deployment = yield* Deployment
            return new Response(JSON.stringify(deployment), {
              headers: { "Content-Type": "application/json" },
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
      return new Response("Not found", { status: 404 })
    },
  })
}
