/**
 * useDirectChatAssetUpload Hook
 * Handles direct-to-Blob uploads for chat assets
 */

import { useCallback, useState, useEffect } from 'react'

import { upload } from '@vercel/blob/client'

import { CHAT_ASSET_ALLOWED_MIME_TYPES, CHAT_ASSET_MAX_BYTES } from '@/server/chat-assets/constants'

export interface UploadingFile {
  localId: string
  file: File
  status: 'queued' | 'uploading' | 'uploaded' | 'finalizing' | 'complete' | 'failed' | 'cancelled'
  progress: number
  retryCount: number
  chatAssetId?: string
  chatAsset?: {
    id: string
    url: string
    pathname: string
    originalFilename: string
    mimeType: string
    filesize: number
    expiresAt: string
  }
  error?: string
  abortController?: AbortController
  uploadSessionId?: string
}

interface UseDirectChatAssetUploadReturn {
  uploadingFiles: UploadingFile[]
  addFiles: (files: FileList | File[]) => void
  addFile: (file: File) => void
  cancelFile: (localId: string) => void
  retryFile: (localId: string) => void
  removeFile: (localId: string) => void
  clearCompleted: () => void
  clearAll: () => void
  isUploading: boolean
  completedAssetIds: string[]
}

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000
const MAX_CONCURRENT_UPLOADS = 3

function generateLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function isRetryableError(status: number): boolean {
  return status === 0 || status === 429 || status >= 500
}

