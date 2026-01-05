'use client'

import React from 'react'
import { useTranslation } from '@payloadcms/ui'
import type { Media } from '@/payload-types'

interface MediaPickerProps {
  isOpen: boolean
  onClose: () => void
  selectedMediaIds: string[]
  onSave: (mediaIds: string[]) => void
}

export const MediaPicker: React.FC<MediaPickerProps> = ({
  isOpen,
  onClose,
  selectedMediaIds,
  onSave,
}) => {
  const { t } = useTranslation()
  const [media, setMedia] = React.useState<Media[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [localSelectedIds, setLocalSelectedIds] = React.useState<string[]>(selectedMediaIds)

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
                const thumbnailUrl = item.sizes?.thumbnail?.url || item.url

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
                      <img
                        src={thumbnailUrl}
                        alt={item.alt || item.filename || 'Media'}
                        className="media-grid-image"
                      />
                    )}
                    <div className="media-grid-info">
                      <div className="media-grid-filename">{item.filename}</div>
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
