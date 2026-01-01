'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageSquare, BookOpen, PenLine, X, Menu } from 'lucide-react'
import { cn } from '@/utilities/ui'
import { useTranslations } from '@/providers/I18n'
import './index.scss'

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
    <div className="notebook-workspace">
      <div className="notebook-workspace__body">
        {/* Mobile backdrop */}
        <div
          className={cn(
            'notebook-workspace__backdrop',
            isSidebarOpen && 'notebook-workspace__backdrop--open',
          )}
          onClick={() => setIsSidebarOpen(false)}
        />

        {/* Mobile menu button */}
        <button
          className="notebook-workspace__menu-button"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open notebook"
        >
          <Menu className="w-6 h-6" />
        </button>

        <aside
          className={cn(
            'notebook-workspace__sidebar',
            isSidebarOpen && 'notebook-workspace__sidebar--open',
          )}
        >
          <header className="notebook-workspace__header">
            <div className="notebook-workspace__header-top">
              <span className="notebook-workspace__badge">{t('notebookTitle')}</span>
              <div className="notebook-workspace__header-actions">
                <Link
                  href={lessonUrl}
                  className="notebook-workspace__close-mobile"
                  aria-label="Close notebook"
                >
                  <X className="w-5 h-5" />
                </Link>
                <Link
                  href={lessonUrl}
                  className="notebook-workspace__close"
                  aria-label="Close notebook"
                >
                  <X className="w-5 h-5" />
                </Link>
              </div>
            </div>

            <nav className="notebook-workspace__tabs">
              <button
                className={cn(
                  'notebook-workspace__tab',
                  activeTab === 'chat' && 'notebook-workspace__tab--active',
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
                  'notebook-workspace__tab',
                  activeTab === 'formulas' && 'notebook-workspace__tab--active',
                )}
              >
                <BookOpen className="w-4 h-4" />
                <span>{t('formulasTab')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className={cn(
                  'notebook-workspace__tab',
                  activeTab === 'notes' && 'notebook-workspace__tab--active',
                )}
              >
                <PenLine className="w-4 h-4" />
                <span>{t('notesTab')}</span>
              </button>
            </nav>
          </header>

          {activeTab === 'chat' && <div className="notebook-workspace__chat">{chat}</div>}
          {activeTab !== 'chat' && (
            <div className="notebook-workspace__tools">
              {activeTab === 'formulas' && formulas}
              {activeTab === 'notes' && notes}
            </div>
          )}
        </aside>

        <main className="notebook-workspace__content">
          <div className="notebook-workspace__paper">{content}</div>
        </main>
      </div>
    </div>
  )
}
