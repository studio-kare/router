import React, { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

interface DeploymentInfo {
  name: "development" | "staging" | "production"
  apiUrl: string
  features: {
    experimentalAdapters: boolean
    privacyModes: boolean
  }
}

interface PrivacyInfo {
  privacy: number
  routing: {
    anthropic: { probability: number; costMultiplier: number }
    openai: { probability: number; costMultiplier: number }
    openrouter: { probability: number; costMultiplier: number }
  }
}

function PrivacySlider() {
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

function DeploymentSidebar() {
  const [deployment, setDeployment] = useState<DeploymentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDeployment = async () => {
      try {
        const res = await fetch("/v1/deployment")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setDeployment(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch deployment")
      } finally {
        setLoading(false)
      }
    }

    fetchDeployment()
  }, [])

  if (loading) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">Deployment</div>
        <div className="sidebar-content">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">Deployment</div>
        <div className="sidebar-content error">{error}</div>
      </div>
    )
  }

  if (!deployment) {
    return null
  }

  const deploymentColor = {
    development: "#3b82f6",
    staging: "#f59e0b",
    production: "#ef4444",
  }[deployment.name]

  return (
    <div className="sidebar">
      <div className="sidebar-header">Configuration</div>
      <div className="sidebar-content">
        <div className="sidebar-section">
          <div className="section-title">Deployment</div>
          <div className="deployment-badge" style={{ borderLeftColor: deploymentColor }}>
            <div className="deployment-name">{deployment.name}</div>
            <div className="deployment-url">{deployment.apiUrl}</div>
          </div>
          <div className="features">
            <div className="feature-item">
              <span className="feature-label">Experimental Adapters</span>
              <span className={`feature-value ${deployment.features.experimentalAdapters ? "on" : "off"}`}>
                {deployment.features.experimentalAdapters ? "✓" : "✗"}
              </span>
            </div>
            <div className="feature-item">
              <span className="feature-label">Privacy Modes</span>
              <span className={`feature-value ${deployment.features.privacyModes ? "on" : "off"}`}>
                {deployment.features.privacyModes ? "✓" : "✗"}
              </span>
            </div>
          </div>
        </div>

        <div className="divider" />

        <PrivacySlider />
      </div>
    </div>
  )
}

function App() {
  return (
    <div className="container">
      <DeploymentSidebar />
      <main className="main-content">
        <div className="placeholder">
          <h1>Farmer</h1>
          <p>Chat interface coming soon</p>
        </div>
      </main>
    </div>
  )
}

const root = createRoot(document.getElementById("root")!)
root.render(<App />)

// Styles
const style = document.createElement("style")
style.textContent = `
  .container {
    display: flex;
    height: 100vh;
  }

  .sidebar {
    width: 320px;
    background: white;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .sidebar-header {
    padding: 16px;
    font-weight: 600;
    font-size: 14px;
    text-transform: uppercase;
    color: #6b7280;
    border-bottom: 1px solid #f3f4f6;
  }

  .sidebar-content {
    padding: 12px;
    flex: 1;
  }

  .sidebar-content.error {
    color: #dc2626;
    font-size: 12px;
  }

  .sidebar-section {
    margin-bottom: 16px;
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    margin-bottom: 8px;
    padding: 0 4px;
  }

  .divider {
    height: 1px;
    background: #f3f4f6;
    margin: 16px 0;
  }

  .deployment-badge {
    border-left: 4px solid #3b82f6;
    padding: 12px;
    background: #f9fafb;
    border-radius: 6px;
    margin-bottom: 12px;
  }

  .deployment-name {
    font-weight: 600;
    font-size: 14px;
    color: #111827;
    margin-bottom: 4px;
    text-transform: capitalize;
  }

  .deployment-url {
    font-size: 11px;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .features {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .feature-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    background: #f9fafb;
    border-radius: 4px;
    font-size: 12px;
  }

  .feature-label {
    color: #6b7280;
  }

  .feature-value {
    font-weight: 600;
  }

  .feature-value.on {
    color: #10b981;
  }

  .feature-value.off {
    color: #ef4444;
  }

  .privacy-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .privacy-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px;
  }

  .privacy-label {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
  }

  .privacy-value {
    font-size: 12px;
    font-weight: 600;
    color: #3b82f6;
  }

  .privacy-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #e5e7eb;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .privacy-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .privacy-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .privacy-percentage {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
    text-align: center;
    padding: 4px 0;
  }

  .privacy-loading {
    font-size: 11px;
    color: #9ca3af;
    text-align: center;
    padding: 4px;
  }

  .routing-info {
    background: #f9fafb;
    border-radius: 6px;
    padding: 8px;
    margin-top: 4px;
  }

  .routing-header {
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    margin-bottom: 8px;
    padding: 0 4px;
  }

  .adapter-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 12px;
  }

  .adapter-row:last-child {
    margin-bottom: 0;
  }

  .adapter-name {
    width: 70px;
    color: #6b7280;
    font-size: 11px;
  }

  .probability-bar {
    flex: 1;
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
    overflow: hidden;
  }

  .probability-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #2563eb);
    border-radius: 2px;
  }

  .probability-text {
    width: 35px;
    text-align: right;
    color: #111827;
    font-weight: 600;
    font-size: 11px;
  }

  .main-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
  }

  .placeholder {
    text-align: center;
  }

  .placeholder h1 {
    font-size: 32px;
    margin-bottom: 12px;
    color: #111827;
  }

  .placeholder p {
    color: #6b7280;
  }
`
document.head.appendChild(style)
