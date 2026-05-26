/**
 * Direct API Infrastructure Adapter
 * Makes direct calls to model provider APIs (Anthropic, OpenAI, OpenRouter)
 * via their SDKs.
 */

import { Context, Data, Effect, Layer, Stream } from "effect"
import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import type { StreamChatParams, StreamChunk } from "../types"
import type { ModelProvider } from "../model-registry"
import { getModelProvider } from "../model-registry"
import type { InfraAdapter } from "./base"

// --- Error types ---

export class DirectAPIError extends Data.TaggedError("DirectAPIError")<{
  readonly provider: ModelProvider
  readonly status?: number
  readonly message: string
}> {}

// --- Direct API Adapter ---

export class DirectAPIAdapterService extends Context.Service<
  DirectAPIAdapterService,
  {
    readonly adapter: InfraAdapter
  }
>()("DirectAPIAdapterService") {}

const createDirectAPIAdapter = (
  anthropicKey: string,
  openaiKey: string,
  openrouterKey: string
): InfraAdapter => {
  const clients = {
    anthropic: new Anthropic({ apiKey: anthropicKey || "missing" }),
    openai: new OpenAI({ apiKey: openaiKey || "missing" }),
    openrouter: new OpenAI({
      apiKey: openrouterKey || "missing",
      baseURL: "https://openrouter.ai/api/v1",
    }),
  }

  const streamChatAnthropic = (params: StreamChatParams) =>
    Effect.tryPromise({
      try: async () => {
        // Extract system message
        const system = params.messages.find((m) => m.role === "system")
        const rest = params.messages.filter((m) => m.role !== "system")

        const stream = await clients.anthropic.messages.create({
          model: params.model,
          max_tokens: 1024,
          system: system && typeof system.content === "string" ? system.content : undefined,
          messages: rest
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: typeof m.content === "string" ? m.content : "",
            })),
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
      catch: (e) => {
        const message = e instanceof Error ? e.message : String(e)
        return new DirectAPIError({
          provider: "anthropic",
          message,
          status: e instanceof Anthropic.APIError ? e.status : undefined,
        })
      },
    }).pipe(Effect.map((chunks) => Stream.fromIterable(chunks)))

  const streamChatOpenAILike = (baseURL?: string) => (params: StreamChatParams) =>
    Effect.tryPromise({
      try: async () => {
        const client =
          baseURL === "https://openrouter.ai/api/v1"
            ? clients.openrouter
            : clients.openai

        const iterable = await client.chat.completions.create({
          model: params.model,
          messages: params.messages,
          stream: true,
        })

        let outputText = ""
        const chunks: StreamChunk[] = []

        for await (const chunk of iterable) {
          const text = chunk.choices[0]?.delta?.content ?? ""
          outputText += text
          const isDone = chunk.choices[0]?.finish_reason != null

          chunks.push({
            text,
            done: isDone,
            usage: isDone
              ? {
                  inputTokens: Math.ceil(
                    params.messages.reduce((acc, m) => acc + String(m.content).length, 0) / 4
                  ),
                  outputTokens: Math.ceil(outputText.length / 4),
                }
              : undefined,
          })
        }

        return chunks
      },
      catch: (e) => {
        const message = e instanceof Error ? e.message : String(e)
        return new DirectAPIError({
          provider: baseURL === "https://openrouter.ai/api/v1" ? "openrouter" : "openai",
          message,
          status: e instanceof OpenAI.APIError ? e.status : undefined,
        })
      },
    }).pipe(Effect.map((chunks) => Stream.fromIterable(chunks)))

  return {
    name: "DirectAPI",
    streamChat: (params: StreamChatParams) => {
      const provider = getModelProvider(params.model)

      if (provider === "anthropic") {
        return streamChatAnthropic(params)
      }

      if (provider === "openai") {
        return streamChatOpenAILike()(params)
      }

      if (provider === "openrouter") {
        return streamChatOpenAILike("https://openrouter.ai/api/v1")(params)
      }

      return Effect.fail(
        new DirectAPIError({
          provider: "openrouter", // fallback
          message: `Unknown model provider for model: ${params.model}`,
        })
      )
    },
  }
}

export const DirectAPIAdapterLive = (
  anthropicKey: string,
  openaiKey: string,
  openrouterKey: string
) =>
  Layer.succeed(DirectAPIAdapterService)({
    adapter: createDirectAPIAdapter(anthropicKey, openaiKey, openrouterKey),
  })
