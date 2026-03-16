'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

interface Entitlement {
  id: string
  contentType: 'course' | 'lesson'
  course?: { id: string; title?: string } | string | null
  lesson?: { id: string; title?: string } | string | null
  grantMethod: 'admin' | 'payment' | 'code'
  expiresAt?: string | null
  createdAt: string
}

interface Course {
  id: string
  title: string
}

export const UserEntitlementsField: React.FC = () => {
  const { id: userId } = useDocumentInfo()
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')

  const fetchEntitlements = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(
        `/api/user-entitlements?where[user][equals]=${userId}&depth=1&limit=100`,
      )
      const data = await res.json()
      setEntitlements(data.docs || [])
    } catch {
      setError('Failed to load entitlements')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchEntitlements()
  }, [fetchEntitlements])

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/courses?limit=100&depth=0&sort=title')
        const data = await res.json()
        setCourses(data.docs || [])
      } catch {
        // Courses list is best-effort
      }
    }
    fetchCourses()
  }, [])

  const handleAdd = async () => {
    if (!selectedCourse || !userId) return
    setIsAdding(true)
    setError('')

    try {
      const res = await fetch('/api/user-entitlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: userId,
          contentType: 'course',
          course: selectedCourse,
          grantMethod: 'admin',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.errors?.[0]?.message || 'Failed to add entitlement')
        return
      }

      setSelectedCourse('')
      await fetchEntitlements()
    } catch {
      setError('Failed to add entitlement')
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemove = async (entitlementId: string) => {
    try {
      await fetch(`/api/user-entitlements/${entitlementId}`, { method: 'DELETE' })
      await fetchEntitlements()
    } catch {
      setError('Failed to remove entitlement')
    }
  }

  const getContentLabel = (ent: Entitlement): string => {
    if (ent.contentType === 'course' && ent.course) {
      return typeof ent.course === 'string' ? ent.course : ent.course.title || ent.course.id
    }
    if (ent.contentType === 'lesson' && ent.lesson) {
      return typeof ent.lesson === 'string' ? ent.lesson : ent.lesson.title || ent.lesson.id
    }
    return 'Unknown'
  }

  // Filter out courses the user already has
  const existingCourseIds = new Set(
    entitlements
      .filter((e) => e.contentType === 'course')
      .map((e) => (typeof e.course === 'string' ? e.course : e.course?.id))
      .filter(Boolean),
  )
  const availableCourses = courses.filter((c) => !existingCourseIds.has(c.id))

  if (!userId) return null

  return (
    <div style={{ marginTop: '24px' }}>
      <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
        Course Entitlements
      </h4>

      {isLoading ? (
        <p style={{ color: '#666', fontSize: '13px' }}>Loading...</p>
      ) : (
        <>
          {entitlements.length === 0 ? (
            <p style={{ color: '#666', fontSize: '13px', marginBottom: '12px' }}>
              No entitlements granted.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '12px' }}>
              {entitlements.map((ent) => (
                <li
                  key={ent.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    marginBottom: '4px',
                    background: 'var(--theme-elevation-50)',
                    borderRadius: '4px',
                    fontSize: '13px',
                  }}
                >
                  <span>
                    <strong>{ent.contentType === 'course' ? 'Course' : 'Lesson'}:</strong>{' '}
                    {getContentLabel(ent)}
                    <span style={{ color: '#888', marginLeft: '8px' }}>({ent.grantMethod})</span>
                    {ent.expiresAt && (
                      <span style={{ color: '#888', marginLeft: '8px' }}>
                        expires {new Date(ent.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => handleRemove(ent.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--theme-error-500)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid var(--theme-elevation-150)',
                background: 'var(--theme-input-bg)',
                color: 'var(--theme-text)',
                fontSize: '13px',
              }}
            >
              <option value="">Select a course...</option>
              {availableCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!selectedCourse || isAdding}
              type="button"
              style={{
                padding: '6px 16px',
                borderRadius: '4px',
                border: 'none',
                background: 'var(--theme-success-500)',
                color: 'white',
                cursor: selectedCourse && !isAdding ? 'pointer' : 'not-allowed',
                opacity: selectedCourse && !isAdding ? 1 : 0.5,
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {isAdding ? 'Adding...' : 'Grant Access'}
            </button>
          </div>

          {error && (
            <p style={{ color: 'var(--theme-error-500)', fontSize: '13px', marginTop: '8px' }}>
              {error}
            </p>
          )}
        </>
      )}
    </div>
  )
}
