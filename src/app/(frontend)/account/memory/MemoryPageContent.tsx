'use client'

import { useCallback, useEffect, useState } from 'react'

import { Card } from '@/ui/web/components/card'
import { Input } from '@/ui/web/components/input'
import { PageTransition } from '@/ui/web/components/page-transition'
import { Skeleton } from '@/ui/web/components/skeleton'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { Search, X } from 'lucide-react'

interface MemoryItem {
  _id: string
  type: string
  text: string
  importance: number
  createdAt: string
  contextKey?: string
}

interface MemoryResponse {
  memories: MemoryItem[]
  total: number
  searched: boolean
}

const MEMORY_TYPE_LABELS: Record<string, string> = {
  preference: 'Preference',
  decision: 'Decision',
  fact: 'Fact',
  open_loop: 'Open Loop',
  profile: 'Profile',
  constraint: 'Constraint',
  other: 'Other',
}

const IMPORTANCE_STARS = (importance: number) => '★'.repeat(importance) + '☆'.repeat(5 - importance)

function formatDate(dateString: string, locale: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function MemoryPageContent({ userId: _userId }: { userId: string }) {
  const t = useTranslations('auth.account')
  const locale = useLocale()
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searched, setSearched] = useState(false)

  const fetchMemories = useCallback(async (query?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query && query.trim().length >= 2) {
        params.set('q', query.trim())
      }

      const response = await fetch(`/api/account/memory?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!response.ok) {
        setMemories([])
        return
      }

      const data: MemoryResponse = await response.json()
      setMemories(data.memories)
      setSearched(data.searched)
    } catch {
      setMemories([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchMemories(searchQuery)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    fetchMemories('')
  }

  return (
    <PageTransition>
      <div className="container py-section-md">
        <div className="mx-auto max-w-2xl space-y-content-gap">
          <div className="space-y-2">
            <h1 className="text-display-sm font-bold">{t('memoryTitle')}</h1>
            <p className="text-body-sm text-muted-foreground">{t('memoryDescription')}</p>
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>

          {/* Results info */}
          {!loading && (
            <p className="text-body-sm text-muted-foreground">
              {searched
                ? memories.length > 0
                  ? `${memories.length} results for "${searchQuery}"`
                  : t('noMemoriesFound')
                : `${memories.length} total memories`}
            </p>
          )}

          {/* Loading State */}
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border bg-card p-card-padding">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && memories.length === 0 && (
            <Card className="p-card-padding text-center">
              <p className="text-body-md text-muted-foreground">
                {searched ? t('noMemoriesFound') : t('noMemories')}
              </p>
            </Card>
          )}

          {/* Memory List */}
          {!loading && memories.length > 0 && (
            <div className="space-y-3">
              {memories.map((memory) => (
                <Card key={memory._id} className="p-card-padding">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-body-xs font-medium text-muted-foreground">
                        {t('memoryItemType')}: {MEMORY_TYPE_LABELS[memory.type] || memory.type}
                      </span>
                      <span className="text-body-xs text-muted-foreground">
                        {IMPORTANCE_STARS(memory.importance)}
                      </span>
                    </div>
                    <p className="text-body-md">{memory.text}</p>
                    <p className="text-body-xs text-muted-foreground">
                      {t('memoryItemDate')}: {formatDate(memory.createdAt, locale)}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
