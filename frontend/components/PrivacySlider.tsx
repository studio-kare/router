import React, { useState } from "react"

type RoutingMode = "cost" | "performance" | "privacy"

const modes: { value: RoutingMode; label: string; description: string }[] = [
  { value: "cost", label: "Cost", description: "OpenRouter" },
  { value: "performance", label: "Performance", description: "OpenAI" },
  { value: "privacy", label: "Privacy", description: "Anthropic" },
]

export function PrivacySlider() {
  const [selected, setSelected] = useState<RoutingMode>("performance")

  return (
    <div className="privacy-section">
      <div className="privacy-header">
        <span className="privacy-label">Optimise for</span>
      </div>
      <div className="routing-modes">
        {modes.map((mode) => (
          <button
            key={mode.value}
            className={`routing-mode-btn ${selected === mode.value ? "active" : ""}`}
            onClick={() => setSelected(mode.value)}
          >
            <span className="routing-mode-label">{mode.label}</span>
            <span className="routing-mode-desc">{mode.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
