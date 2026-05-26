import { Effect, Layer } from "effect"
import { expect, test, describe } from "bun:test"
import { AnthropicAdapterLive } from "./adapters/anthropic"
import { OpenAIAdapterLive } from "./adapters/openai"
import { OpenRouterAdapterLive } from "./adapters/openrouter"
import { handleChatCompletions } from "./server"

const hasApiKey = !!process.env.ANTHROPIC_API_KEY

const realAdapters = Layer.mergeAll(
  AnthropicAdapterLive(process.env.ANTHROPIC_API_KEY ?? ""),
  OpenAIAdapterLive(process.env.OPENAI_API_KEY ?? ""),
  OpenRouterAdapterLive(process.env.OPENROUTER_API_KEY ?? "")
)

describe("Integration: Real Anthropic API", () => {
  test(
    hasApiKey ? "streams response from claude-sonnet-4-6" : "streams response from claude-sonnet-4-6 [SKIP: no ANTHROPIC_API_KEY]",
    async () => {
      if (!hasApiKey) {
        console.log("Skipping: ANTHROPIC_API_KEY not set")
        return
      }

    const request = new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Say 'hello world' only, nothing else." }],
        privacy: 0.95, // Very high privacy → Anthropic
      }),
    })

    const response = await Effect.runPromise(
      handleChatCompletions(request).pipe(Effect.provide(realAdapters))
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")

    // Parse SSE response
    const text = await response.text()
    const lines = text.split("\n").filter((line) => line.startsWith("data: "))

    expect(lines.length).toBeGreaterThan(1) // At least content + [DONE]

    // Verify structure of first chunk
    const firstChunk = JSON.parse(lines[0].slice(6))
    expect(firstChunk.object).toBe("chat.completion.chunk")
    expect(firstChunk.model).toContain("claude")
    expect(firstChunk.choices).toBeInstanceOf(Array)
    expect(firstChunk.choices[0].delta).toBeDefined()

    // Collect all content
    const content = lines
      .filter((line) => line !== "data: [DONE]")
      .map((line) => JSON.parse(line.slice(6)))
      .map((chunk) => chunk.choices[0]?.delta?.content ?? "")
      .join("")

    expect(content.toLowerCase()).toContain("hello world")
  })

  test(
    hasApiKey ? "detects when Anthropic contract changes" : "detects when Anthropic contract changes [SKIP: no ANTHROPIC_API_KEY]",
    async () => {
      if (!hasApiKey) {
        console.log("Skipping: ANTHROPIC_API_KEY not set")
        return
      }

      const request = new Request("http://localhost/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          messages: [{ role: "user", content: "hi" }],
          privacy: 0.95, // Very high privacy → Anthropic
        }),
      })

      const response = await Effect.runPromise(
        handleChatCompletions(request).pipe(Effect.provide(realAdapters))
      )

      const text = await response.text()
      const chunks = text
        .split("\n")
        .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
        .map((line) => JSON.parse(line.slice(6)))

      // Verify contract: each chunk should have these fields
      for (const chunk of chunks) {
        expect(chunk).toHaveProperty("id")
        expect(chunk).toHaveProperty("object")
        expect(chunk).toHaveProperty("created")
        expect(chunk).toHaveProperty("model")
        expect(chunk).toHaveProperty("choices")
        expect(Array.isArray(chunk.choices)).toBe(true)
        expect(chunk.choices[0]).toHaveProperty("delta")
      }
    }
  )
})
