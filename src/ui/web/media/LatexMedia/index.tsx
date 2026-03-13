'use client'

import React, { useEffect, useState } from 'react'

import { getMediaUrl } from '@/infra/utils/getMediaUrl'
import { cn } from '@/infra/utils/ui'
import { LatexDocumentViewer } from '@/ui/web/shared/LatexDocumentViewer'
import type { Props as MediaProps } from '../types'

export const LatexMedia: React.FC<MediaProps> = (props) => {
  const { resource, className } = props
  const [latex, setLatex] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const fileUrl = React.useMemo(() => {
    if (resource && typeof resource === 'object') {
      const { url, filename } = resource
      if (url) return getMediaUrl(url)
      if (filename) return getMediaUrl(`/media/${filename}`)
    }
    return null
  }, [resource])

  const title = React.useMemo(() => {
    if (resource && typeof resource === 'object') {
      return resource.filename?.replace(/\.tex$/i, '') ?? undefined
    }
    return undefined
  }, [resource])

  useEffect(() => {
    if (!fileUrl) return
    let cancelled = false

    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((text) => {
        if (!cancelled) setLatex(text)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [fileUrl])

  if (!fileUrl) return null

  if (error) {
    return (
      <div className={cn('flex items-center justify-center p-8 text-muted-foreground', className)}>
        Failed to load LaTeX document
      </div>
    )
  }

  if (!latex) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    )
  }

  return <LatexDocumentViewer latex={latex} title={title} className={className} />
}
