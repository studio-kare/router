import { Effect, Layer } from "effect"
import { expect, test } from "bun:test"
import { AnthropicAdapterTest } from "./adapters/anthropic.test-layer"
import { OpenAIAdapterTest } from "./adapters/openai.test-layer"
import { OpenRouterAdapterTest } from "./adapters/openrouter.test-layer"
import { handleChatCompletions } from "./server"

const testAdapters = Layer.mergeAll(
  AnthropicAdapterTest("anthropic response"),
  OpenAIAdapterTest("openai response"),
  OpenRouterAdapterTest("openrouter response")
)

const makeRequest = (model: string) =>
  new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }] }),
  })

const collectSSE = async (response: Response): Promise<string> => {
  const text = await response.text()
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice(6)))
    .map((chunk) => chunk.choices[0]?.delta?.content ?? "")
    .join("")
}

test("claude model routes to Anthropic adapter", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("claude-sonnet-4-6")).pipe(Effect.provide(testAdapters))
  )
  expect(await collectSSE(response)).toBe("anthropic response")
})

test("gpt model routes to OpenAI adapter", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("gpt-4o-mini")).pipe(Effect.provide(testAdapters))
  )
  expect(await collectSSE(response)).toBe("openai response")
})

test("unknown model routes to OpenRouter adapter", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("meta-llama/llama-3.1-8b-instruct")).pipe(
      Effect.provide(testAdapters)
    )
  )
  expect(await collectSSE(response)).toBe("openrouter response")
})

test("response is SSE with correct content-type", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("gpt-4o-mini")).pipe(Effect.provide(testAdapters))
  )
  expect(response.headers.get("Content-Type")).toBe("text/event-stream")
})

test("rejects request with missing model field", async () => {
  const badRequest = new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  })
  const response = await Effect.runPromise(
    handleChatCompletions(badRequest).pipe(Effect.provide(testAdapters))
  )
  expect(response.status).toBe(400)
  const body = await response.json()
  expect(body.field).toBe("model")
})

test("rejects request with empty messages array", async () => {
  const badRequest = new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({ model: "gpt-4o", messages: [] }),
  })
  const response = await Effect.runPromise(
    handleChatCompletions(badRequest).pipe(Effect.provide(testAdapters))
  )
  expect(response.status).toBe(400)
  const body = await response.json()
  expect(body.field).toBe("messages")
})

test("rejects request with malformed message object", async () => {
  const badRequest = new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user" }] }),
  })
  const response = await Effect.runPromise(
    handleChatCompletions(badRequest).pipe(Effect.provide(testAdapters))
  )
  expect(response.status).toBe(400)
  expect((await response.json()).field).toBe("messages")
})
