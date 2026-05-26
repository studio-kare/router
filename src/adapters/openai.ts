import { Context, Data, Effect, Layer, Stream } from "effect"
import OpenAI from "openai"
import type { StreamChatParams, StreamChunk } from "../types"

// --- Typed errors ---

export class OpenAIRateLimitError extends Data.TaggedError("OpenAIRateLimitError")<{
  readonly retryAfter?: number
}> {}

export class OpenAIAuthError extends Data.TaggedError("OpenAIAuthError")<{}> {}

export class OpenAIUpstreamError extends Data.TaggedError("OpenAIUpstreamError")<{
  readonly status: number
  readonly message: string
}> {}

export type OpenAIError = OpenAIRateLimitError | OpenAIAuthError | OpenAIUpstreamError

// --- Service ---

export class OpenAIAdapter extends Context.Service<
  OpenAIAdapter,
  {
    streamChat: (
      params: StreamChatParams
    ) => Effect.Effect<Stream.Stream<StreamChunk, OpenAIError>, OpenAIError>
  }
>()("OpenAIAdapter") {}

// --- Error mapping ---

const mapError = (error: unknown): OpenAIError => {
  if (error instanceof OpenAI.RateLimitError) {
    const retryAfter = error.headers?.["retry-after"]
    return new OpenAIRateLimitError({
      retryAfter: retryAfter ? parseInt(retryAfter) : undefined,
    })
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return new OpenAIAuthError()
  }
  if (error instanceof OpenAI.APIError) {
    return new OpenAIUpstreamError({ status: error.status ?? 0, message: error.message })
  }
  return new OpenAIUpstreamError({ status: 0, message: String(error) })
}

// --- Real layer ---

export const OpenAIAdapterLive = (apiKey: string) =>
  Layer.succeed(OpenAIAdapter)({
    streamChat: (params) => {
      const client = new OpenAI({ apiKey: apiKey || "missing" })
      return Effect.tryPromise({
        try: () =>
          client.chat.completions.create({
            model: params.model,
            messages: params.messages,
            stream: true,
          }),
        catch: mapError,
      }).pipe(
        Effect.map((iterable) =>
          Stream.fromAsyncIterable(iterable, (e) =>
            new OpenAIUpstreamError({ status: 0, message: String(e) })
          ).pipe(
            Stream.map((chunk) => ({
              text: chunk.choices[0]?.delta?.content ?? "",
              done: chunk.choices[0]?.finish_reason != null,
            }))
          )
        )
      )
    },
  })
