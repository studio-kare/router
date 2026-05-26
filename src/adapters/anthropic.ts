import Anthropic from "@anthropic-ai/sdk"
import { Context, Data, Effect, Layer, Stream } from "effect"
import type { StreamChatParams, StreamChunk } from "../types"

// --- Typed errors ---

export class AnthropicRateLimitError extends Data.TaggedError("AnthropicRateLimitError")<{
  readonly retryAfter?: number
}> {}

export class AnthropicAuthError extends Data.TaggedError("AnthropicAuthError")<{}> {}

export class AnthropicUpstreamError extends Data.TaggedError("AnthropicUpstreamError")<{
  readonly status: number
  readonly message: string
}> {}

export type AnthropicError =
  | AnthropicRateLimitError
  | AnthropicAuthError
  | AnthropicUpstreamError

// --- Service ---

export class AnthropicAdapter extends Context.Service<
  AnthropicAdapter,
  {
    streamChat: (
      params: StreamChatParams
    ) => Effect.Effect<Stream.Stream<StreamChunk, AnthropicError>, AnthropicError>
  }
>()("AnthropicAdapter") {}

// --- Helpers ---

const mapError = (error: unknown): AnthropicError => {
  if (error instanceof Anthropic.RateLimitError) {
    const retryAfter = error.headers?.["retry-after"]
    return new AnthropicRateLimitError({
      retryAfter: retryAfter ? parseInt(retryAfter) : undefined,
    })
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new AnthropicAuthError()
  }
  if (error instanceof Anthropic.APIError) {
    return new AnthropicUpstreamError({ status: error.status ?? 0, message: error.message })
  }
  return new AnthropicUpstreamError({ status: 0, message: String(error) })
}

// OpenAI-style messages → Anthropic format
const toAnthropicMessages = (
  messages: StreamChatParams["messages"]
): { system?: string; messages: Anthropic.MessageParam[] } => {
  const system = messages.find((m) => m.role === "system")
  const rest = messages.filter((m) => m.role !== "system")
  return {
    system: system && typeof system.content === "string" ? system.content : undefined,
    messages: rest
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: typeof m.content === "string" ? m.content : "",
      })),
  }
}

// --- Real layer ---

export const AnthropicAdapterLive = (apiKey: string) =>
  Layer.succeed(AnthropicAdapter)({
    streamChat: (params) => {
      const client = new Anthropic({ apiKey: apiKey || "missing" })
      const { system, messages } = toAnthropicMessages(params.messages)

      return Effect.tryPromise({
        try: async () => {
          const stream = await client.messages.create({
            model: params.model,
            max_tokens: 1024,
            system,
            messages,
            stream: true,
          })

          const chunks: StreamChunk[] = []
          let usage: { inputTokens: number; outputTokens: number } | undefined

          for await (const event of stream) {
            if (event.type === "message_start" && event.message.usage) {
              usage = {
                inputTokens: event.message.usage.input_tokens,
                outputTokens: event.message.usage.output_tokens,
              }
            }
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              chunks.push({ text: event.delta.text, done: false })
            }
            if (event.type === "message_stop") {
              chunks.push({ text: "", done: true, usage })
            }
          }
          return chunks
        },
        catch: mapError,
      }).pipe(Effect.map((chunks) => Stream.fromIterable(chunks)))
    },
  })
