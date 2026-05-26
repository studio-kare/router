import { test, expect, beforeAll, afterAll } from "bun:test"
import { Layer } from "effect"
import { AnthropicAdapterLive } from "./adapters/anthropic"
import { OpenAIAdapterLive } from "./adapters/openai"
import { OpenRouterAdapterLive } from "./adapters/openrouter"
import { DevelopmentLive } from "./deployment"
import { KeyServiceLive } from "./keys"
import { startServer } from "./server"

let baseUrl: string
let server: ReturnType<typeof startServer>

beforeAll(() => {
  const adapters = Layer.mergeAll(
    DevelopmentLive,
    KeyServiceLive,
    AnthropicAdapterLive(process.env.ANTHROPIC_API_KEY ?? ""),
    OpenAIAdapterLive(process.env.OPENAI_API_KEY ?? ""),
    OpenRouterAdapterLive(process.env.OPENROUTER_API_KEY ?? "")
  )

  server = startServer(adapters, 0) // port 0 = use random free port
  baseUrl = `http://localhost:${server.port}`
})

afterAll(() => {
  server.stop()
})

test("POST /v1/keys/generate - creates new API key", async () => {
  const res = await fetch(`${baseUrl}/v1/keys/generate`, {
    method: "POST",
  })

  expect(res.status).toBe(201)

  const data = await res.json()
  expect(data.key).toMatch(/^sk_[A-Za-z0-9]{32}$/)
  expect(data.id).toBeDefined()
  expect(data.createdAt).toBeGreaterThan(0)
  expect(data.lastUsed).toBeNull()
  expect(data.revokedAt).toBeNull()
})

test("GET /v1/keys - lists keys with masking", async () => {
  // Generate a key first
  const genRes = await fetch(`${baseUrl}/v1/keys/generate`, { method: "POST" })
  const { key: fullKey } = await genRes.json()

  // List keys
  const listRes = await fetch(`${baseUrl}/v1/keys`)
  expect(listRes.status).toBe(200)

  const keys = await listRes.json()
  expect(Array.isArray(keys)).toBe(true)

  const lastKey = keys[keys.length - 1]
  // Key should be masked (sk_ + 4 chars + ... + 4 chars)
  expect(lastKey.key).toMatch(/^sk_[A-Za-z0-9]{4}\.\.\.[A-Za-z0-9]{4}$/)
  // Full key should not be exposed
  expect(lastKey.key).not.toBe(fullKey)
})

test("POST /v1/keys/revoke - revokes a key", async () => {
  // Generate a key
  const genRes = await fetch(`${baseUrl}/v1/keys/generate`, { method: "POST" })
  const { key } = await genRes.json()

  // Revoke it
  const revokeRes = await fetch(`${baseUrl}/v1/keys/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  })

  expect(revokeRes.status).toBe(200)
  const result = await revokeRes.json()
  expect(result.ok).toBe(true)

  // Try to list keys and verify it's revoked
  const listRes = await fetch(`${baseUrl}/v1/keys`)
  const keys = await listRes.json()
  const revokedKey = keys.find((k: any) => k.key.includes(key.slice(-4)))
  expect(revokedKey?.revokedAt).toBeGreaterThan(0)
})

test("POST /v1/chat/completions - rejects request without auth", async () => {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: "test" }],
    }),
  })

  expect(res.status).toBe(401)
  const data = await res.json()
  expect(data.error).toContain("authorization")
})

test("POST /v1/chat/completions - rejects request with invalid key", async () => {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": "Bearer sk_invalid_key_12345",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: "test" }],
    }),
  })

  expect(res.status).toBe(401)
  const data = await res.json()
  expect(data.error).toBe("Invalid API key")
})

test("POST /v1/chat/completions - accepts request with valid key", async () => {
  // Generate a key
  const genRes = await fetch(`${baseUrl}/v1/keys/generate`, { method: "POST" })
  const { key } = await genRes.json()

  // Make chat request with the key
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: "test" }],
    }),
  })

  // Should not be 401 (auth error) - will fail with adapter error since no real API keys
  expect(res.status).not.toBe(401)
})

test("GET /v1/deployment - returns deployment info", async () => {
  const res = await fetch(`${baseUrl}/v1/deployment`)

  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.name).toBe("development")
  expect(data.apiUrl).toBeDefined()
  expect(data.features).toBeDefined()
})

test("GET /v1/privacy/info - returns privacy routing", async () => {
  const res = await fetch(`${baseUrl}/v1/privacy/info?privacy=0.8`)

  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.privacy).toBe(0.8)
  expect(data.routing).toBeDefined()
  expect(data.routing.anthropic).toBeDefined()
  expect(data.routing.openai).toBeDefined()
  expect(data.routing.openrouter).toBeDefined()
})

test("GET /health - returns health status", async () => {
  const res = await fetch(`${baseUrl}/health`)

  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.status).toBe("ok")
})
