import { Effect, Layer, Stream } from "effect"
import { OpenAIAdapter, OpenAIAuthError, OpenAIRateLimitError } from "./openai"
import type { StreamChunk } from "../types"

const chunksFromText = (text: string): StreamChunk[] =>
  text.split("").map((char) => ({ text: char, done: false }))

export const OpenAIAdapterTest = (response = "hello") =>
  Layer.succeed(OpenAIAdapter)({
    streamChat: (_params) => Effect.succeed(Stream.fromIterable(chunksFromText(response))),
  })

export const OpenAIAdapterAuthFail = Layer.succeed(OpenAIAdapter)({
  streamChat: (_params) => Effect.fail(new OpenAIAuthError()),
})

export const OpenAIAdapterRateLimited = (retryAfter?: number) =>
  Layer.succeed(OpenAIAdapter)({
    streamChat: (_params) => Effect.fail(new OpenAIRateLimitError({ retryAfter })),
  })
