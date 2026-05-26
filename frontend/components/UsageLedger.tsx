import React, { useEffect, useState } from "react"
import type { UsageLedgerEntry } from "../types"

export function UsageLedger({ keyId }: { keyId: string }) {
  const [entries, setEntries] = useState<UsageLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLedger = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/v1/keys/${keyId}/ledger`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setEntries(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    fetchLedger()
  }, [keyId])

  const totalCost = entries.reduce((sum, entry) => sum + entry.costUsd, 0)
  const totalTokens = entries.reduce((sum, entry) => sum + entry.inputTokens + entry.outputTokens, 0)

  if (loading) {
    return <div className="ledger-loading">Loading ledger...</div>
  }

  return (
    <div className="usage-ledger">
      <div className="ledger-header">
        <h3>Usage Ledger</h3>
      </div>

      {entries.length === 0 ? (
        <div className="ledger-empty">No usage recorded</div>
      ) : (
        <>
          <div className="ledger-summary">
            <div className="summary-row">
              <span className="summary-label">Total Cost:</span>
              <span className="summary-value">${totalCost.toFixed(4)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Total Tokens:</span>
              <span className="summary-value">{totalTokens.toLocaleString()}</span>
            </div>
          </div>

          <div className="ledger-entries">
            {entries.map((entry) => (
              <div key={entry.id} className="ledger-entry">
                <div className="entry-header">
                  <span className="entry-time">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                  <span className="entry-cost">${entry.costUsd.toFixed(4)}</span>
                </div>
                <div className="entry-details">
                  <span className="entry-label">Model:</span>
                  <span className="entry-value">{entry.model}</span>
                </div>
                <div className="entry-details">
                  <span className="entry-label">Adapter:</span>
                  <span className="entry-value">{entry.adapter}</span>
                </div>
                <div className="entry-details">
                  <span className="entry-label">Tokens:</span>
                  <span className="entry-value">
                    {entry.inputTokens} in / {entry.outputTokens} out
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
