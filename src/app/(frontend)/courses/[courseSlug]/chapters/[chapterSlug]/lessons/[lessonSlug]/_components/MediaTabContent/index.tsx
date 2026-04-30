'use client'

/**
 * MediaTabContent
 *
 * Renders the lesson's attached media files (PDFs, videos, etc.) as the
 * "Media" tab inside the three-tab lesson view. Keeps the same ExerciseWorkspace
 * chrome (back button, title, optional chat panel) but shows the raw media
 * directly without the paging intro/outro of PdfLessonPager.
 */

import React from 'react'
import type { FormulaSheet, Media } from '@/payload-types'
import { ChatInterface } from '@/ui/web/chat'
import { Media as MediaComponent } from '@/ui/web/media'
import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'

interface MediaTabContentProps {
  lessonTitle: string
  backUrl: string
  lessonId: string
  validFiles: Media[]
  courseSlug: string
  headerSlot?: React.ReactNode
  showChat?: boolean
  chatLessonId?: string
  formulaSheet?: FormulaSheet | null
}

export function MediaTabContent({
  lessonTitle,
  backUrl,
  lessonId,
  validFiles,
  courseSlug,
  headerSlot,
  showChat,
  chatLessonId,
  formulaSheet,
}: MediaTabContentProps) {
  return (
    <ExerciseWorkspace
      exerciseTitle={lessonTitle}
      backUrl={backUrl}
      primaryContent={
        <div className="flex h-full flex-col min-h-0">
          {headerSlot}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="w-full p-card-padding-sm md:p-card-padding flex flex-col gap-content-gap">
              {validFiles.map((file) => (
                <div key={file.id} className="w-full h-[calc(100vh-120px)]">
                  <div className="border rounded-lg overflow-hidden bg-card shadow-card h-full">
                    <MediaComponent
                      resource={file}
                      className="w-full h-full"
                      htmlElement={null}
                      lessonId={lessonId}
                      courseId={courseSlug}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
      chatContent={
        showChat ? (
          <ChatInterface
            lessonId={chatLessonId ?? lessonId}
            translationNamespace="courses"
            showMathTools={true}
            formulaSheet={formulaSheet}
          />
        ) : null
      }
    />
  )
}
