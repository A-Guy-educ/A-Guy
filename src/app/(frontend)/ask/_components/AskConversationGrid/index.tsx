'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Sparkles } from 'lucide-react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { useExamCountdown } from '@/client/hooks/useExamCountdown'
import { useTranslations } from '@/ui/web/providers/I18n'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { cn } from '@/infra/utils/ui'
import { logger } from '@/infra/utils/logger'

interface ConversationItem {
  id: string
  contextKey?: string
  title: string
  lastMessageAt: string
  messageCount: number
}

interface CourseInfo {
  courseId: string
  courseTitle: string
  courseLabel: string
  courseSlug: string
}

export function AskConversationGrid() {
  const t = useTranslations('coursePage')
  const ts = useTranslations('study')
  const router = useRouter()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  async function handleNewQuestion() {
    if (isCreating || !courseInfo?.courseId) return
    setIsCreating(true)
    try {
      const res = await fetch('/api/conversations/by-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courseId: courseInfo.courseId }),
      })
      if (res.ok) {
        const { id, contextKey } = await res.json()
        router.push(`/ask?chat=${id}&ctx=${encodeURIComponent(contextKey)}`)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error')
      logger.error({ err }, 'Failed to create conversation')
    } finally {
      setIsCreating(false)
    }
  }

  useEffect(() => {
    async function loadData() {
      const profile = getUserProfile()
      if (!profile?.gradeLevel) {
        window.location.href = '/'
        return
      }

      try {
        const res = await fetch(`/api/chapters/by-grade?grade=${profile.gradeLevel}`)
        if (res.ok) {
          const data = await res.json()
          const courseId = data.courseId || ''
          setCourseInfo({
            courseId,
            courseTitle: data.courseTitle || '',
            courseLabel: data.courseLabel || '',
            courseSlug: data.courseSlug || '',
          })

          if (courseId) {
            const convRes = await fetch(
              `/api/conversations/by-context?contextKeyPrefix=ask:${courseId}&limit=20`,
              { credentials: 'include' },
            )
            if (convRes.ok) {
              const convData = await convRes.json()
              setConversations(convData.conversations || [])
            }
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error')
        logger.error({ err }, 'Failed to load ask data')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">{ts('loading')}</div>
      </div>
    )
  }

  return (
    <>
      {/* Grade + Exam Reminder */}
      <GradeSection
        courseId={courseInfo?.courseId ?? ''}
        courseLabel={courseInfo?.courseLabel ?? ''}
      />

      {/* Main Content */}
      <main className="container mx-auto px-6 py-10 max-w-5xl">
        <section className="mb-8 text-right px-2">
          <h2 className="text-2xl md:text-3xl font-black text-foreground leading-tight">
            {t('sectionTitle.ask')}
          </h2>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* New Question Card */}
          <button
            disabled={isCreating}
            onClick={handleNewQuestion}
            className={cn(
              'bg-primary text-primary-foreground rounded-3xl p-6 shadow-card',
              'flex items-center justify-between',
              'border border-transparent hover:opacity-95',
              'transition-all cursor-pointer active:scale-[0.98]',
              'text-right',
            )}
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-primary-foreground/60 mb-1 uppercase tracking-wide">
                {t('quickAction')}
              </span>
              <h3 className="text-xl font-bold">{t('newQuestion')}</h3>
              <p className="text-xs text-primary-foreground/70 mt-1">{t('newQuestionSub')}</p>
            </div>
            <div className="w-14 h-14 bg-primary-foreground/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground fill-current" />
            </div>
          </button>

          {/* Past Conversation Cards */}
          {conversations.map((conv, idx) => (
            <SystemLink
              key={conv.id}
              href={`/ask?chat=${conv.id}&ctx=${encodeURIComponent(conv.contextKey ?? '')}`}
              className={cn(
                'bg-card rounded-3xl p-6 shadow-card',
                'flex items-center justify-between',
                'border border-transparent hover:border-primary/20',
                'transition-all cursor-pointer active:scale-[0.98]',
              )}
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wide">
                  {t('question')} {conversations.length - idx}
                </span>
                <h3 className="text-lg font-bold text-card-foreground">{conv.title || '...'}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {conv.messageCount} {conv.messageCount === 1 ? 'message' : 'messages'}
                </p>
              </div>
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center border border-border">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
              </div>
            </SystemLink>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border text-center">
          <div className="flex flex-wrap justify-center gap-4">
            <button className="text-sm font-bold text-muted-foreground bg-card shadow-card px-8 py-3 rounded-full hover:bg-muted transition-all text-nowrap">
              {t('viewStats')}
            </button>
            <button className="text-sm font-bold text-primary-foreground bg-primary px-8 py-3 rounded-full shadow-lg hover:opacity-90 transition-all text-nowrap">
              {t('continueLastPoint')}
            </button>
          </div>
        </div>
      </main>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Grade section with exam reminder                                    */
/* ------------------------------------------------------------------ */

function GradeSection({ courseId, courseLabel }: { courseId: string; courseLabel: string }) {
  const t = useTranslations('coursePage')
  const { hasUpcomingExam, daysUntil } = useExamCountdown(courseId)

  return (
    <div className="w-full bg-card/50 py-4 border-b border-border">
      <div className="max-w-5xl mx-auto px-6 flex flex-col">
        <div className="text-center">
          <span className="text-sm md:text-base font-extrabold text-primary uppercase tracking-[0.3em]">
            {t('grade')} {courseLabel}
          </span>
        </div>
        {hasUpcomingExam && daysUntil !== null && (
          <div className="flex items-center justify-end gap-3 mt-3 animate-in fade-in">
            <div className="bg-card shadow-card border border-primary/10 rounded-2xl rounded-tr-none px-4 py-2">
              <p className="text-xs md:text-sm font-bold text-primary">
                {t('examReminder').replace('{days}', String(daysUntil))}
              </p>
            </div>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-md shrink-0">
              <Sparkles className="w-4 h-4 text-primary-foreground fill-current" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
