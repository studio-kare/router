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

  // Use it for a chat completion
  const chatRes = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${newKey.key}`,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      privacy: 1.0,
      messages: [{ role: "user", content: "Reply with exactly: pong" }],
    }),
  })
  expect(chatRes.status).toBe(200)
  expect(chatRes.headers.get("content-type")).toBe("text/event-stream")
  const chatText = await chatRes.text()
  expect(chatText).toContain("[DONE]")

  // Revoke
  const revokeRes = await authed("/v1/keys/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: newKey.key }),
  })
  expect(revokeRes.status).toBe(200)

  // Verify revoked key can't be used
  const chatRes2 = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${newKey.key}`,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      privacy: 1.0,
      messages: [{ role: "user", content: "ping" }],
    }),
  })
  expect(chatRes2.status).toBe(401)
}, 30000)

test("admin metrics requires auth", async () => {
  const res = await fetch(`${BASE_URL}/admin/metrics`)
  expect(res.status).toBe(401)
})

test("admin metrics accessible with public key", async () => {
  const res = await fetch(`${BASE_URL}/admin/metrics`, {
    headers: { Authorization: `Bearer ${PUBLIC_API_KEY}` },
  })
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.topIps).toBeDefined()
  expect(body.poolTotal).toBeDefined()
})

test("admin ban and unban with public key", async () => {
  const testIp = "192.0.2.1" // TEST-NET, safe to use

  // Ban
  const banRes = await fetch(`${BASE_URL}/admin/ban`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PUBLIC_API_KEY}`,
    },
    body: JSON.stringify({ ip: testIp, reason: "e2e test" }),
  })
  expect(banRes.status).toBe(200)

  // Verify banned in metrics
  const metricsRes = await fetch(`${BASE_URL}/admin/metrics`, {
    headers: { Authorization: `Bearer ${PUBLIC_API_KEY}` },
  })
  const metrics = await metricsRes.json()
  expect(metrics.banned.some((b: any) => b.ipAddress === testIp)).toBe(true)

  // Unban
  const unbanRes = await fetch(`${BASE_URL}/admin/unban`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PUBLIC_API_KEY}`,
    },
    body: JSON.stringify({ ip: testIp }),
  })
  expect(unbanRes.status).toBe(200)
})
