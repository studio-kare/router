import { test, expect } from "bun:test"

const BASE_URL = process.env.E2E_BASE_URL || "https://router.studiokare.nl"

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
