/**
 * LessonRelationshipCell — renders lesson relationship column values in the
 * LessonDuplications list view by fetching titles directly from the API.
 *
 * This bypasses the RelationshipProvider batch-fetch mechanism which fails to
 * resolve relationship titles in the lesson-duplications list view.
 *
 * @fileType component
 * @domain admin
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from '@payloadcms/ui'

interface LessonRelationshipCellProps {
  cellData?:
    | Array<{ relationTo: string; value: string | number } | string | number>
    | {
        relationTo: string
        value: string | number
      }
    | string
    | number
  field?: {
    relationTo?: string | string[]
    collection?: string | string[]
  }
}

type FetchedTitle = { id: string | number; title: string | null }

const API_BASE = '/api'

async function fetchLessonTitles(
  ids: (string | number)[],
  locale: string,
): Promise<FetchedTitle[]> {
  if (ids.length === 0) return []

  const params = new URLSearchParams()
  params.append('depth', '0')
  params.append('limit', '250')
  params.append('where[id][in]', ids.map(String).join(','))
  if (locale) params.append('locale', locale)

  const url = `${API_BASE}/lessons?${params.toString()}`

  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept-Language': locale || 'en',
      },
    })

    if (!res.ok) return ids.map((id) => ({ id, title: null }))

    const json = await res.json()
    if (!json.docs) return ids.map((id) => ({ id, title: null }))

    return ids.map((id) => {
      const doc = json.docs.find((d: { id: string | number }) => String(d.id) === String(id))
      return { id, title: doc?.title ?? null }
    })
  } catch {
    return ids.map((id) => ({ id, title: null }))
  }
}

export const LessonRelationshipCell: React.FC<LessonRelationshipCellProps> = ({ cellData }) => {
  const { i18n } = useTranslation()
  const [titles, setTitles] = useState<FetchedTitle[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!cellData) return

    // Normalize cellData to array of {relationTo, value}
    let items: { relationTo: string; value: string | number }[] = []

    if (Array.isArray(cellData)) {
      items = cellData.map((item) => {
        if (typeof item === 'object' && item !== null && 'relationTo' in item && 'value' in item) {
          return item as { relationTo: string; value: string | number }
        }
        // Assume it's a raw ID
        return { relationTo: 'lessons', value: item as string | number }
      })
    } else if (typeof cellData === 'object' && cellData !== null && 'relationTo' in cellData) {
      items = [cellData as { relationTo: string; value: string | number }]
    } else {
      items = [{ relationTo: 'lessons', value: cellData as string | number }]
    }

    const lessonItems = items.filter((item) => item.relationTo === 'lessons')
    const ids = lessonItems.map((item) => item.value)

    if (ids.length === 0) {
      setTitles([])
      return
    }

    setLoading(true)
    fetchLessonTitles(ids, i18n.language)
      .then((fetched) => {
        setTitles(fetched)
        setLoading(false)
      })
      .catch(() => {
        setTitles(ids.map((id) => ({ id, title: null })))
        setLoading(false)
      })
  }, [cellData, i18n.language])

  if (loading) {
    return <span>{i18n.t('general:loading')}...</span>
  }

  if (titles.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <span>
      {titles.map((item, i) => (
        <span key={item.id}>
          {item.title || `${i18n.t('general:untitled')} – ID: ${item.id}`}
          {i < titles.length - 1 ? ', ' : ''}
        </span>
      ))}
    </span>
  )
}
