'use client'

import { useAuth } from '@payloadcms/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import { ChatInterface } from '@/ui/web/chat/ChatInterface'
import { MessageSquare, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useState } from 'react'

interface AdminChatLauncherProps {
  translationNamespace?: string
}

export function AdminChatLauncher({ translationNamespace = 'admin.chat' }: AdminChatLauncherProps) {
  const { user } = useAuth()
  const t = useTranslations(translationNamespace)
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Handle Escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false)
  }, [])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleEscape)
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, handleEscape])

  // Mount check for portal rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!user) return null

  const buttonContent = (
    <button
      onClick={() => setIsOpen(true)}
      aria-label={String(t('openChat')) || 'Open AI Chat'}
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-card-hover flex items-center justify-center hover:scale-105 transition-all duration-normal cursor-pointer z-fixed"
    >
      <MessageSquare size={24} />
    </button>
  )

  const modalContent = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false)
      }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal"
    >
      <div className="w-[90%] max-w-lg h-[70vh] max-h-[600px] bg-card rounded-xl flex flex-col overflow-hidden shadow-modal">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-border">
          <h3 className="m-0 text-body-md font-semibold text-foreground">
            {String(t('modalTitle')) || 'Admin AI Assistant'}
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="bg-none border-none cursor-pointer p-1 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 min-h-0">
          <ChatInterface
            adminMode
            userId={String(user.id)}
            translationNamespace={translationNamespace}
            displayMode="full"
          />
        </div>
      </div>
    </div>
  )

  if (!mounted) return null

  return (
    <>
      {createPortal(buttonContent, document.body)}
      {isOpen && createPortal(modalContent, document.body)}
    </>
  )
}

export default AdminChatLauncher
