import React, { useEffect, useState } from "react"
import type { PrivacyInfo } from "../types"

export function PrivacySlider() {
  const [privacy, setPrivacy] = useState(0.8)
  const [privacyInfo, setPrivacyInfo] = useState<PrivacyInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchPrivacy = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/v1/privacy/info?privacy=${privacy}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setPrivacyInfo(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    fetchPrivacy()
  }, [privacy])

  const getPrivacyLabel = (value: number): string => {
    if (value < 0.3) return "Public"
    if (value < 0.6) return "Balanced"
    if (value < 0.85) return "Private"
    return "Maximum"
  }

  return (
    <div className="privacy-section">
      <div className="privacy-header">
        <span className="privacy-label">Privacy Level</span>
        <span className="privacy-value">{getPrivacyLabel(privacy)}</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={privacy}
        onChange={(e) => setPrivacy(parseFloat(e.target.value))}
        className="privacy-slider"
      />
      <div className="privacy-percentage">{Math.round(privacy * 100)}%</div>

      {loading && <div className="privacy-loading">Updating...</div>}

      {privacyInfo && (
        <div className="routing-info">
          <div className="routing-header">Routing Probabilities</div>
          <div className="adapter-row">
            <span className="adapter-name">Anthropic</span>
            <div className="probability-bar">
              <div
                className="probability-fill"
                style={{ width: `${privacyInfo.routing.anthropic.probability * 100}%` }}
              />
            </div>
            <span className="probability-text">
              {Math.round(privacyInfo.routing.anthropic.probability * 100)}%
            </span>
          </div>
          <div className="adapter-row">
            <span className="adapter-name">OpenAI</span>
            <div className="probability-bar">
              <div
                className="probability-fill"
                style={{ width: `${privacyInfo.routing.openai.probability * 100}%` }}
              />
            </div>
            <span className="probability-text">{Math.round(privacyInfo.routing.openai.probability * 100)}%</span>
          </div>
          <div className="adapter-row">
            <span className="adapter-name">OpenRouter</span>
            <div className="probability-bar">
              <div
                className="probability-fill"
                style={{ width: `${privacyInfo.routing.openrouter.probability * 100}%` }}
              />
            </div>
            <span className="probability-text">
              {Math.round(privacyInfo.routing.openrouter.probability * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
