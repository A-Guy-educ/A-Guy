'use client'

import React from 'react'
import type { InlineRichText } from '@/server/payload/collections/Exercises/types'
import type { Media } from '@/payload-types'
import { useListDrawer } from '@payloadcms/ui'
import {
  Bold,
  Italic,
  Code,
  Sigma,
  Heading1,
  Link as LinkIcon,
  Image as ImageIcon,
  X,
} from 'lucide-react'
import Image from 'next/image'

interface InlineRichTextEditorProps {
  value: InlineRichText
  onChange: (value: InlineRichText) => void
  placeholder?: string
  minHeight?: string
}

export const InlineRichTextEditor: React.FC<InlineRichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter text...',
  minHeight = '80px',
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [mediaItems, setMediaItems] = React.useState<Media[]>([])
  const [loadingMedia, setLoadingMedia] = React.useState(false)

  const [ListDrawer, ListDrawerToggler, { openDrawer, closeDrawer }] = useListDrawer({
    selectedCollection: 'media',
  })

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selection = text.substring(start, end)

    const newValue = text.substring(0, start) + before + selection + after + text.substring(end)

    onChange({ ...value, value: newValue })

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }

  React.useEffect(() => {
    const fetchMedia = async () => {
      if (!value.mediaIds || value.mediaIds.length === 0) {
        setMediaItems([])
        return
      }

      setLoadingMedia(true)
      try {
        const fetchPromises = value.mediaIds.map((id) =>
          fetch(`/api/media/${id}`).then((res) => (res.ok ? res.json() : null)),
        )
        const results = await Promise.all(fetchPromises)
        setMediaItems(results.filter(Boolean) as Media[])
      } catch {
        setMediaItems([])
      } finally {
        setLoadingMedia(false)
      }
    }

    fetchMedia()
  }, [value.mediaIds])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDrawerSelect = (args: any) => {
    const newMediaId = args.docID
    const newMediaIds = [...(value.mediaIds || []), newMediaId]
    onChange({ ...value, mediaIds: newMediaIds })
    closeDrawer()
  }

  const handleRemoveMedia = (mediaId: string) => {
    const newMediaIds = (value.mediaIds || []).filter((id) => id !== mediaId)
    onChange({ ...value, mediaIds: newMediaIds })
  }

  return (
    <div className="inline-rich-text-editor">
      <div className="inline-rich-text-toolbar">
        <button className="toolbar-button" onClick={() => insertText('**', '**')} title="Bold">
          <Bold size={14} />
        </button>
        <button className="toolbar-button" onClick={() => insertText('*', '*')} title="Italic">
          <Italic size={14} />
        </button>
        <div className="toolbar-divider" />
        <button className="toolbar-button" onClick={() => insertText('# ')} title="Heading">
          <Heading1 size={14} />
        </button>
        <button className="toolbar-button" onClick={() => insertText('`', '`')} title="Code">
          <Code size={14} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => insertText('$', '$')}
          title="Math (Inline)"
        >
          <Sigma size={14} />
        </button>
        <div className="toolbar-divider" />
        <button className="toolbar-button" onClick={() => insertText('[', '](url)')} title="Link">
          <LinkIcon size={14} />
        </button>
        <ListDrawerToggler
          onClick={openDrawer}
          className="toolbar-button toolbar-button--media"
          title="Attach media"
        >
          <ImageIcon size={14} />
        </ListDrawerToggler>
      </div>

      <textarea
        ref={textareaRef}
        className="inline-rich-text-textarea"
        style={{ minHeight }}
        value={value.value}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
        placeholder={placeholder}
      />

      {value.mediaIds && value.mediaIds.length > 0 && (
        <div className="inline-rich-text-media">
          {loadingMedia && <div className="inline-rich-text-media-loading">Loading media...</div>}
          {!loadingMedia && mediaItems.length > 0 && (
            <div className="inline-rich-text-media-list">
              {mediaItems.map((item) => {
                const isImage = item.type === 'image'
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const itemAny = item as any
                // Use thumbnailURL (set by adminThumbnail) first, then fall back to sizes.thumbnail.url
                const thumbnailUrl = item.thumbnailURL || itemAny.sizes?.thumbnail?.url || item.url
                return (
                  <div key={item.id} className="inline-rich-text-media-item">
                    {/* Show thumbnail for images OR for external media with thumbnailUrl */}
                    {thumbnailUrl && (isImage || item.type === 'external') ? (
                      <Image
                        src={thumbnailUrl}
                        alt={item.alt || item.filename || 'Media'}
                        width={40}
                        height={40}
                        className="inline-rich-text-media-thumb"
                      />
                    ) : (
                      <div className="inline-rich-text-media-icon">
                        <ImageIcon size={16} />
                      </div>
                    )}
                    <span className="inline-rich-text-media-name">{item.filename}</span>
                    <button
                      type="button"
                      className="inline-rich-text-media-remove"
                      onClick={() => handleRemoveMedia(item.id)}
                      title="Remove media"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="inline-rich-text-footer">{value.value.length} characters</div>

      <ListDrawer onSelect={handleDrawerSelect} />
    </div>
  )
}
