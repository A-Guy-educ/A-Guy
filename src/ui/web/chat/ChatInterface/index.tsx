'use client'

import { ChatMessageRole } from '@/infra/llm/chat-message-role'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { Loader2, Send, Plus, X, Image as ImageIcon, FileUp } from 'lucide-react'
import React from 'react'
import { ChatMessageContent } from '../ChatMessageContent'
import { useNotebookChat } from '../hooks/useNotebookChat'

interface ChatInterfaceProps {
  courseId?: string
  lessonId?: string
  exerciseId?: string
  translationNamespace?: string
}

export function ChatInterface({
  courseId,
  lessonId,
  exerciseId,
  translationNamespace = 'homepage.ask',
}: ChatInterfaceProps) {
  const t = useTranslations(translationNamespace)
  const tCourses = useTranslations('courses')

  const {
    messages,
    inputValue,
    isLoading,
    isLoadingHistory,
    messagesContainerRef,
    messagesEndRef,
    inputRef,
    fileInputRef,
    setInputValue,
    handleSubmit,
    // Media upload
    uploadedMedia,
    isUploading,
    handleFileSelect,
    removeMedia,
    openFilePicker,
  } = useNotebookChat({
    initialMessage: t('chatWelcome'),
    authRequiredMessage: t('chatAuthRequired'),
    errorMessage: tCourses('chatError'),
    hintPrompt: tCourses('chatHintPrompt'),
    solutionPrompt: tCourses('chatSolutionPrompt'),
    fullSolutionPrompt: tCourses('chatFullSolutionPrompt'),
    resetConfirmMessage: tCourses('chatResetConfirm'),
    resetSuccessMessage: tCourses('chatResetSuccess'),
    resetErrorMessage: tCourses('chatResetError'),
    acknowledgment: tCourses('chatAIAcknowledgment'),
    courseId,
    lessonId,
    exerciseId,
    // Media upload messages
    unsupportedFileTypeMessage: tCourses('chatUnsupportedFileType'),
    fileTooLargeMessage: tCourses('chatFileTooLarge'),
    maxFilesMessage: tCourses('chatMaxFiles'),
    uploadFailedMessage: tCourses('chatUploadFailed'),
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSubmit(e)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages Area */}
      <div ref={messagesContainerRef} className="flex-grow overflow-y-auto p-5 space-y-4 min-h-0">
        {isLoadingHistory && (
          <div className="flex items-center justify-center p-4 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {tCourses('chatLoadingHistory')}
          </div>
        )}
        {!isLoadingHistory &&
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                'max-w-[85%] px-[18px] py-3.5 text-base leading-relaxed shadow-sm',
                msg.role === ChatMessageRole.User
                  ? 'ml-auto bg-primary text-primary-foreground rounded-[20px] rounded-bl-[4px]'
                  : 'mr-auto bg-card text-foreground border border-border rounded-[20px] rounded-br-[4px]',
              )}
            >
              <ChatMessageContent content={msg.content} />
            </div>
          ))}
        {isLoading && (
          <div className="mr-auto bg-card text-foreground border border-border px-[18px] py-3.5 rounded-[20px] rounded-br-[4px] max-w-[85%] flex items-center gap-2 shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{tCourses('chatThinking')}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Container */}
      <div className="flex-grow-0 flex-shrink-0 bg-card border-t border-border p-5 pb-8">
        {/* Media Preview Chips */}
        {uploadedMedia.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5 max-w-[850px] mx-auto">
            {uploadedMedia.map((media) => (
              <div
                key={media.id}
                className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1.5 text-sm border border-input"
              >
                {media.mimeType.startsWith('image/') ? (
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <FileUp className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="max-w-[120px] truncate text-foreground">{media.filename}</span>
                <button
                  type="button"
                  onClick={() => removeMedia(media.id)}
                  className="p-0.5 hover:bg-destructive/20 rounded-full transition-colors"
                  aria-label={tCourses('chatRemoveFile')}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleFormSubmit}>
          <div className="max-w-[850px] mx-auto bg-muted rounded-[30px] flex items-center px-4 py-1.5 border border-input gap-3">
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent border-none outline-none py-2.5 text-[17px] text-foreground placeholder:text-muted-foreground"
              placeholder={t('chatInputPlaceholder')}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleFormSubmit(e as unknown as React.FormEvent)
                }
              }}
              disabled={isLoading}
            />

            {/* File Upload */}
            <button
              type="button"
              className={cn(
                'p-1.5 text-muted-foreground hover:text-primary transition-colors',
                isUploading && 'opacity-50 cursor-not-allowed',
              )}
              onClick={openFilePicker}
              disabled={isUploading || uploadedMedia.length >= 5}
              aria-label={tCourses('chatAttachFile')}
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            {/* Send Button */}
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-input hover:bg-primary/90 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !inputValue.trim()}
              aria-label={tCourses('sendMessage')}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
