'use client'

import React, { useEffect, useRef, useLayoutEffect } from 'react'
import { Lightbulb, CheckCircle, BookOpen } from 'lucide-react'
import { useTranslations } from '@/providers/I18n'
import './index.scss'

export function NotebookChat() {
  const t = useTranslations('courses')
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }

  useLayoutEffect(() => {
    // Scroll to bottom immediately after layout
    scrollToBottom()
  }, [])

  useEffect(() => {
    // Also scroll after a brief delay to handle any async rendering
    const timer = setTimeout(() => {
      scrollToBottom()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="notebook-chat">
      <div ref={messagesContainerRef} className="notebook-chat__messages">
        <div className="notebook-chat__bubble">{t('chatWelcome')}</div>
        <div ref={messagesEndRef} />
      </div>

      <div className="notebook-chat__actions">
        <button className="notebook-chat__action">
          <Lightbulb className="w-6 h-6 text-yellow-400" />
          <span>{t('chatHint')}</span>
        </button>
        <button className="notebook-chat__action">
          <CheckCircle className="w-6 h-6 text-green-500" />
          <span>{t('chatSolution')}</span>
        </button>
        <button className="notebook-chat__action">
          <BookOpen className="w-6 h-6 text-blue-500" />
          <span>{t('chatFullSolution')}</span>
        </button>
      </div>

      <div className="notebook-chat__footer">
        <input
          type="text"
          className="notebook-chat__input"
          placeholder={t('chatInputPlaceholder')}
          disabled
        />
        <button className="notebook-chat__send" disabled>
          {t('chatSend')}
        </button>
      </div>
    </div>
  )
}
