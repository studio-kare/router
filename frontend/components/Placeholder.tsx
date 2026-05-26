import React, { useEffect, useState } from "react"

export function Placeholder() {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [privacy, setPrivacy] = useState(0.8)

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

  const getAdapter = (p: number) => {
    if (p >= 0.85) return "anthropic"
    if (p >= 0.5) return "openai"
    return "openrouter"
  }

  const curlWithPrivacy = apiKey
    ? `curl -X POST http://localhost:3000/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-opus-4",
    "privacy": ${privacy},
    "messages": [{"role": "user", "content": "Hello, world!"}]
  }'`
    : null

  const copyCurl = async () => {
    if (curlWithPrivacy) {
      await navigator.clipboard.writeText(curlWithPrivacy)
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

      {curlWithPrivacy && (
        <div className="try-it-section">
          <h2>Try it Now</h2>

          <div className="privacy-selector">
            <div className="selector-header">
              <label htmlFor="privacy-slider">Privacy Level: {(privacy * 100).toFixed(0)}%</label>
              <span className="adapter-badge">{getAdapter(privacy)}</span>
            </div>
            <input
              id="privacy-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={privacy}
              onChange={(e) => setPrivacy(parseFloat(e.target.value))}
              className="privacy-slider-input"
            />
            <div className="privacy-legend">
              <span>0% (OpenRouter)</span>
              <span>50% (OpenAI)</span>
              <span>100% (Anthropic)</span>
            </div>
          </div>

          <div className="curl-container">
            <pre className="curl-command">{curlWithPrivacy}</pre>
            <button className="copy-curl-btn" onClick={copyCurl}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