export function useDirectChatAssetUpload(): UseDirectChatAssetUploadReturn {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [uploadQueue, setUploadQueue] = useState<string[]>([])

  const addFile = useCallback((file: File) => {
    const localId = generateLocalId()

    setUploadingFiles((prev) => [
      ...prev,
      {
        localId,
        file,
        status: 'queued',
        progress: 0,
        retryCount: 0,
      },
    ])

    setUploadQueue((prev) => [...prev, localId])
  }, [])

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      for (const file of fileArray) {
        addFile(file)
      }
    },
    [addFile],
  )

  const cancelFile = useCallback((localId: string) => {
    setUploadingFiles((prev) =>
      prev.map((f) => {
        if (f.localId === localId) {
          if (f.abortController) {
            f.abortController.abort()
          }
          return { ...f, status: 'cancelled' as const, abortController: undefined }
        }
        return f
      }),
    )
  }, [])

  const removeFile = useCallback((localId: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.localId !== localId))
  }, [])

  const clearCompleted = useCallback(() => {
    setUploadingFiles((prev) =>
      prev.filter(
        (f) => f.status !== 'complete' && f.status !== 'cancelled' && f.status !== 'failed',
      ),
    )
  }, [])

  const clearAll = useCallback(() => {
    setUploadingFiles((prev) => {
      for (const f of prev) {
        if (f.abortController) f.abortController.abort()
      }
      return []
    })
    setUploadQueue([])
  }, [])

  const uploadAndFinalize = useCallback(async (fileRecord: UploadingFile) => {
    const { file, localId } = fileRecord

    if (file.size > CHAT_ASSET_MAX_BYTES) {
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.localId === localId
            ? { ...f, status: 'failed' as const, error: 'File size exceeds maximum' }
            : f,
        ),
      )
      return
    }

    if (
      !CHAT_ASSET_ALLOWED_MIME_TYPES.includes(
        file.type as (typeof CHAT_ASSET_ALLOWED_MIME_TYPES)[number],
      )
    ) {
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.localId === localId
            ? { ...f, status: 'failed' as const, error: 'File type not allowed' }
            : f,
        ),
      )
      return
    }

    const abortController = new AbortController()
    const clientPayload = JSON.stringify({
      originalFilename: file.name,
      contentType: file.type,
      size: file.size,
      purpose: 'chat-media',
    })

    setUploadingFiles((prev) =>
      prev.map((f) =>
        f.localId === localId
          ? { ...f, status: 'uploading' as const, progress: 0, abortController }
          : f,
      ),
    )

    try {
      const pathname = `chat-assets/pending/${localId}/${file.name}`

      const blobResult = await upload(pathname, file, {
        access: 'public',
        clientPayload,
        handleUploadUrl: '/api/blob/upload-token',
      })

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.localId === localId ? { ...f, status: 'finalizing' as const, progress: 100 } : f,
        ),
      )

      // Try to get uploadSessionId from tokenPayload, otherwise use the localId as fallback
      let uploadSessionIdVal = localId
      try {
        const rawTokenPayload = (blobResult as { tokenPayload?: string }).tokenPayload
        if (rawTokenPayload) {
          const parsed = JSON.parse(rawTokenPayload) as { uploadSessionId?: unknown }
          if (parsed && typeof parsed.uploadSessionId === 'string') {
            uploadSessionIdVal = parsed.uploadSessionId
          }
        }
      } catch {
        // Ignore parse errors - use localId fallback
      }

      const finalizeResponse = await fetch('/api/chat-assets/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadSessionId: uploadSessionIdVal || '' }),
      })

      if (!finalizeResponse.ok) {
        const errorData = await finalizeResponse.json()
        throw new Error(errorData.error || 'Finalize failed')
      }

      const finalizeResult = await finalizeResponse.json()

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.localId === localId
            ? {
                ...f,
                status: 'complete' as const,
                chatAssetId: finalizeResult.chatAssetId,
                chatAsset: finalizeResult.chatAsset,
              }
            : f,
        ),
      )
    } catch (error) {
      const statusVal: number =
        error instanceof Error && 'status' in error && typeof error.status === 'number'
          ? error.status
          : 0
      const canRetry = isRetryableError(statusVal)

      setUploadingFiles((prev) => {
        const currentFile = prev.find((f) => f.localId === localId)
        if (!currentFile) return prev

        const retryCountNum = currentFile.retryCount ?? 0
        const shouldRetry = canRetry && retryCountNum < MAX_RETRIES

        if (shouldRetry) {
          const delay = BASE_DELAY_MS * Math.pow(2, retryCountNum) + Math.random() * 500
          setTimeout(() => setUploadQueue((q) => [...q, localId]), delay)

          return prev.map((f) =>
            f.localId === localId
              ? { ...f, retryCount: retryCountNum + 1, status: 'queued' as const }
              : f,
          )
        }

        const errorMessage = error instanceof Error ? error.message : 'Upload failed'
        return prev.map((f) =>
          f.localId === localId
            ? { ...f, status: 'failed' as const, error: errorMessage, abortController: undefined }
            : f,
        )
      })
    }
  }, [])

  useEffect(() => {
    const uploading = uploadingFiles.filter(
      (f) => f.status === 'uploading' || f.status === 'finalizing',
    )
    const uploadingCount = uploading.length

    if (uploadQueue.length > 0 && uploadingCount < MAX_CONCURRENT_UPLOADS) {
      const nextLocalId = uploadQueue[0]
      const fileToUpload = uploadingFiles.find((f) => f.localId === nextLocalId)

      if (fileToUpload && fileToUpload.status === 'queued') {
        setUploadQueue((prev) => prev.slice(1))
        uploadAndFinalize(fileToUpload)
      }
    }
  }, [uploadingFiles, uploadQueue, uploadAndFinalize])

  const retryFile = useCallback(
    (localId: string) => {
      const fileRecord = uploadingFiles.find((f) => f.localId === localId)
      if (fileRecord && (fileRecord.status === 'failed' || fileRecord.status === 'queued')) {
        setUploadQueue((prev) => [...prev, localId])
      }
    },
    [uploadingFiles],
  )

  const isUploading = uploadingFiles.some(
    (f) => f.status === 'uploading' || f.status === 'finalizing',
  )
  const completedAssetIds = uploadingFiles
    .filter((f) => f.status === 'complete' && f.chatAssetId)
    .map((f) => f.chatAssetId!)

  return {
    uploadingFiles,
    addFiles,
    addFile,
    cancelFile,
    retryFile,
    removeFile,
    clearCompleted,
    clearAll,
    isUploading,
    completedAssetIds,
  }
}
