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
      <div className="sidebar-header">Deployment</div>
      <div className="sidebar-content">
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
    width: 280px;
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

  .deployment-badge {
    border-left: 4px solid #3b82f6;
    padding: 12px;
    background: #f9fafb;
    border-radius: 6px;
    margin-bottom: 16px;
  }

  .deployment-name {
    font-weight: 600;
    font-size: 14px;
    color: #111827;
    margin-bottom: 4px;
    text-transform: capitalize;
  }

  .deployment-url {
    font-size: 12px;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .features {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
