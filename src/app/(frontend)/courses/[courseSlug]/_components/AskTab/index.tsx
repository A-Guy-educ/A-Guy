'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import { ConversationCard } from '../ConversationCard'

interface ConversationSummary {
  id: string
  title: string
  lastMessageAt: string
  messageCount: number
}

interface AskTabProps {
  courseId: string
  accentColor?: string
}

const PAGE_SIZE = 10

export function AskTab({ courseId, accentColor }: AskTabProps) {
  const t = useTranslations('coursePage')
  const router = useRouter()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/conversations/by-context?contextKeyPrefix=ask:${encodeURIComponent(courseId)}&limit=100`,
      )
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations ?? [])
        setTotal(data.total ?? 0)
      }
    } catch {
      // Silently fail — conversations just won't show
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return
    try {
      await fetch(`/api/conversations/by-context?id=${id}`, { method: 'DELETE' })
      setConversations((prev) => prev.filter((c) => c.id !== id))
      setTotal((prev) => prev - 1)
    } catch {
      // Silent fail
    }
  }

  const visible = conversations.slice(0, visibleCount)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* New Question card */}
      <button
        onClick={() => router.push('/ask')}
        className={cn(
          'bg-primary text-primary-foreground rounded-3xl p-6 shadow-card',
          'flex items-center justify-between',
          'transition-all cursor-pointer border border-transparent hover:opacity-95',
          'text-start',
        )}
      >
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-primary-foreground/60 mb-1 uppercase tracking-wide">
            {t('quickAction')}
          </span>
          <h3 className="text-xl font-bold">{t('newQuestion')}</h3>
          <p className="text-xs text-primary-foreground/70 mt-1">{t('newQuestionSub')}</p>
        </div>
        <div className="w-14 h-14 bg-primary-foreground/20 rounded-full flex items-center justify-center shrink-0 ms-3">
          <Sparkles className="w-6 h-6 text-primary-foreground fill-current" />
        </div>
      </button>

      {loading && (
        <div className="col-span-full text-center text-muted-foreground py-8">{t('loading')}</div>
      )}

      {/* Conversation cards */}
      {visible.map((conv, idx) => (
        <ConversationCard
          key={conv.id}
          index={total - idx}
          title={conv.title || `${t('question')} ${total - idx}`}
          subtitle={`${conv.messageCount} messages`}
          onClick={() => router.push(`/ask?conversationId=${conv.id}`)}
          onDelete={() => handleDelete(conv.id)}
          accentColor={accentColor}
        />
      ))}

      {/* Show more */}
      {visibleCount < conversations.length && (
        <div className="col-span-full text-center pt-4">
          <Button variant="outline" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
            {t('showMore')}
          </Button>
        </div>
      )}
    </div>
  )
}
