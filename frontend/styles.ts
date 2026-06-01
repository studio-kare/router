export function injectStyles() {
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
    flex-shrink: 0;
  }

  .details-column {
    width: 340px;
    background: white;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex-shrink: 0;
    padding: 16px 12px;
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

  .divider-horizontal {
    height: 1px;
    background: #e5e7eb;
    margin: 12px 0;
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

  .keys-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .keys-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px;
  }

  .keys-label {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
  }

  .keys-actions {
    display: flex;
    gap: 4px;
  }

  .generate-btn {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: #3b82f6;
    color: white;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .generate-btn:hover:not(:disabled) {
    background: #2563eb;
  }

  .generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .new-key-alert {
    background: #ecfdf5;
    border: 1px solid #d1fae5;
    border-radius: 6px;
    padding: 8px;
    margin-bottom: 8px;
  }

  .new-key-label {
    font-size: 11px;
    font-weight: 600;
    color: #059669;
    margin-bottom: 4px;
  }

  .new-key-value {
    font-family: monospace;
    font-size: 11px;
    color: #111827;
    background: white;
    padding: 6px;
    border-radius: 4px;
    margin-bottom: 6px;
    word-break: break-all;
  }

  .copy-btn {
    width: 100%;
    padding: 4px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .copy-btn:hover {
    background: #059669;
  }

  .keys-loading {
    font-size: 11px;
    color: #9ca3af;
    text-align: center;
    padding: 4px;
  }

  .keys-empty {
    font-size: 11px;
    color: #9ca3af;
    text-align: center;
    padding: 8px;
    background: #f9fafb;
    border-radius: 4px;
  }

  .keys-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .key-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 6px;
    background: #f9fafb;
    border-radius: 4px;
    border-left: 3px solid #3b82f6;
    font-size: 11px;
  }

  .key-item.revoked {
    border-left-color: #ef4444;
    opacity: 0.6;
  }

  .key-item.selected {
    background: #eff6ff;
    border-left-color: #3b82f6;
  }

  .key-info {
    flex: 1;
  }

  .key-display {
    font-family: monospace;
    font-size: 10px;
    color: #111827;
    margin-bottom: 2px;
    word-break: break-all;
  }

  .key-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .key-status {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
  }

  .key-status.active {
    background: #d1fae5;
    color: #059669;
  }

  .key-status.revoked {
    background: #fee2e2;
    color: #dc2626;
  }

  .key-lastused {
    color: #6b7280;
    font-size: 10px;
  }

  .details-column .details-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  .details-column .details-header h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    text-transform: uppercase;
  }

  .close-btn {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    background: none;
    color: #6b7280;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: #111827;
  }

  .details-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .detail-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    padding: 8px;
    background: #f9fafb;
    border-radius: 4px;
  }

  .detail-label {
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 10px;
  }

  .detail-value {
    color: #111827;
    font-family: monospace;
    word-break: break-all;
    font-size: 12px;
  }

  .revoke-btn {
    width: 20px;
    height: 20px;
    border-radius: 3px;
    background: #fecaca;
    color: #dc2626;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    flex-shrink: 0;
    margin-left: 4px;
  }

  .revoke-btn:hover {
    background: #fca5a5;
  }

  .clear-btn {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: #fecaca;
    color: #dc2626;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .clear-btn:hover:not(:disabled) {
    background: #fca5a5;
  }

  .clear-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 20px;
    overflow-y: auto;
  }

  .placeholder-content h1 {
    font-size: 32px;
    margin-bottom: 12px;
    color: #111827;
  }

  .placeholder-content p {
    color: #6b7280;
    margin-bottom: 40px;
  }

  .try-it-section {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 24px;
    text-align: left;
    margin-top: 32px;
  }

  .try-it-section h2 {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 16px;
    margin-top: 0;
  }

  .privacy-selector {
    margin-bottom: 20px;
    padding: 12px;
    background: #f9fafb;
    border-radius: 6px;
  }

  .selector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .selector-header label {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
  }

  .adapter-badge {
    padding: 4px 8px;
    background: #3b82f6;
    color: white;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .privacy-slider-input {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #e5e7eb;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    margin-bottom: 8px;
  }

  .privacy-slider-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .privacy-slider-input::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .privacy-legend {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #6b7280;
    padding-top: 4px;
    border-top: 1px solid #e5e7eb;
  }

  .curl-container {
    background: #1f2937;
    border-radius: 6px;
    padding: 16px;
    position: relative;
    font-family: monospace;
  }

  .curl-command {
    color: #e5e7eb;
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: monospace;
  }

  .copy-curl-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 6px 12px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .copy-curl-btn:hover {
    background: #2563eb;
  }

  .usage-ledger {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    overflow-y: auto;
  }

  .ledger-header {
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
  }

  .ledger-header h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: #111827;
    text-transform: uppercase;
  }

  .ledger-empty {
    font-size: 11px;
    color: #9ca3af;
    text-align: center;
    padding: 12px;
    background: #f9fafb;
    border-radius: 4px;
  }

  .ledger-loading {
    font-size: 11px;
    color: #9ca3af;
    text-align: center;
    padding: 12px;
  }

  .ledger-summary {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: #f0f9ff;
    border-radius: 4px;
    border-left: 3px solid #3b82f6;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }

  .summary-label {
    color: #6b7280;
    font-weight: 600;
  }

  .summary-value {
    color: #111827;
    font-weight: 600;
    font-family: monospace;
  }

  .ledger-entries {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 400px;
    overflow-y: auto;
  }

  .ledger-entry {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 8px;
    background: #f9fafb;
    font-size: 10px;
  }

  .entry-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
  }

  .entry-time {
    color: #6b7280;
    font-weight: 600;
  }

  .entry-cost {
    color: #059669;
    font-weight: 600;
    font-family: monospace;
  }

  .entry-details {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    margin-bottom: 2px;
  }

  .entry-label {
    color: #6b7280;
    font-weight: 600;
    flex-shrink: 0;
  }

  .entry-value {
    color: #111827;
    font-family: monospace;
    text-align: right;
    flex: 1;
    word-break: break-all;
  }

  .login-page {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: #f5f5f5;
  }

  .login-card {
    background: white;
    border-radius: 12px;
    padding: 40px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    max-width: 400px;
    width: 100%;
  }

  .login-card h1 {
    font-size: 24px;
    color: #111827;
    margin-bottom: 8px;
  }

  .login-card p {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 24px;
  }

  .github-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: #24292f;
    color: white;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    transition: background 0.2s;
  }

  .github-btn:hover {
    background: #1b1f23;
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .view-toggle {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    background: white;
    flex-shrink: 0;
  }

  .view-tab {
    padding: 10px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #6b7280;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }

  .view-tab:hover {
    color: #111827;
  }

  .view-tab.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
  }

  .details-column-inline {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px;
    background: white;
  }

  .event-log {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px;
    background: #f5f5f5;
  }

  .event-log-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .event-log-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  }

  .watching-badge {
    padding: 2px 8px;
    background: #d1fae5;
    color: #059669;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }

  .setup-prompt {
    background: white;
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    border: 1px solid #e5e7eb;
  }

  .setup-prompt p {
    color: #6b7280;
    margin-bottom: 16px;
    font-size: 14px;
  }

  .setup-btn {
    padding: 10px 20px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .setup-btn:hover:not(:disabled) {
    background: #2563eb;
  }

  .setup-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .setup-error {
    color: #dc2626;
    font-size: 12px;
    margin-top: 8px;
  }

  .event-empty {
    color: #9ca3af;
    font-size: 13px;
    text-align: center;
    padding: 24px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .event-loading {
    color: #9ca3af;
    text-align: center;
    padding: 24px;
  }

  .event-card {
    display: block;
    background: white;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 8px;
    border-left: 3px solid #e5e7eb;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s;
  }

  .event-card:hover {
    border-left-color: #3b82f6;
  }

  .event-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .event-badge {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .event-badge.opened {
    background: #d1fae5;
    color: #059669;
  }

  .event-badge.closed {
    background: #fee2e2;
    color: #dc2626;
  }

  .event-badge.commented {
    background: #dbeafe;
    color: #2563eb;
  }

  .event-time {
    font-size: 11px;
    color: #9ca3af;
  }

  .event-title {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 4px;
  }

  .event-comment {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event-meta {
    display: flex;
    gap: 8px;
    font-size: 11px;
    color: #9ca3af;
  }

  .event-author {
    font-weight: 600;
  }

  .setup-btn-small {
    padding: 5px 12px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .setup-btn-small:hover {
    background: #2563eb;
  }

  .repo-picker {
    background: white;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    margin-bottom: 12px;
    max-height: 300px;
    overflow-y: auto;
  }

  .repo-list {
    display: flex;
    flex-direction: column;
  }

  .repo-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid #f3f4f6;
    font-size: 13px;
  }

  .repo-item:last-child {
    border-bottom: none;
  }

  .repo-name {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #111827;
    font-weight: 500;
  }

  .repo-private {
    padding: 1px 5px;
    background: #f3f4f6;
    color: #6b7280;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
  }

  .watch-btn {
    padding: 4px 10px;
    background: #f0f9ff;
    color: #3b82f6;
    border: 1px solid #bfdbfe;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .watch-btn:hover:not(:disabled) {
    background: #dbeafe;
  }

  .watch-btn:disabled {
    opacity: 0.5;
  }
`
  document.head.appendChild(style)
}
