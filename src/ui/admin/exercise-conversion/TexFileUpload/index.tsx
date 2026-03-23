'use client'

import { useState, useRef } from 'react'

interface TexFileUploadProps {
  lessonId: string
}

/**
 * Direct .tex file upload that bypasses Payload's admin modal file-type validation.
 * Uploads the file to Media collection via API, then attaches it to the lesson's contentFiles.
 */
export function TexFileUpload({ lessonId }: TexFileUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.tex')) {
      setStatus({ type: 'error', message: 'Please select a .tex file' })
      return
    }

    setUploading(true)
    setStatus(null)

    try {
      // Step 1: Upload file to Media collection
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'document')

      const uploadRes = await fetch('/api/media', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        setStatus({ type: 'error', message: err.errors?.[0]?.message || 'Upload failed' })
        return
      }

      const mediaDoc = await uploadRes.json()
      const mediaId = mediaDoc.doc?.id

      if (!mediaId) {
        setStatus({ type: 'error', message: 'Upload succeeded but no media ID returned' })
        return
      }

      // Step 2: Fetch current lesson to get existing contentFiles
      const lessonRes = await fetch(`/api/lessons/${lessonId}?depth=0`, {
        credentials: 'include',
      })

      if (!lessonRes.ok) {
        setStatus({ type: 'error', message: 'Failed to fetch lesson' })
        return
      }

      const lesson = await lessonRes.json()
      const existingFiles: string[] = Array.isArray(lesson.contentFiles)
        ? lesson.contentFiles.map((f: string | { id: string }) =>
            typeof f === 'string' ? f : f.id,
          )
        : []

      // Step 3: Update lesson contentFiles to include new media
      const updateRes = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentFiles: [...existingFiles, mediaId],
        }),
        credentials: 'include',
      })

      if (!updateRes.ok) {
        setStatus({ type: 'error', message: 'File uploaded but failed to attach to lesson' })
        return
      }

      setStatus({ type: 'success', message: `${file.name} uploaded and attached` })
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      setStatus({ type: 'error', message: 'Network error' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input
        ref={fileRef}
        type="file"
        accept=".tex"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        type="button"
        style={{
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 500,
          border: '1px solid var(--theme-elevation-300)',
          borderRadius: 3,
          backgroundColor: 'var(--theme-elevation-0)',
          color: 'var(--theme-elevation-800)',
          cursor: uploading ? 'not-allowed' : 'pointer',
        }}
      >
        {uploading ? 'Uploading...' : 'Upload .tex'}
      </button>
      {status && (
        <span
          style={{
            fontSize: 11,
            color: status.type === 'error' ? 'var(--theme-error-500)' : 'var(--theme-success-500)',
          }}
        >
          {status.message}
        </span>
      )}
    </div>
  )
}

export default TexFileUpload
