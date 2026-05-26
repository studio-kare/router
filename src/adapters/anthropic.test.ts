import { Effect, Stream } from "effect"
import { expect, test } from "bun:test"
import { AnthropicAdapter } from "./anthropic"
import { AnthropicAdapterAuthFail, AnthropicAdapterRateLimited, AnthropicAdapterTest } from "./anthropic.test-layer"

test("streams text chunks back", async () => {
  const program = Effect.gen(function* () {
    const adapter = yield* AnthropicAdapter
    const stream = yield* adapter.streamChat({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "hi" }],
    })
    const chunks = yield* Stream.runCollect(stream)
    return Array.from(chunks).map((c) => c.text).join("")
  }).pipe(Effect.provide(AnthropicAdapterTest("hello")))

  expect(await Effect.runPromise(program)).toBe("hello")
})

test("auth error is typed", async () => {
  const program = Effect.gen(function* () {
    const adapter = yield* AnthropicAdapter
    return yield* adapter.streamChat({ model: "test", messages: [] })
  }).pipe(
    Effect.catchTag("AnthropicAuthError", () => Effect.succeed("caught auth")),
    Effect.provide(AnthropicAdapterAuthFail)
  )

  expect(await Effect.runPromise(program)).toBe("caught auth")
})

test("rate limit error carries retryAfter", async () => {
  const program = Effect.gen(function* () {
    const adapter = yield* AnthropicAdapter
    return yield* adapter.streamChat({ model: "test", messages: [] })
  }).pipe(
    Effect.catchTag("AnthropicRateLimitError", ({ retryAfter }) => Effect.succeed(retryAfter)),
    Effect.provide(AnthropicAdapterRateLimited(30))
  )

  expect(await Effect.runPromise(program)).toBe(30)
})
