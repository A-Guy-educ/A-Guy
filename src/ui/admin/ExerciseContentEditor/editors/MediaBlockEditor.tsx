'use client'

import type { MediaBlock } from '@/server/payload/collections/Exercises/types'
import { useListDrawer } from '@payloadcms/ui'
import Image from 'next/image'
import React from 'react'
import { Film, Trash2 } from 'lucide-react'

interface MediaBlockEditorProps {
  block: MediaBlock
  onChange: (block: MediaBlock) => void
}

export const MediaBlockEditor: React.FC<MediaBlockEditorProps> = ({ block, onChange }) => {
  const [ListDrawer, ListDrawerToggler, { openDrawer, closeDrawer }] = useListDrawer({
    selectedCollection: 'media',
  })

  const [media, setMedia] = React.useState<{
    id: string
    url: string
    alt: string
    filename: string
    type: string
    mimeType?: string
    thumbnailURL?: string
  } | null>(null)
  const [loading, setLoading] = React.useState(false)

  // Fetch media details when mediaId changes
  React.useEffect(() => {
    if (!block.mediaId) {
      setMedia(null)
      return
    }

    const fetchMedia = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/media/${block.mediaId}`)
        if (response.ok) {
          const data = await response.json()
          // API returns flat object (not wrapped in .doc)
          const doc = data.doc || data
          setMedia({
            id: doc.id,
            url: doc.url,
            alt: doc.alt || '',
            filename: doc.filename,
            type: doc.type || 'image',
            mimeType: doc.mimeType,
            thumbnailURL: doc.thumbnailURL,
          })
        } else {
          setMedia(null)
        }
      } catch {
        setMedia(null)
      } finally {
        setLoading(false)
      }
    }

    fetchMedia()
  }, [block.mediaId])

  const handleSelectMedia = () => {
    openDrawer()
  }

  const handleRemoveMedia = () => {
    onChange({ ...block, mediaId: '' })
  }

  const handleDrawerSelect = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (args: any) => {
      const mediaId = args.docID || args.doc?.id
      onChange({ ...block, mediaId })
      // Close drawer after state update to avoid race condition
      setTimeout(() => closeDrawer(), 0)
    },
    [block, onChange, closeDrawer],
  )

  return (
    <div className="media-block-editor">
      <ListDrawer onSelect={handleDrawerSelect} />
      <div className="media-block-editor-header">
        <span className="media-block-editor-label">Media</span>
        <ListDrawerToggler onClick={handleSelectMedia} className="media-block-editor-change-btn">
          Change
        </ListDrawerToggler>
      </div>

      {loading ? (
        <div className="media-block-editor-loading">Loading media...</div>
      ) : media ? (
        <div className="media-block-editor-preview">
          <div className="media-block-editor-image-container">
            {media.type === 'video' ? (
              <video
                src={media.url}
                controls
                className="media-block-editor-video"
                style={{ maxWidth: '100%', maxHeight: 200 }}
              >
                Your browser does not support video playback.
              </video>
            ) : (
              <Image
                src={media.url}
                alt={media.alt || media.filename}
                width={200}
                height={200}
                className="media-block-editor-image"
                style={{ objectFit: 'contain' }}
              />
            )}
          </div>
          <div className="media-block-editor-info">
            <span className="media-block-editor-filename">{media.filename}</span>
          </div>
          <div className="media-block-editor-actions">
            <button
              type="button"
              className="media-block-editor-action-btn"
              onClick={handleSelectMedia}
            >
              Change
            </button>
            <button
              type="button"
              className="media-block-editor-action-btn media-block-editor-action-btn--danger"
              onClick={handleRemoveMedia}
            >
              <Trash2 size={14} />
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="media-block-editor-empty">
          <Film size={48} className="media-block-editor-empty-icon" />
          <p>No media selected</p>
          <button
            type="button"
            className="media-block-editor-select-btn"
            onClick={handleSelectMedia}
          >
            Select Media
          </button>
        </div>
      )}
    </div>
  )
}
