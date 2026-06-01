import React, { useEffect, useState } from "react"

interface WebhookEvent {
  id: string
  repo: string
  event_type: string
  action: string
  issue_number: number
  issue_title: string
  comment_body: string | null
  author: string
  url: string
  created_at: number
}

interface WatchedRepo {
  repo_full_name: string
  created_at: number
}

interface GithubRepo {
  full_name: string
  private: boolean
  watching: boolean
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function badgeClass(action: string): string {
  if (action === "opened") return "event-badge opened"
  if (action === "closed") return "event-badge closed"
  if (action === "reopened") return "event-badge opened"
  return "event-badge commented"
}

export function EventLog() {
  const [watchedRepos, setWatchedRepos] = useState<WatchedRepo[]>([])
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [availableRepos, setAvailableRepos] = useState<GithubRepo[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [settingUp, setSettingUp] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWatched = () =>
    fetch("/v1/webhooks/repos")
      .then((r) => r.ok ? r.json() : [])
      .then(setWatchedRepos)
      .catch(() => {})

  const fetchEvents = () =>
    fetch("/v1/webhook-events?limit=50")
      .then((r) => r.ok ? r.json() : [])
      .then(setEvents)
      .catch(() => {})

  const fetchAvailableRepos = async () => {
    const res = await fetch("/v1/github/repos")
    if (res.ok) {
      setAvailableRepos(await res.json())
    } else {
      const data = await res.json().catch(() => ({}))
      if (data.reauth) window.location.href = "/auth/github"
    }
  }

  useEffect(() => {
    Promise.all([fetchWatched(), fetchEvents()]).finally(() => setLoading(false))
    const interval = setInterval(fetchEvents, 10000)
    return () => clearInterval(interval)
  }, [])

  const setupRepo = async (repo: string) => {
    setSettingUp(repo)
    setError(null)
    try {
      const res = await fetch("/v1/webhooks/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.reauth) {
          window.location.href = "/auth/github"
          return
        }
        setError(data.error || "Failed to set up webhook")
      } else {
        await fetchWatched()
        if (availableRepos) {
          setAvailableRepos(availableRepos.map((r) =>
            r.full_name === repo ? { ...r, watching: true } : r
          ))
        }
      }
    } catch {
      setError("Network error")
    } finally {
      setSettingUp(null)
    }
  }

  const openPicker = async () => {
    setShowPicker(true)
    if (!availableRepos) await fetchAvailableRepos()
  }

  if (loading) return <div className="event-log"><p className="event-loading">Loading...</p></div>

  const hasWatched = watchedRepos.length > 0

  return (
    <div className="event-log">
      <div className="event-log-header">
        <h2>Event Log</h2>
        {hasWatched && (
          <span className="watching-badge">{watchedRepos.length} repo{watchedRepos.length > 1 ? "s" : ""}</span>
        )}
        <div style={{ flex: 1 }} />
        <button className="setup-btn-small" onClick={openPicker}>
          {showPicker ? "Hide repos" : "+ Watch repo"}
        </button>
      </div>

      {showPicker && (
        <div className="repo-picker">
          {!availableRepos ? (
            <p className="event-loading">Loading repos...</p>
          ) : (
            <div className="repo-list">
              {availableRepos.map((repo) => (
                <div key={repo.full_name} className="repo-item">
                  <div className="repo-name">
                    {repo.full_name}
                    {repo.private && <span className="repo-private">private</span>}
                  </div>
                  {repo.watching ? (
                    <span className="watching-badge">Watching</span>
                  ) : (
                    <button
                      className="watch-btn"
                      onClick={() => setupRepo(repo.full_name)}
                      disabled={settingUp === repo.full_name}
                    >
                      {settingUp === repo.full_name ? "..." : "Watch"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {error && <p className="setup-error">{error}</p>}
        </div>
      )}

      {!hasWatched && !showPicker && (
        <div className="setup-prompt">
          <p>Watch issues and comments on your repositories.</p>
          <button className="setup-btn" onClick={openPicker}>
            Choose repositories to watch
          </button>
        </div>
      )}

      {hasWatched && events.length === 0 && (
        <p className="event-empty">No events yet. Activity will appear here when issues or comments are created.</p>
      )}

      {events.map((event) => (
        <a
          key={event.id}
          className="event-card"
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="event-card-header">
            <span className={badgeClass(event.action)}>{event.action}</span>
            <span className="event-time">{timeAgo(event.created_at)}</span>
          </div>
          <div className="event-title">
            #{event.issue_number} {event.issue_title}
          </div>
          {event.comment_body && (
            <div className="event-comment">{event.comment_body}</div>
          )}
          <div className="event-meta">
            <span className="event-author">{event.author}</span>
            <span className="event-repo">{event.repo}</span>
          </div>
        </a>
      ))}
    </div>
  )
}
