'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Loader2, PlusCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AskMediaAttachEvent, ExerciseFile } from '../ask-types'
import { ASK_MEDIA_ATTACH_EVENT } from '../ask-types'
import { AskExerciseCard } from '../AskExerciseCard'

function dispatchMediaAttach(detail: AskMediaAttachEvent) {
  window.dispatchEvent(new CustomEvent(ASK_MEDIA_ATTACH_EVENT, { detail }))
}

export function AskPrimaryContent() {
  const t = useTranslations('homepage.ask')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentFile, setCurrentFile] = useState<ExerciseFile | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Revoke blob URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (currentFile?.url.startsWith('blob:')) URL.revokeObjectURL(currentFile.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only on unmount
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input immediately so same file can be re-uploaded
    e.target.value = ''

    // Revoke previous blob URL before replacing
    if (currentFile?.url.startsWith('blob:')) {
      URL.revokeObjectURL(currentFile.url)
    }

    // Show preview immediately via object URL
    const previewUrl = URL.createObjectURL(file)
    const title = file.name.replace(/\.[^/.]+$/, '')
    const fileId = Date.now()
    const newFile: ExerciseFile = {
      id: fileId,
      title,
      url: previewUrl,
      date: new Date().toLocaleDateString('he-IL'),
      isUploading: true,
    }
    setCurrentFile(newFile)
    setIsUploading(true)

    try {
      // Upload to /api/media so the AI can access this image
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) throw new Error('Upload failed')

      const doc = await response.json()
      const mediaId = doc.doc?.id || doc.id
      const filename = doc.doc?.filename || doc.filename || file.name

      // Mark upload complete and store mediaId
      setCurrentFile((prev) =>
        prev && prev.id === fileId ? { ...prev, mediaId, isUploading: false } : prev,
      )

      // Notify the chat pane — this becomes the persistent image for all messages
      dispatchMediaAttach({ mediaId, filename })
    } catch {
      toast.error(t('uploadFailed'))
      URL.revokeObjectURL(previewUrl)
      setCurrentFile(null)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <header className="mb-10 text-center md:text-right">
          <h1 className="text-4xl font-black mb-2">{t('pageTitle')}</h1>
          <p className="text-muted-foreground">{t('pageSubtitle')}</p>
        </header>

        {/* Show upload button only if no media has been attached yet */}
        {!currentFile?.mediaId && (
          <div className="flex justify-center mb-10">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl font-black bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg hover:-translate-y-0.5 group disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <PlusCircle className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
              )}
              <span>{t('uploadButton')}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        )}

        {currentFile && <AskExerciseCard file={currentFile} />}
      </div>
    </div>
  )
}
