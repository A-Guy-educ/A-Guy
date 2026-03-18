// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Action registry - maps action names to handlers
 * @fileType registry
 * @domain qa
 * @pattern action-registry
 */
import type { ActionHandler, ActionRegistry } from './types'

// Session actions
import { login } from './login'
import { logout } from './logout'
import { startAsGuest } from './startAsGuest'

// Navigation actions
import { openHome } from './openHome'
import { openCourses } from './openCourses'
import { openCourse } from './openCourse'
import { openLesson } from './openLesson'
import { openTab } from './openTab'
import { navigateBack } from './navigateBack'
import { goto } from './goto'

// Lesson actions
import { startLesson } from './startLesson'
import { nextExercise } from './nextExercise'
import { previousExercise } from './previousExercise'
import { completeLesson } from './completeLesson'

// Exercise actions
import { submitAnswer } from './submitAnswer'
import { checkAnswer } from './checkAnswer'
import { requestHint } from './requestHint'
import { requestSolution } from './requestSolution'

// Chat actions
import { sendChatMessage } from './sendChatMessage'
import { openAskPage } from './openAskPage'
import { expectChatResponse } from './expectChatResponse'

// Assertion actions
import { expectVisible } from './expectVisible'
import { expectNotVisible } from './expectNotVisible'
import { expectUrl } from './expectUrl'
import { expectFeedback } from './expectFeedback'

export const actionRegistry: ActionRegistry = {
  // Session
  login,
  logout,
  startAsGuest,

  // Navigation
  openHome,
  openCourses,
  openCourse,
  openLesson,
  openTab,
  navigateBack,
  goto,

  // Lesson
  startLesson,
  nextExercise,
  previousExercise,
  completeLesson,

  // Exercise
  submitAnswer,
  checkAnswer,
  requestHint,
  requestSolution,

  // Chat
  sendChatMessage,
  openAskPage,
  expectChatResponse,

  // Assertions
  expectVisible,
  expectNotVisible,
  expectUrl,
  expectFeedback,
}
