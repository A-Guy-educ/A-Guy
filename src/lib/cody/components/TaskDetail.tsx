/**
 * @fileType component
 * @domain cody
 * @pattern task-detail
 * @ai-summary Task detail panel with pipeline and actions
 */
'use client'

import { formatRelativeTime } from '../utils'
import type { CodyTask } from '../types'
import { PipelineStatus } from './PipelineStatus'
import { StatusBadge } from './StatusBadge'

interface TaskDetailProps {
  task: CodyTask | null
  onClose?: () => void
}

export function TaskDetail({ task, onClose }: TaskDetailProps) {
  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <p>Select a task to view details</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-700">
        <div>
          <span className="text-xs font-mono text-gray-400">{task.id}</span>
          <h2 className="text-lg font-semibold text-white mt-1">{task.title}</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white"></button>✕
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Status */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Status</h3>
          {task.pipeline ? (
            <StatusBadge status={task.pipeline.state} />
          ) : (
            <span className="text-gray-500">No pipeline data</span>
          )}
        </div>

        {/* Pipeline */}
        {task.pipeline && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Pipeline</h3>
            <PipelineStatus status={task.pipeline} />
          </div>
        )}

        {/* Issue Info */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Issue</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Number:</span>
              <span className="text-white">#{task.issueNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">State:</span>
              <span className="text-white capitalize">{task.state}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Updated:</span>
              <span className="text-white">{formatRelativeTime(task.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Labels */}
        {task.labels.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Labels</h3>
            <div className="flex flex-wrap gap-1">
              {task.labels.map((label) => (
                <span key={label} className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Workflow Run */}
        {task.workflowRun && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Workflow</h3>
            <a
              href={task.workflowRun.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View Run →
            </a>
          </div>
        )}

        {/* Associated PR */}
        {task.associatedPR && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Pull Request</h3>
            <a
              href={task.associatedPR.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              #{task.associatedPR.number}: {task.associatedPR.title} →
            </a>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-700 space-y-2">
        <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium">
          View on GitHub
        </button>
        {task.pipeline?.state === 'running' && (
          <button className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium">
            Abort Run
          </button>
        )}
      </div>
    </div>
  )
}
