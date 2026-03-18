// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Open tab navigation action handler
 * @fileType action-handler
 * @domain qa
 * @pattern navigation-actions
 */
import type { ActionContext, ActionHandler } from './types'
import { LABELS } from '../shared/locales'

type TabType = 'study' | 'practice' | 'ask' | 'test' | 'learn' | 'exams'

// Map tab names to locale label keys
const TAB_MAP: Record<TabType, string> = {
  study: 'study',
  practice: 'practiceTab', // לתרגל
  ask: 'askTab', // לשאול
  test: 'test',
  learn: 'learnTab', // ללמוד
  exams: 'examsTab', // בחינות
}

export const openTab: ActionHandler = async (ctx, input) => {
  const { page, locale } = ctx
  const tab = input?.tab as TabType | undefined

  if (!tab) {
    throw new Error('openTab action requires tab input')
  }

  const _labels = LABELS[locale]
  const labelKey = TAB_MAP[tab]
  const tabLabel = labels[labelKey as keyof typeof labels]

  if (!tabLabel) {
    throw new Error(`Unknown tab: ${tab}`)
  }

  const tabButton = page.getByRole('button', { name: tabLabel })
  await tabButton.click()
  await page.waitForLoadState('networkidle')
}
