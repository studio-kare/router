import { test, expect } from "bun:test"

const BASE_URL = process.env.E2E_BASE_URL || "https://router.studiokare.nl"
const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY || "sk_public_417cc657a0c1219b5b996082002b7717767fd61fe4494068"

test("homepage returns 200 with HTML", async () => {
  const res = await fetch(BASE_URL)
  expect(res.status).toBe(200)
  expect(res.headers.get("content-type")).toContain("text/html")
})

test("homepage contains expected elements", async () => {
  const res = await fetch(BASE_URL)
  const html = await res.text()
  expect(html).toContain("<title>Farmer</title>")
  expect(html).toContain('<div id="root">')
  expect(html).toContain('<script type="module"')
})

test("health endpoint returns ok", async () => {
  const res = await fetch(`${BASE_URL}/health`)
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.status).toBe("ok")
})

test("chat completions rejects missing auth", async () => {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "ping" }],
    }),
  })
  expect(res.status).toBe(401)
})

test("chat completions rejects invalid key", async () => {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer sk_invalid_key",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "ping" }],
    }),
  })
  expect(res.status).toBe(401)
})

test("chat completions streams response with public key", async () => {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PUBLIC_API_KEY}`,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      privacy: 1.0,
      messages: [{ role: "user", content: "Reply with exactly: pong" }],
    }),
  })
  expect(res.status).toBe(200)
  expect(res.headers.get("content-type")).toBe("text/event-stream")

  const text = await res.text()
  expect(text).toContain("data: ")
  expect(text).toContain("[DONE]")
}, 30000)

test("key management requires auth", async () => {
  const res = await fetch(`${BASE_URL}/v1/keys/generate`, { method: "POST" })
  expect(res.status).toBe(401)
})

test("create key, list it, use it, and revoke it", async () => {
  const authed = (path: string, opts: RequestInit = {}) =>
    fetch(`${BASE_URL}${path}`, {
      ...opts,
      headers: {
        ...(opts.headers as Record<string, string>),
        Authorization: `Bearer ${PUBLIC_API_KEY}`,
      },
    })

  // Create
  const createRes = await authed("/v1/keys/generate", { method: "POST" })
  expect(createRes.status).toBe(201)
  const newKey = await createRes.json()
  expect(newKey.key).toStartWith("sk_")

  // List
  const listRes = await authed("/v1/keys")
  expect(listRes.status).toBe(200)
  const keys = await listRes.json()
  expect(keys.some((k: any) => k.id === newKey.id)).toBe(true)

  // Revoke
  const revokeRes = await authed("/v1/keys/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: newKey.key }),
  })
  expect(revokeRes.status).toBe(200)

  // Verify revoked
  const listRes2 = await authed("/v1/keys")
  const keys2 = await listRes2.json()
  const revoked = keys2.find((k: any) => k.id === newKey.id)
  expect(revoked.revokedAt).not.toBeNull()
}, 15000)
