/**
 * @fileType component
 * @domain cody
 * @pattern create-task-dialog
 * @ai-summary Dialog to create new tasks
 */
'use client'

import { useState } from 'react'

interface CreateTaskDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { title: string; body: string; mode: string }) => void
}

export function CreateTaskDialog({ open, onClose, onSubmit }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mode, setMode] = useState('full')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ title, body, mode })
    setTitle('')
    setBody('')
    setMode('full')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-white mb-4">Create New Task</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              placeholder="e.g., Add user authentication"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              rows={4}
              placeholder="Describe what needs to be done..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
              <option value="full">Full (spec + impl)</option>
              <option value="spec">Spec only</option>
              <option value="impl">Implementation only</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
