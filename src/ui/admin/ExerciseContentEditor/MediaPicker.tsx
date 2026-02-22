'use client'

import type { Media } from '@/payload-types'
import { useTranslation } from '@payloadcms/ui'
import Image from 'next/image'
import React from 'react'
import { Upload } from 'lucide-react'

interface MediaPickerProps {
  isOpen: boolean
  onClose: () => void
  selectedMediaIds: string[]
  onSave: (mediaIds: string[]) => void
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'application/pdf',
]
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB (videos can be large)

export const MediaPicker: React.FC<MediaPickerProps> = ({
  isOpen,
  onClose,
  selectedMediaIds,
  onSave,
}) => {
  const { t: _t } = useTranslation()
  const [media, setMedia] = React.useState<Media[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [localSelectedIds, setLocalSelectedIds] = React.useState<string[]>(selectedMediaIds)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Sync local selection with prop changes
  React.useEffect(() => {
    setLocalSelectedIds(selectedMediaIds)
  }, [selectedMediaIds])

  // Fetch media items when modal opens
  React.useEffect(() => {
    if (!isOpen) return

    const fetchMedia = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/media?limit=100&sort=-createdAt')
        if (!response.ok) {
          throw new Error('Failed to fetch media')
        }
        const data = await response.json()
        setMedia(data.docs || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load media')
      } finally {
        setLoading(false)
      }
    }

    fetchMedia()
  }, [isOpen])

  const filteredMedia = React.useMemo(() => {
    if (!searchTerm) return media
    const term = searchTerm.toLowerCase()
    return media.filter(
      (item) =>
        item.filename?.toLowerCase().includes(term) || item.alt?.toLowerCase().includes(term),
    )
  }, [media, searchTerm])

  const toggleSelection = (id: string) => {
    setLocalSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((mediaId) => mediaId !== id) : [...prev, id],
    )
  }

  const handleSave = () => {
    onSave(localSelectedIds)
    onClose()
  }

  const handleCancel = () => {
    setLocalSelectedIds(selectedMediaIds) // Reset to original
    onClose()
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadError(null)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        setUploadError('Invalid file type. Allowed: JPEG, PNG, WebP, GIF, SVG, MP4, WebM, PDF')
        continue
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setUploadError('File too large. Maximum size is 100MB')
        continue
      }

      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/media', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || errorData.error || 'Upload failed')
        }

        const doc = await response.json()
        const newMediaId = doc.doc?.id || doc.id

        // Add to local selection
        setLocalSelectedIds((prev) => [...prev, newMediaId])

        // Add to media list so it appears in grid
        setMedia((prev) => [
          {
            id: newMediaId,
            filename: doc.doc?.filename || doc.filename || file.name,
            url: doc.doc?.url || doc.url,
            alt: '',
            type:
              file.type === 'image/svg+xml'
                ? 'svg'
                : file.type.startsWith('video/')
                  ? 'video'
                  : file.type.startsWith('image/')
                    ? 'image'
                    : 'pdf',
            filesize: file.size,
            mimeType: file.type,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Media,
          ...prev,
        ])
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed')
      }
    }

    setUploading(false)
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const triggerFilePicker = () => {
    fileInputRef.current?.click()
  }

  if (!isOpen) return null

  return (
    <div className="media-picker-overlay" onClick={handleCancel}>
      <div className="media-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="media-picker-header">
          <h2>Select Media</h2>
          <button type="button" className="media-picker-close" onClick={handleCancel}>
            ×
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept={ALLOWED_MIME_TYPES.join(',')}
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
        />

        <div className="media-picker-upload">
          <button
            type="button"
            className="media-picker-upload-btn"
            onClick={triggerFilePicker}
            disabled={uploading}
          >
            <Upload size={16} />
            <span>{uploading ? 'Uploading...' : 'Upload new file'}</span>
          </button>
          {uploading && <div className="media-picker-uploading">Uploading...</div>}
          {uploadError && <div className="media-picker-upload-error">{uploadError}</div>}
        </div>

        <div className="media-picker-search">
          <input
            type="text"
            placeholder="Search media..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="media-picker-search-input"
          />
        </div>

        <div className="media-picker-body">
          {loading && <div className="media-picker-loading">Loading media...</div>}

          {error && <div className="media-picker-error">{error}</div>}

          {!loading && !error && filteredMedia.length === 0 && (
            <div className="media-picker-empty">
              {searchTerm ? 'No media found matching your search.' : 'No media available.'}
            </div>
          )}

          {!loading && !error && filteredMedia.length > 0 && (
            <div className="media-grid">
              {filteredMedia.map((item) => {
                const isSelected = localSelectedIds.includes(item.id)
                // Cast to any to bypass strict type checking for blob storage sizes
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const itemAny = item as any
                // Use thumbnailURL (set by adminThumbnail) first, then fall back to sizes.thumbnail.url
                const thumbnailUrl = item.thumbnailURL || itemAny.sizes?.thumbnail?.url || item.url

                return (
                  <div
                    key={item.id}
                    className={`media-grid-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSelection(item.id)}
                  >
                    <div className="media-grid-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {thumbnailUrl && (
                      <Image
                        src={thumbnailUrl}
                        alt={item.alt || item.filename || 'Media'}
                        width={200}
                        height={200}
                        className="media-grid-image"
                        style={{ objectFit: 'cover' }}
                      />
                    )}
                    <div className="media-grid-info">
                      <div className="media-grid-filename">{item.filename || 'External'}</div>
                      {item.alt && <div className="media-grid-alt">{item.alt}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="media-picker-footer">
          <div className="media-picker-count">
            {localSelectedIds.length} item{localSelectedIds.length !== 1 ? 's' : ''} selected
          </div>
          <div className="media-picker-actions">
            <button type="button" className="media-picker-button-cancel" onClick={handleCancel}>
              Cancel
            </button>
            <button type="button" className="media-picker-button-save" onClick={handleSave}>
              Save Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
