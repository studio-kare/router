import { Effect, Layer, Stream } from "effect"
import { AnthropicAdapter, AnthropicAuthError, AnthropicRateLimitError } from "./anthropic"
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

export const AnthropicAdapterTest = (response = "hello") =>
  Layer.succeed(AnthropicAdapter)({
    streamChat: (_params) => Effect.succeed(Stream.fromIterable(chunksFromText(response))),
  })

export const AnthropicAdapterAuthFail = Layer.succeed(AnthropicAdapter)({
  streamChat: (_params) => Effect.fail(new AnthropicAuthError()),
})

export const AnthropicAdapterRateLimited = (retryAfter?: number) =>
  Layer.succeed(AnthropicAdapter)({
    streamChat: (_params) => Effect.fail(new AnthropicRateLimitError({ retryAfter })),
  })
