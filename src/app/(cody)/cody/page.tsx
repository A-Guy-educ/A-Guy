/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Main Cody dashboard page
 */
'use client'

import { useState, useEffect } from 'react'
import { CodyDashboard } from '@/lib/cody/components/CodyDashboard'

export default function CodyPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // Check auth status
    fetch('/api/cody/auth')
      .then((res) => res.json())
      .then((data) => setAuthenticated(data.authenticated))
      .catch(() => setAuthenticated(false))
  }, [])

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg w-full max-w-md">
          <h1 className="text-2xl font-semibold text-white mb-4">Cody Dashboard</h1>
          <p className="text-gray-400 mb-4">Enter the dashboard secret to access.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const secret = (e.target as HTMLFormElement).secret.value
              fetch('/api/cody/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret }),
              })
                .then((res) => {
                  if (res.ok) {
                    setAuthenticated(true)
                  } else {
                    alert('Invalid secret')
                  }
                })
                .catch(() => alert('Error'))
            }}
          >
            <input
              name="secret"
              type="password"
              placeholder="Dashboard secret"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white mb-4"
            />
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <CodyDashboard />
}
