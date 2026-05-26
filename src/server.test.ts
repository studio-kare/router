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

const makeRequest = (model: string, privacy?: number) =>
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

test("high privacy (0.9) routes to Anthropic adapter", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("claude-sonnet-4-6", 0.9)).pipe(Effect.provide(testAdapters))
  )
  expect(await collectSSE(response)).toBe("anthropic response")
})

test("medium privacy (0.6) routes to OpenAI adapter", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("gpt-4o-mini", 0.6)).pipe(Effect.provide(testAdapters))
  )
  expect(await collectSSE(response)).toBe("openai response")
})

test("low privacy (0.2) routes to OpenRouter adapter", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("meta-llama/llama-3.1-8b-instruct", 0.2)).pipe(
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

test("privacy info: high privacy routes to Anthropic", async () => {
  const { privacyToStrategy } = await import("./privacy.ts")
  const strategy = privacyToStrategy(0.9)
  expect(strategy.adapter).toBe("anthropic")
  expect(strategy.probabilities.anthropic).toBe(1.0)
  expect(strategy.probabilities.openai).toBe(0.0)
  expect(strategy.probabilities.openrouter).toBe(0.0)
})

test("privacy info: medium privacy routes to OpenAI", async () => {
  const { privacyToStrategy } = await import("./privacy.ts")
  const strategy = privacyToStrategy(0.6)
  expect(strategy.adapter).toBe("openai")
  expect(strategy.probabilities.openai).toBe(1.0)
  expect(strategy.probabilities.anthropic).toBe(0.0)
  expect(strategy.probabilities.openrouter).toBe(0.0)
})

test("privacy info: low privacy routes to OpenRouter", async () => {
  const { privacyToStrategy } = await import("./privacy.ts")
  const strategy = privacyToStrategy(0.2)
  expect(strategy.adapter).toBe("openrouter")
  expect(strategy.probabilities.openrouter).toBe(1.0)
  expect(strategy.probabilities.anthropic).toBe(0.0)
  expect(strategy.probabilities.openai).toBe(0.0)
})

test("privacy info: default privacy is 0.8", async () => {
  const { privacyToStrategy } = await import("./privacy.ts")
  const strategy = privacyToStrategy()
  expect(strategy.adapter).toBe("openai") // 0.8 is in OpenAI range [0.5, 0.85)
  expect(strategy.probabilities.openai).toBe(1.0)
})
