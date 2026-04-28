'use client'

import { useExamCountdown } from '@/client/hooks/useExamCountdown'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import type { Chapter, Course, Lesson } from '@/payload-types'
import type { LessonProgress } from '../types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { BarChart3, GraduationCap } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AskTab } from '../AskTab'
import { CourseAnalytics } from '../CourseAnalytics'
import { CourseTabs, TAB_COLORS, type CourseTab } from '../CourseTabs'
import { ExamReminderBubble } from '../ExamReminderBubble'
import { ExamsTab } from '../ExamsTab'
import { LessonListTab } from '../LessonListTab'

interface CoursePageContentProps {
  course: Course
  chapters: Chapter[]
  lessons: Lesson[]
  courseSlug: string
  lessonProgressMap?: Record<string, LessonProgress>
}

const tabContentVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export function CoursePageContent({
  course,
  chapters,
  lessons,
  courseSlug,
  lessonProgressMap = {},
}: CoursePageContentProps) {
  const t = useTranslations('coursePage')
  const [activeTab, setActiveTab] = useState<CourseTab>('learn')
  const { hasUpcomingExam, daysUntil } = useExamCountdown(course.id)

  const activeColor = TAB_COLORS[activeTab].stroke

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <CourseAnalytics courseId={course.id} courseTitle={course.title} />
      <CourseTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Course title area with gradient accent */}
      <div className="w-full py-section-sm px-6 relative overflow-hidden">
        {/* Subtle gradient accent behind the title */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center top, ${activeColor}, transparent 70%)`,
          }}
        />
        <div className="max-w-5xl mx-auto text-center relative">
          {hasUpcomingExam && daysUntil !== null && <ExamReminderBubble daysUntil={daysUntil} />}
          <h1 className="text-display-sm md:text-display-md font-black text-foreground mt-4 text-center">
            {course.title}
          </h1>
        </div>
      </div>

      {/* Main content with AnimatePresence for smooth tab transitions */}
      <main className="container mx-auto px-6 py-section-sm max-w-5xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {(activeTab === 'learn' || activeTab === 'practice') && (
              <LessonListTab
                lessons={lessons}
                chapters={chapters}
                courseSlug={courseSlug}
                gradeLevel={course.courseLabel}
                tabColor={TAB_COLORS[activeTab]}
                lessonProgressMap={lessonProgressMap}
                lessonType={activeTab === 'learn' ? 'learning' : activeTab}
              />
            )}
            {activeTab === 'ask' && (
              <AskTab courseId={course.id} accentColor={TAB_COLORS[activeTab].stroke} />
            )}
            {activeTab === 'exams' && (
              <ExamsTab courseId={course.id} accentColor={TAB_COLORS[activeTab].stroke} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer actions with divider */}
        <div className="mt-16 pt-8 border-t border-border">
          <div className="flex flex-wrap justify-center items-center gap-content-gap">
            <SystemLink
              href={`/stats?courseId=${course.id}`}
              className="flex items-center justify-center gap-content-gap-xs text-body-sm font-bold text-foreground bg-card border border-border px-6 py-3 rounded-full hover:bg-muted/50 transition-all duration-normal"
            >
              <BarChart3 className="w-4 h-4" />
              {t('statsAndPerformance')}
            </SystemLink>
            <SystemLink
              href="/study-plan"
              className="flex items-center justify-center gap-content-gap-xs text-body-sm font-bold text-primary-foreground bg-primary px-6 py-3 rounded-full shadow-elevation-3 hover:opacity-90 transition-all duration-normal"
            >
              <GraduationCap className="w-4 h-4" />
              {t('upcomingExam')}
            </SystemLink>
          </div>
        </div>
      </main>
    </div>
  )
}
