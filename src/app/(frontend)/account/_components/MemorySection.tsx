'use client'

import { useCallback, useEffect, useState } from 'react'

import { cn } from '@/infra/utils/ui'
import type { User } from '@/payload-types'
import { Button } from '@/ui/web/components/button'
import { Card } from '@/ui/web/components/card'
import { useTranslations } from '@/ui/web/providers/I18n'
import { toast } from 'sonner'
import { Brain, Trash2 } from 'lucide-react'

interface MemoryItemData {
  id: string
  type: string
  text: string
  importance: number
  status: string
  contextKey?: string
  contextLevel?: string
  createdAt: string
}

interface MemorySectionProps {
  user: User
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

export function MemorySection({ user: _user }: MemorySectionProps) {
  const t = useTranslations('auth.account.memory')
  const [items, setItems] = useState<MemoryItemData[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch('/api/account/memory')
      if (res.status === 401) {
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error()
      const data = await res.json()
      setItems(data.items ?? [])
    } catch {
      toast.error(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleDeleteItem = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/account/memory/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setItems((prev) => prev.filter((item) => item.id !== id))
      toast.success(t('deleteSuccess'))
    } catch {
      toast.error(t('deleteFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleClearAll = async () => {
    if (!confirm(t('clearAllConfirm'))) return

    setClearingAll(true)
    try {
      const res = await fetch('/api/account/memory/clear', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setItems([])
      toast.success(t('clearAllSuccess'))
    } catch {
      toast.error(t('clearAllFailed'))
    } finally {
      setClearingAll(false)
    }
  }

  if (loading) {
    return (
      <div className="py-content-gap">
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    )
  }

  return (
    <div className="py-content-gap space-y-4">
      <p className="text-body-sm text-muted-foreground">{t('description')}</p>

      {items.length === 0 ? (
        <div className="text-center py-section-md">
          <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Brain className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <p className="text-body-sm font-medium text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className="p-card-padding group hover:border-primary/30 transition-all duration-normal"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-label text-muted-foreground/70 uppercase tracking-wide">
                      {MEMORY_TYPE_LABELS[item.type] ?? item.type}
                    </span>
                    {item.contextLevel && (
                      <span className="text-body-xs text-muted-foreground/50">
                        · {item.contextLevel}
                      </span>
                    )}
                    <span className="ml-auto text-body-xs text-muted-foreground/50">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-body-sm text-foreground line-clamp-3">{item.text}</p>
                  {item.contextKey && (
                    <p className="text-body-xs text-muted-foreground/40 mt-1">{item.contextKey}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'shrink-0 text-destructive hover:text-destructive transition-all duration-normal',
                    deletingId === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                  )}
                  onClick={() => handleDeleteItem(item.id)}
                  disabled={deletingId === item.id}
                  aria-label={t('deleteItemAria')}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}

          {/* Forget everything button */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={handleClearAll}
              disabled={clearingAll}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {clearingAll ? t('clearingAll') : t('forgetEverything')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
