import { Effect, Stream } from "effect"
import { expect, test } from "bun:test"
import { OpenAIAdapter } from "./openai"
import { OpenAIAdapterAuthFail, OpenAIAdapterRateLimited, OpenAIAdapterTest } from "./openai.test-layer"

test("streams text chunks back", async () => {
  const program = Effect.gen(function* () {
    const adapter = yield* OpenAIAdapter
    const stream = yield* adapter.streamChat({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
    })
    const chunks = yield* Stream.runCollect(stream)
    return Array.from(chunks).map((c) => c.text).join("")
  }).pipe(Effect.provide(OpenAIAdapterTest("hello")))

  expect(await Effect.runPromise(program)).toBe("hello")
})

test("auth error is typed", async () => {
  const program = Effect.gen(function* () {
    const adapter = yield* OpenAIAdapter
    return yield* adapter.streamChat({ model: "test", messages: [] })
  }).pipe(
    Effect.catchTag("OpenAIAuthError", () => Effect.succeed("caught auth")),
    Effect.provide(OpenAIAdapterAuthFail)
  )

  expect(await Effect.runPromise(program)).toBe("caught auth")
})

test("rate limit error carries retryAfter", async () => {
  const program = Effect.gen(function* () {
    const adapter = yield* OpenAIAdapter
    return yield* adapter.streamChat({ model: "test", messages: [] })
  }).pipe(
    Effect.catchTag("OpenAIRateLimitError", ({ retryAfter }) => Effect.succeed(retryAfter)),
    Effect.provide(OpenAIAdapterRateLimited(60))
  )

  expect(await Effect.runPromise(program)).toBe(60)
})
