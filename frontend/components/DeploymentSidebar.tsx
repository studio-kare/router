import React, { useEffect, useState } from "react"
import { PrivacySlider } from "./PrivacySlider"
import { KeysManager } from "./KeysManager"
import type { DeploymentInfo, ApiKeyInfo } from "../types"

export function DeploymentSidebar({
  selectedKey,
  onSelectKey,
}: {
  selectedKey: ApiKeyInfo | null
  onSelectKey: (key: ApiKeyInfo | null) => void
}) {
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

        <div className="divider" />

        <KeysManager selectedKey={selectedKey} onSelectKey={onSelectKey} />
      </div>
    </div>
  )
}
