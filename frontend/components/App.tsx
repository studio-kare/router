import React, { useState } from "react"
import type { ApiKeyInfo } from "../types"
import { DeploymentSidebar } from "./DeploymentSidebar"
import { Placeholder } from "./Placeholder"
import { UsageLedger } from "./UsageLedger"

export function App() {
  const [selectedKey, setSelectedKey] = useState<ApiKeyInfo | null>(null)

  return (
    <div className="container">
      <DeploymentSidebar selectedKey={selectedKey} onSelectKey={setSelectedKey} />
      {selectedKey ? (
        <aside className="details-column">
          <div className="details-header">
            <h2>Key Details</h2>
            <button
              className="close-btn"
              onClick={() => setSelectedKey(null)}
              title="Close"
            >
              ✕
            </button>
          </div>
          <div className="details-content">
            <div className="detail-row">
              <span className="detail-label">Key:</span>
              <span className="detail-value">{selectedKey.key}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">ID:</span>
              <span className="detail-value">{selectedKey.id}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Created:</span>
              <span className="detail-value">
                {new Date(selectedKey.createdAt).toLocaleString()}
              </span>
            </div>
            {selectedKey.lastUsed && (
              <div className="detail-row">
                <span className="detail-label">Last Used:</span>
                <span className="detail-value">
                  {new Date(selectedKey.lastUsed).toLocaleString()}
                </span>
              </div>
            )}
            {selectedKey.revokedAt && (
              <div className="detail-row">
                <span className="detail-label">Revoked:</span>
                <span className="detail-value">
                  {new Date(selectedKey.revokedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="divider-horizontal" />

          <UsageLedger keyId={selectedKey.id} />
        </aside>
      ) : (
        <main className="main-content">
          <Placeholder />
        </main>
      )}
    </div>
  )
}
