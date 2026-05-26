/**
 * Farmer Val.town Endpoint
 *
 * This HTTP endpoint handles chat completions by routing to the appropriate
 * LLM provider (Anthropic, OpenAI, OpenRouter) based on the model name.
 *
 * Deploy to Val.town:
 * 1. Create new HTTP val
 * 2. Copy this code
 * 3. Set environment variables (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
 * 4. Get endpoint URL
 * 5. Use in Farmer as infrastructure provider
 *
 * Attribution:
 * - All usage is tracked under your Val.town account
 * - Perfect for marketing attribution with Steve
 * - Users can fork/eject by deploying their own copy
 */

import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"

// Type definitions
interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
}

interface StreamChunk {
  text: string
  done: boolean
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

// Model provider registry (same as Farmer)
type ModelProvider = "anthropic" | "openai" | "openrouter"

interface ModelInfo {
  provider: ModelProvider
  maxTokens: number
}

const MODELS: Record<string, ModelInfo> = {
  // Anthropic
  "claude-3.5-sonnet": { provider: "anthropic", maxTokens: 200000 },
  "claude-3.5-haiku": { provider: "anthropic", maxTokens: 200000 },
  "claude-3-opus": { provider: "anthropic", maxTokens: 200000 },
  "claude-3-sonnet": { provider: "anthropic", maxTokens: 200000 },

  // OpenAI
  "gpt-4": { provider: "openai", maxTokens: 8192 },
  "gpt-4-turbo": { provider: "openai", maxTokens: 128000 },
  "gpt-4o": { provider: "openai", maxTokens: 128000 },
  "gpt-4o-mini": { provider: "openai", maxTokens: 128000 },

  // OpenRouter
  "meta-llama/llama-3.1-8b-instruct": {
    provider: "openrouter",
    maxTokens: 131072,
  },
}

const getModelProvider = (modelName: string): ModelProvider | null => {
  return MODELS[modelName]?.provider ?? null
}

// SDK clients (lazy initialized)
let anthropicClient: Anthropic | null = null
let openaiClient: OpenAI | null = null
let openrouterClient: OpenAI | null = null

const getAnthropicClient = () => {
  if (!anthropicClient) {
    const apiKey = Bun.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set")
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

const getOpenAIClient = () => {
  if (!openaiClient) {
    const apiKey = Bun.env.OPENAI_API_KEY
    if (!apiKey) throw new Error("OPENAI_API_KEY not set")
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

const getOpenRouterClient = () => {
  if (!openrouterClient) {
    const apiKey = Bun.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set")
    openrouterClient = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    })
  }
  return openrouterClient
}

// Streaming handlers
async function* streamFromAnthropic(
  params: ChatCompletionRequest
): AsyncGenerator<StreamChunk> {
  const client = getAnthropicClient()

  // Extract system message
  const system = params.messages.find((m) => m.role === "system")
  const rest = params.messages.filter((m) => m.role !== "system")

  const stream = await client.messages.create({
    model: params.model,
    max_tokens: params.max_tokens || 1024,
    system: system?.content,
    messages: rest
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    stream: true,
  })

  let usage: { inputTokens: number; outputTokens: number } | undefined

  for await (const event of stream) {
    if (event.type === "message_start" && event.message.usage) {
      usage = {
        inputTokens: event.message.usage.input_tokens,
        outputTokens: event.message.usage.output_tokens,
      }
    }

    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { text: event.delta.text, done: false }
    }

    if (event.type === "message_stop") {
      yield { text: "", done: true, usage }
    }
  }
}

async function* streamFromOpenAI(
  params: ChatCompletionRequest,
  baseURL?: string
): AsyncGenerator<StreamChunk> {
  const client = baseURL === "https://openrouter.ai/api/v1" ? getOpenRouterClient() : getOpenAIClient()

  const iterable = await client.chat.completions.create({
    model: params.model,
    messages: params.messages,
    stream: true,
  })

  let outputText = ""

  for await (const chunk of iterable) {
    const text = chunk.choices[0]?.delta?.content ?? ""
    outputText += text
    const isDone = chunk.choices[0]?.finish_reason != null

    yield {
      text,
      done: isDone,
      usage: isDone
        ? {
            inputTokens: Math.ceil(
              params.messages.reduce((acc, m) => acc + m.content.length, 0) / 4
            ),
            outputTokens: Math.ceil(outputText.length / 4),
          }
        : undefined,
    }
  }
}

// SSE response builder
function buildSSEResponse(asyncIterator: AsyncIterable<StreamChunk>) {
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of asyncIterator) {
            const data = {
              id: `vt-${Date.now()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              choices: [
                {
                  index: 0,
                  delta: { content: chunk.text },
                  finish_reason: chunk.done ? "stop" : null,
                },
              ],
              ...(chunk.usage && { usage: chunk.usage }),
            }

            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))

            if (chunk.done) {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
              break
            }
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    }
  )
}

// Error response
function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// Main handler
export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)

  // Health check
  if (req.method === "GET" && url.pathname === "/health") {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" },
    })
  }

  // Chat completions endpoint
  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    try {
      const body = await req.json() as ChatCompletionRequest

      // Validate
      if (!body.model) {
        return errorResponse(400, "Missing required field: model")
      }
      if (!body.messages || !Array.isArray(body.messages)) {
        return errorResponse(400, "Missing required field: messages")
      }

      // Get model provider
      const provider = getModelProvider(body.model)
      if (!provider) {
        return errorResponse(400, `Unknown model: ${body.model}`)
      }

      // Route to appropriate provider
      let streamIterator: AsyncGenerator<StreamChunk>

      if (provider === "anthropic") {
        streamIterator = streamFromAnthropic(body)
      } else if (provider === "openai") {
        streamIterator = streamFromOpenAI(body)
      } else {
        // openrouter
        streamIterator = streamFromOpenAI(body, "https://openrouter.ai/api/v1")
      }

      return buildSSEResponse(streamIterator)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (message.includes("API key")) {
        return errorResponse(500, `Missing API key: ${message}`)
      }

      return errorResponse(500, `Error: ${message}`)
    }
  }

  // Models endpoint (optional - useful for discovery)
  if (req.method === "GET" && url.pathname === "/v1/models") {
    return new Response(JSON.stringify({ models: Object.keys(MODELS) }), {
      headers: { "Content-Type": "application/json" },
    })
  }

  return errorResponse(404, "Not found")
}
