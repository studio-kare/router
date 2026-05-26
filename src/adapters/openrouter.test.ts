import { Effect, Stream } from "effect"
import { expect, test } from "bun:test"
import { OpenRouterAdapter } from "./openrouter"
import { OpenRouterAdapterAuthFail, OpenRouterAdapterRateLimited, OpenRouterAdapterTest } from "./openrouter.test-layer"

test("streams text chunks back", async () => {
  const program = Effect.gen(function* () {
    const adapter = yield* OpenRouterAdapter
    const stream = yield* adapter.streamChat({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
    })
    const chunks = yield* Stream.runCollect(stream)
    return Array.from(chunks).map((c) => c.text).join("")
  }).pipe(Effect.provide(OpenRouterAdapterTest("hello")))

  expect(await Effect.runPromise(program)).toBe("hello")
})

test("auth error is typed", async () => {
  const program = Effect.gen(function* () {
    const adapter = yield* OpenRouterAdapter
    return yield* adapter.streamChat({ model: "test", messages: [] })
  }).pipe(
    Effect.catchTag("OpenRouterAuthError", () => Effect.succeed("caught auth")),
    Effect.provide(OpenRouterAdapterAuthFail)
  )

  expect(await Effect.runPromise(program)).toBe("caught auth")
})

test("rate limit error carries retryAfter", async () => {
  const program = Effect.gen(function* () {
    const adapter = yield* OpenRouterAdapter
    return yield* adapter.streamChat({ model: "test", messages: [] })
  }).pipe(
    Effect.catchTag("OpenRouterRateLimitError", ({ retryAfter }) => Effect.succeed(retryAfter)),
    Effect.provide(OpenRouterAdapterRateLimited(30))
  )

  expect(await Effect.runPromise(program)).toBe(30)
})
