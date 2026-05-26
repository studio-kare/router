import { Context, Data, Effect, Layer, Stream } from "effect"
import OpenAI from "openai"
import type { StreamChatParams, StreamChunk } from "../types"

// --- Typed errors ---

export class OpenRouterRateLimitError extends Data.TaggedError("OpenRouterRateLimitError")<{
  readonly retryAfter?: number
}> {}

export class OpenRouterAuthError extends Data.TaggedError("OpenRouterAuthError")<{}> {}

export class OpenRouterUpstreamError extends Data.TaggedError("OpenRouterUpstreamError")<{
  readonly status: number
  readonly message: string
}> {}

export type OpenRouterError =
  | OpenRouterRateLimitError
  | OpenRouterAuthError
  | OpenRouterUpstreamError

// --- Service ---

export class OpenRouterAdapter extends Context.Service<
  OpenRouterAdapter,
  {
    streamChat: (
      params: StreamChatParams
    ) => Effect.Effect<Stream.Stream<StreamChunk, OpenRouterError>, OpenRouterError>
  }
>()("OpenRouterAdapter") {}

// --- Error mapping ---

const mapError = (error: unknown): OpenRouterError => {
  if (error instanceof OpenAI.RateLimitError) {
    const retryAfter = error.headers?.["retry-after"]
    return new OpenRouterRateLimitError({
      retryAfter: retryAfter ? parseInt(retryAfter) : undefined,
    })
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return new OpenRouterAuthError()
  }
  if (error instanceof OpenAI.APIError) {
    return new OpenRouterUpstreamError({ status: error.status ?? 0, message: error.message })
  }
  return new OpenRouterUpstreamError({ status: 0, message: String(error) })
}

// --- Real layer ---

export const OpenRouterAdapterLive = (apiKey: string) =>
  Layer.succeed(OpenRouterAdapter)({
    streamChat: (params) => {
      const client = new OpenAI({
        apiKey: apiKey || "missing",
        baseURL: "https://openrouter.ai/api/v1",
      })
      return Effect.tryPromise({
        try: () =>
          client.chat.completions.create({
            model: params.model,
            messages: params.messages,
            stream: true,
          }),
        catch: mapError,
      }).pipe(
        Effect.map((iterable) => {
          let outputText = ""
          return Stream.fromAsyncIterable(iterable, (e) =>
            new OpenRouterUpstreamError({ status: 0, message: String(e) })
          ).pipe(
            Stream.map((chunk) => {
              const text = chunk.choices[0]?.delta?.content ?? ""
              outputText += text
              const isDone = chunk.choices[0]?.finish_reason != null

              // Estimate tokens (rough heuristic: ~4 chars = 1 token)
              const usage = isDone
                ? {
                    inputTokens: Math.ceil(params.messages.reduce((acc, m) => acc + String(m.content).length, 0) / 4),
                    outputTokens: Math.ceil(outputText.length / 4),
                  }
                : undefined

              return {
                text,
                done: isDone,
                usage,
              }
            })
          )
        })
      )
    },
  })
