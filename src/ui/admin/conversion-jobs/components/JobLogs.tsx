/**
 * Job Logs Component
 *
 * @fileType component
 * @domain admin
 * @pattern log-viewer
 * @ai-summary Searchable log viewer for conversion job logs
 */

'use client'

import { useState } from 'react'

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  stage: string
  message: string
}

interface JobLogsProps {
  logs: LogEntry[]
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function JobLogs({ logs }: JobLogsProps) {
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all')
  const [search, setSearch] = useState('')

  const filteredLogs = logs.filter((log) => {
    if (filter !== 'all' && log.level !== filter) return false
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <section className="job-logs">
      <div className="logs-header">
        <h2>Logs</h2>
        <div className="logs-filters">
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="log-search"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="log-filter"
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      <div className="logs-container">
        {filteredLogs.length === 0 ? (
          <p className="logs-empty">No logs to display.</p>
        ) : (
          <ul className="logs-list">
            {filteredLogs.map((log, index) => (
              <li key={index} className={`log-entry log-${log.level}`}>
                <span className="log-time">{formatTime(log.timestamp)}</span>
                <span className={`log-level badge-${log.level}`}>{log.level}</span>
                <span className="log-stage">{log.stage}</span>
                <span className="log-message">{log.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .job-logs {
          background: var(--theme-elevation-100);
          border-radius: 8px;
          padding: 1rem;
          max-height: 600px;
          display: flex;
          flex-direction: column;
        }
        .logs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }
        .logs-header h2 {
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
        }
        .logs-filters {
          display: flex;
          gap: 0.5rem;
        }
        .log-search,
        .log-filter {
          padding: 0.375rem 0.5rem;
          border: 1px solid var(--theme-elevation-300);
          border-radius: 4px;
          font-size: 0.8rem;
          background: var(--theme-elevation-50);
        }
        .log-search {
          width: 150px;
        }
        .logs-container {
          flex: 1;
          overflow-y: auto;
          background: #1e1e1e;
          border-radius: 4px;
          padding: 0.5rem;
        }
        .logs-list {
          list-style: none;
          padding: 0;
          margin: 0;
          font-family: monospace;
          font-size: 0.8rem;
        }
        .log-entry {
          display: flex;
          gap: 0.75rem;
          padding: 0.25rem 0;
          border-bottom: 1px solid #333;
        }
        .log-entry:last-child {
          border-bottom: none;
        }
        .log-time {
          color: #666;
          min-width: 70px;
        }
        .log-level {
          min-width: 40px;
          text-transform: uppercase;
          font-size: 0.7rem;
          font-weight: 600;
        }
        .badge-info { color: #4ade80; }
        .badge-warn { color: #facc15; }
        .badge-error { color: #f87171; }
        .log-stage {
          color: #60a5fa;
          min-width: 100px;
        }
        .log-message {
          color: #e5e5e5;
          flex: 1;
        }
        .logs-empty {
          color: #666;
          font-style: italic;
          text-align: center;
          padding: 2rem;
        }
      `}</style>
    </section>
  )
}
