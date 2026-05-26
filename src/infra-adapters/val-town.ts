/**
 * Val.town Infrastructure Adapter
 *
 * Proxies chat completions to Val.town endpoints.
 * This adapter can serve ANY model by routing to the appropriate Val.town endpoint.
 *
 * Open for extension: just swap the endpoint URLs for different deployments.
 * No code changes needed to support new models or Val.town versions.
 */

import { Effect, Stream } from "effect"
import type { StreamChatParams, StreamChunk } from "../types"
import type { InfraAdapter } from "./base"

export class ValTownError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "ValTownError"
  }
}

interface ValTownConfig {
  readonly endpointUrl: string // e.g., "https://myhandle-vt-endpoint.web.val.run"
  readonly apiKey?: string // For auth if needed
}

/**
 * Create a Val.town infrastructure adapter.
 * The adapter transparently proxies to a Val.town endpoint.
 *
 * The Val.town endpoint itself can handle model-specific logic
 * and switch between different providers based on the model.
 */
export const createValTownAdapter = (config: ValTownConfig): InfraAdapter => {
  return {
    name: "ValTown",
    streamChat: (params: StreamChatParams) =>
      Effect.tryPromise({
        try: async () => {
          // Make streaming request to Val.town endpoint
          const response = await fetch(`${config.endpointUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
            },
            body: JSON.stringify(params),
          })

          if (!response.ok) {
            throw new ValTownError(response.status, `Val.town error: ${response.statusText}`)
          }

          // Parse streaming response
          const reader = response.body?.getReader()
          if (!reader) {
            throw new ValTownError(0, "No response body from Val.town")
          }

          const chunks: StreamChunk[] = []
          const decoder = new TextDecoder()
          let buffer = ""

          const readChunk = async (): Promise<void> => {
            const { done, value } = await reader.read()

            if (done) {
              return
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")

            // Process complete lines
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i].trim()

              if (line.startsWith("data: ")) {
                const data = line.slice(6)

                if (data === "[DONE]") {
                  chunks.push({ text: "", done: true })
                } else {
                  try {
                    const parsed = JSON.parse(data)
                    const content = parsed.choices?.[0]?.delta?.content ?? ""
                    const isDone = parsed.choices?.[0]?.finish_reason != null

                    chunks.push({
                      text: content,
                      done: isDone,
                      usage: parsed.usage,
                    })
                  } catch {
                    // Skip invalid JSON
                  }
                }
              }
            }

            // Keep incomplete line in buffer
            buffer = lines[lines.length - 1]

            await readChunk()
          }

          await readChunk()

          // Handle any remaining buffer
          if (buffer.trim().startsWith("data: ")) {
            const data = buffer.trim().slice(6)
            if (data !== "[DONE]") {
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content ?? ""
                chunks.push({
                  text: content,
                  done: true,
                  usage: parsed.usage,
                })
              } catch {
                // Ignore
              }
            }
          }

          return chunks
        },
        catch: (e) => {
          if (e instanceof ValTownError) {
            return e
          }
          return new ValTownError(0, `Val.town adapter error: ${String(e)}`)
        },
      }).pipe(Effect.map((chunks) => Stream.fromIterable(chunks))),
  }
}
