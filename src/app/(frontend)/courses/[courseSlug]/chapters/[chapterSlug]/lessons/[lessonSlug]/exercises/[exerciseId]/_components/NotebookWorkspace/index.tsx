'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageSquare, BookOpen, PenLine, X, Menu } from 'lucide-react'
import { cn } from '@/utilities/ui'
import { useTranslations } from '@/ui/providers/I18n'

type SidebarTab = 'chat' | 'formulas' | 'notes'

interface NotebookWorkspaceProps {
  content: React.ReactNode
  chat: React.ReactNode
  formulas: React.ReactNode
  notes: React.ReactNode
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
}

export function NotebookWorkspace({
  content,
  chat,
  formulas,
  notes,
  courseSlug,
  chapterSlug,
  lessonSlug,
}: NotebookWorkspaceProps) {
  const t = useTranslations('courses')
  const [activeTab, setActiveTab] = useState<SidebarTab>('chat')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const lessonUrl = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isSidebarOpen])

  return (
    <div className="fixed inset-0 bg-background z-50 flex min-h-0 overflow-hidden">
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] transition-opacity duration-300 lg:hidden',
          isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Mobile menu button */}
      <button
        className="fixed top-4 left-4 z-[60] w-11 h-11 rounded-lg bg-card border border-border text-foreground flex items-center justify-center shadow-lg transition-all hover:bg-muted lg:hidden"
        onClick={() => setIsSidebarOpen(true)}
        aria-label="Open notebook"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto p-8 flex justify-center items-start bg-background min-h-0 lg:mr-[360px]">
        <div className="w-full max-w-[920px] max-h-full bg-card border border-border rounded-[10px] p-12 text-foreground shadow-[0_10px_30px_hsl(var(--border))] overflow-auto flex flex-col lg:p-8 md:max-w-full md:w-full md:min-w-0 md:rounded-none md:border-l-0 md:border-r-0 md:border-t-0 md:shadow-none sm:p-6">
          {content}
        </div>
      </main>

      {/* Sidebar */}
      <aside
        className={cn(
          'w-[360px] bg-card border-l border-border flex flex-col min-h-0 overflow-hidden fixed top-0 right-0 h-screen z-50 transition-transform duration-300 md:w-80 lg:translate-x-0',
          isSidebarOpen
            ? 'translate-x-0 z-[60] shadow-[-4px_0_16px_hsl(var(--black)_/_0.1)]'
            : 'translate-x-full lg:translate-x-0',
        )}
      >
        <header className="flex-col p-6 pb-0 bg-card border-b border-border gap-4 flex-shrink-0 overflow-visible flex">
          <div className="flex items-center justify-between">
            <span className="bg-muted text-foreground px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide">
              {t('notebookTitle')}
            </span>
            <Link
              href={lessonUrl}
              className="flex items-center justify-center w-8 h-8 rounded-md bg-transparent text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-label="Close notebook"
            >
              <X className="w-5 h-5" />
            </Link>
          </div>

          <nav className="flex gap-0 border-t border-border">
            <button
              className={cn(
                'flex items-center gap-2 py-1.5 px-0 bg-transparent border-none border-b-[3px] text-[0.95rem] font-semibold transition-all cursor-pointer',
                activeTab === 'chat'
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground',
              )}
              type="button"
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare className="w-4 h-4" />
              <span>{t('chatTab')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('formulas')}
              className={cn(
                'flex items-center gap-2 py-1.5 px-0 ml-6 bg-transparent border-none border-b-[3px] text-[0.95rem] font-semibold transition-all cursor-pointer',
                activeTab === 'formulas'
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground',
              )}
            >
              <BookOpen className="w-4 h-4" />
              <span>{t('formulasTab')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className={cn(
                'flex items-center gap-2 py-1.5 px-0 ml-6 bg-transparent border-none border-b-[3px] text-[0.95rem] font-semibold transition-all cursor-pointer',
                activeTab === 'notes'
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground',
              )}
            >
              <PenLine className="w-4 h-4" />
              <span>{t('notesTab')}</span>
            </button>
          </nav>
        </header>

        <div
          className={cn(
            'flex-1 min-h-0 flex flex-col overflow-hidden',
            activeTab !== 'chat' && 'hidden',
          )}
        >
          {chat}
        </div>
        <div
          className={cn(
            'flex-1 min-h-0 overflow-y-auto bg-card pt-0 flex flex-col',
            activeTab === 'chat' && 'hidden',
          )}
        >
          {activeTab === 'formulas' && formulas}
          {activeTab === 'notes' && notes}
        </div>
      </aside>
    </div>
  )
}
