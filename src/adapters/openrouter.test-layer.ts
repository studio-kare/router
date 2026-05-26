import { Effect, Layer, Stream } from "effect"
import { OpenRouterAdapter, OpenRouterAuthError, OpenRouterRateLimitError } from "./openrouter"
import type { StreamChunk } from "../types"

const chunksFromText = (text: string): StreamChunk[] => {
  const chunks = text.split("").map((char) => ({ text: char, done: false }))
  // Add final chunk with done: true and mock usage
  chunks.push({
    text: "",
    done: true,
    usage: { inputTokens: 10, outputTokens: text.length },
  })
  return chunks
}

export const OpenRouterAdapterTest = (response = "hello") =>
  Layer.succeed(OpenRouterAdapter)({
    streamChat: (_params) => Effect.succeed(Stream.fromIterable(chunksFromText(response))),
  })

export const OpenRouterAdapterAuthFail = Layer.succeed(OpenRouterAdapter)({
  streamChat: (_params) => Effect.fail(new OpenRouterAuthError()),
})

export const OpenRouterAdapterRateLimited = (retryAfter?: number) =>
  Layer.succeed(OpenRouterAdapter)({
    streamChat: (_params) => Effect.fail(new OpenRouterRateLimitError({ retryAfter })),
  })
