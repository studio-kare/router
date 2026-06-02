import { Effect, Layer } from "effect"
import { expect, test } from "bun:test"
import { AnthropicAdapterTest } from "./adapters/anthropic.test-layer"
import { OpenAIAdapterTest } from "./adapters/openai.test-layer"
import { OpenRouterAdapterTest } from "./adapters/openrouter.test-layer"
import { handleChatCompletions } from "./server"
import { KeyServiceTest } from "./keys.test-layer"
import { RateLimiterTest } from "./rate-limit.test-layer"

const testAdapters = Layer.mergeAll(
  KeyServiceTest,
  RateLimiterTest,
  AnthropicAdapterTest("anthropic response"),
  OpenAIAdapterTest("openai response"),
  OpenRouterAdapterTest("openrouter response")
)

const VALID_TEST_KEY = "sk_test_key_valid_12345678901234"

const makeRequest = (model: string, privacy?: "cost" | "performance" | "privacy") =>
  new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VALID_TEST_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }], privacy }),
  })

const makeBadRequest = (body: any) =>
  new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VALID_TEST_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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

test("privacy mode routes to Anthropic adapter", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("claude-sonnet-4-6", "privacy")).pipe(Effect.provide(testAdapters))
  )
  expect(await collectSSE(response)).toBe("anthropic response")
})

test("performance mode routes to OpenAI adapter", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("gpt-4o-mini", "performance")).pipe(Effect.provide(testAdapters))
  )
  expect(await collectSSE(response)).toBe("openai response")
})

test("cost mode routes to OpenRouter adapter", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("meta-llama/llama-3.1-8b-instruct", "cost")).pipe(
      Effect.provide(testAdapters)
    )
  )
  expect(await collectSSE(response)).toBe("openrouter response")
})

test("default mode (no privacy param) routes to OpenAI", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("gpt-4o-mini")).pipe(Effect.provide(testAdapters))
  )
  expect(await collectSSE(response)).toBe("openai response")
})

test("response is SSE with correct content-type", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("gpt-4o-mini")).pipe(Effect.provide(testAdapters))
  )
  expect(response.headers.get("Content-Type")).toBe("text/event-stream")
})

test("rejects request with missing model field", async () => {
  const badRequest = makeBadRequest({ messages: [{ role: "user", content: "hi" }] })
  const response = await Effect.runPromise(
    handleChatCompletions(badRequest).pipe(Effect.provide(testAdapters))
  )
  expect(response.status).toBe(400)
  const body = await response.json()
  expect(body.field).toBe("model")
})

test("rejects request with empty messages array", async () => {
  const badRequest = makeBadRequest({ model: "gpt-4o", messages: [] })
  const response = await Effect.runPromise(
    handleChatCompletions(badRequest).pipe(Effect.provide(testAdapters))
  )
  expect(response.status).toBe(400)
  const body = await response.json()
  expect(body.field).toBe("messages")
})

test("rejects request with malformed message object", async () => {
  const badRequest = makeBadRequest({ model: "gpt-4o", messages: [{ role: "user" }] })
  const response = await Effect.runPromise(
    handleChatCompletions(badRequest).pipe(Effect.provide(testAdapters))
  )
  expect(response.status).toBe(400)
  expect((await response.json()).field).toBe("messages")
})

test("rejects request with invalid privacy value", async () => {
  const badRequest = makeBadRequest({
    model: "gpt-4o",
    messages: [{ role: "user", content: "hi" }],
    privacy: 0.8,
  })
  const response = await Effect.runPromise(
    handleChatCompletions(badRequest).pipe(Effect.provide(testAdapters))
  )
  expect(response.status).toBe(400)
  expect((await response.json()).field).toBe("privacy")
})

test("strategy: privacy mode routes to Anthropic", async () => {
  const { privacyToStrategy } = await import("./privacy.ts")
  const strategy = privacyToStrategy("privacy")
  expect(strategy.adapter).toBe("anthropic")
})

test("strategy: performance mode routes to OpenAI", async () => {
  const { privacyToStrategy } = await import("./privacy.ts")
  const strategy = privacyToStrategy("performance")
  expect(strategy.adapter).toBe("openai")
})

test("strategy: cost mode routes to OpenRouter", async () => {
  const { privacyToStrategy } = await import("./privacy.ts")
  const strategy = privacyToStrategy("cost")
  expect(strategy.adapter).toBe("openrouter")
})

test("strategy: default mode is performance (OpenAI)", async () => {
  const { privacyToStrategy } = await import("./privacy.ts")
  const strategy = privacyToStrategy()
  expect(strategy.adapter).toBe("openai")
})
