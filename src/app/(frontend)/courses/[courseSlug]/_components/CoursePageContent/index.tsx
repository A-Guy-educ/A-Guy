'use client'

import { useState } from 'react'
import type { Chapter, Course, Lesson } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { useExamCountdown } from '@/client/hooks/useExamCountdown'
import { CourseAnalytics } from '../CourseAnalytics'
import { CourseTabs, type CourseTab } from '../CourseTabs'
import { ExamReminderBubble } from '../ExamReminderBubble'
import { LearnTab } from '../LearnTab'
import { PracticeTab } from '../PracticeTab'
import { AskTab } from '../AskTab'
import { ExamsTab } from '../ExamsTab'

interface CoursePageContentProps {
  course: Course
  chapters: Chapter[]
  lessons: Lesson[]
  courseSlug: string
}

export function CoursePageContent({
  course,
  chapters,
  lessons,
  courseSlug,
}: CoursePageContentProps) {
  const t = useTranslations('coursePage')
  const [activeTab, setActiveTab] = useState<CourseTab>('learn')
  const { hasUpcomingExam, daysUntil } = useExamCountdown(course.id)

  const sectionTitle =
    activeTab === 'learn'
      ? course.title
      : activeTab === 'ask'
        ? t('sectionTitle.ask')
        : activeTab === 'practice'
          ? t('sectionTitle.practice')
          : t('sectionTitle.exams')

  return (
    <>
      <CourseAnalytics courseId={course.id} courseTitle={course.title} />
      <CourseTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Grade + Exam reminder */}
      <div className="w-full bg-card/50 py-4 border-b border-border">
        <div className="max-w-5xl mx-auto px-6 flex flex-col">
          <div className="text-center">
            <span className="text-sm md:text-base font-extrabold text-primary uppercase tracking-[0.3em]">
              {t('grade')} {course.courseLabel}
            </span>
          </div>
          {hasUpcomingExam && daysUntil !== null && <ExamReminderBubble daysUntil={daysUntil} />}
        </div>
      </div>

      {/* Main content */}
      <main className="container mx-auto px-6 py-10 max-w-5xl">
        <section className="mb-8 text-right px-2">
          <h2 className="text-2xl md:text-3xl font-black text-foreground leading-tight">
            {sectionTitle}
          </h2>
        </section>

        {activeTab === 'learn' && (
          <LearnTab lessons={lessons} chapters={chapters} courseSlug={courseSlug} />
        )}
        {activeTab === 'practice' && (
          <PracticeTab lessons={lessons} chapters={chapters} courseSlug={courseSlug} />
        )}
        {activeTab === 'ask' && <AskTab courseId={course.id} />}
        {activeTab === 'exams' && <ExamsTab courseId={course.id} />}

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
