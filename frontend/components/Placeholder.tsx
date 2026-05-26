import React, { useEffect, useState } from "react"

export function Placeholder() {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await fetch("/v1/placeholder")
        if (res.ok) {
          const text = await res.text()
          setHtml(text)
        } else {
          setHtml("<h1>Farmer</h1><p>Try it now</p>")
        }
      } catch {
        setHtml("<h1>Farmer</h1><p>Try it now</p>")
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [])

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const res = await fetch("/v1/keys")
        if (res.ok) {
          const keys = await res.json()
          const activeKey = keys.find((k: any) => !k.revokedAt)
          if (activeKey) {
            setApiKey(activeKey.key)
          }
        }
      } catch {
        // Silent fail
      }
    }

    fetchApiKey()
  }, [])

  const curlCommand = apiKey
    ? `curl -X POST http://localhost:3000/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello, world!"}]
  }'`
    : null

  const copyCurl = async () => {
    if (curlCommand) {
      await navigator.clipboard.writeText(curlCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="placeholder">
        <h1>Farmer</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="placeholder">
      <div
        className="placeholder-content"
        dangerouslySetInnerHTML={{ __html: html || "<h1>Farmer</h1><p>Try it now</p>" }}
      />

      {curlCommand && (
        <div className="try-it-section">
          <h2>Try it Now</h2>
          <p className="try-it-description">
            Copy and paste this curl command to test the API. Watch your API key's usage ledger update in the sidebar.
          </p>
          <div className="curl-container">
            <pre className="curl-command">{curlCommand}</pre>
            <button className="copy-curl-btn" onClick={copyCurl}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
