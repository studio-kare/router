import { Effect, Layer } from "effect"
import { expect, test } from "bun:test"
import { handleChatCompletions } from "./server"
import { KeyServiceTest } from "./keys.test-layer"
import { RateLimiterTest } from "./rate-limit.test-layer"
import { AnthropicAdapterTest } from "./adapters/anthropic.test-layer"
import { OpenAIAdapterTest } from "./adapters/openai.test-layer"
import { OpenRouterAdapterTest } from "./adapters/openrouter.test-layer"

const testAdapters = Layer.mergeAll(
  KeyServiceTest,
  RateLimiterTest,
  AnthropicAdapterTest("test response"),
  OpenAIAdapterTest("test response"),
  OpenRouterAdapterTest("test response")
)

const VALID_TEST_KEY = "sk_test_key_valid_12345678901234"

const makeRequest = (model: string, privacy?: number) =>
  new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VALID_TEST_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "test message" }], privacy }),
  })

test("token tracking: records tokens after successful streaming", async () => {
  // Make request and consume response to trigger token recording
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("gpt-4")).pipe(Effect.provide(testAdapters))
  )

  expect(response.status).toBe(200)

  // Consume the response body to trigger streaming and token recording
  const responseText = await response.text()
  expect(responseText.length).toBeGreaterThan(0)
  expect(responseText).toContain("[DONE]")
})

test("token tracking: response includes SSE chunks with content", async () => {
  const response = await Effect.runPromise(
    handleChatCompletions(makeRequest("gpt-4")).pipe(Effect.provide(testAdapters))
  )

  const text = await response.text()
  expect(text).toContain("data: ")
  expect(text).toContain("[DONE]")
  // Response contains all characters of "test response" (as individual delta chunks)
  expect(text).toContain(`"content":"t"`)
  expect(text).toContain(`"content":"e"`)
  expect(text).toContain(`"content":"s"`)
  expect(text).toContain(`"content":"p"`)
})
