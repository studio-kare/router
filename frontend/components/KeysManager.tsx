import React, { useState } from "react"
import type { ApiKeyInfo } from "../types"

export function KeysManager() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)

  const fetchKeys = async () => {
    setLoading(true)
    try {
      const res = await fetch("/v1/keys")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setKeys(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const generateKey = async () => {
    setGenerating(true)
    try {
      const res = await fetch("/v1/keys/generate", { method: "POST" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setNewKey(data.key)
      await fetchKeys()
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const revokeKey = async (key: string) => {
    try {
      const res = await fetch("/v1/keys/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchKeys()
    } catch (e) {
      console.error(e)
    }
  }

  const clearAllKeys = async () => {
    if (!confirm("Are you sure you want to revoke all API keys? This cannot be undone.")) {
      return
    }
    setClearing(true)
    try {
      const res = await fetch("/v1/keys/clear", { method: "POST" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchKeys()
      setNewKey(null)
    } catch (e) {
      console.error(e)
    } finally {
      setClearing(false)
    }
  }

  const copyToClipboard = async () => {
    if (newKey) {
      await navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  React.useEffect(() => {
    fetchKeys()
  }, [])

  return (
    <div className="keys-section">
      <div className="keys-header">
        <span className="keys-label">API Keys</span>
        <div className="keys-actions">
          <button
            className="generate-btn"
            onClick={generateKey}
            disabled={generating}
            title="Generate new API key"
          >
            {generating ? "..." : "+"}
          </button>
          {keys.some((k) => !k.revokedAt) && (
            <button
              className="clear-btn"
              onClick={clearAllKeys}
              disabled={clearing}
              title="Revoke all API keys"
            >
              ⊘
            </button>
          )}
        </div>
      </div>

      {newKey && (
        <div className="new-key-alert">
          <div className="new-key-label">New Key Generated</div>
          <div className="new-key-value">{newKey}</div>
          <button className="copy-btn" onClick={copyToClipboard}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {loading && <div className="keys-loading">Loading...</div>}

      {!loading && keys.length === 0 && (
        <div className="keys-empty">No keys yet. Create one to get started.</div>
      )}

      {!loading && keys.length > 0 && (
        <>
          <div className="keys-list">
            {keys.map((k) => (
              <div
                key={k.id}
                className={`key-item ${k.revokedAt ? "revoked" : ""} ${selectedKeyId === k.id ? "selected" : ""}`}
                onClick={() => setSelectedKeyId(selectedKeyId === k.id ? null : k.id)}
                style={{ cursor: "pointer" }}
              >
                <div className="key-info">
                  <div className="key-display">{k.key}</div>
                  <div className="key-meta">
                    {k.revokedAt ? (
                      <span className="key-status revoked">Revoked</span>
                    ) : (
                      <>
                        <span className="key-status active">Active</span>
                        {k.lastUsed && (
                          <span className="key-lastused">
                            Last used: {new Date(k.lastUsed).toLocaleDateString()}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {!k.revokedAt && (
                  <button
                    className="revoke-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      revokeKey(k.key)
                    }}
                    title="Revoke this key"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {selectedKeyId && keys.find((k) => k.id === selectedKeyId) ? (() => {
            const k = keys.find((k) => k.id === selectedKeyId)!
            return (
              <div className="key-details">
                <div className="details-header">
                  <h3>Key Details</h3>
                  <button
                    className="close-btn"
                    onClick={() => setSelectedKeyId(null)}
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="details-content">
                  <div className="detail-row">
                    <span className="detail-label">Key:</span>
                    <span className="detail-value">{k.key}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">ID:</span>
                    <span className="detail-value">{k.id}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Created:</span>
                    <span className="detail-value">
                      {new Date(k.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {k.lastUsed && (
                    <div className="detail-row">
                      <span className="detail-label">Last Used:</span>
                      <span className="detail-value">
                        {new Date(k.lastUsed).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {k.revokedAt && (
                    <div className="detail-row">
                      <span className="detail-label">Revoked:</span>
                      <span className="detail-value">
                        {new Date(k.revokedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })() : null}
        </>
      )}
    </div>
  )
}
