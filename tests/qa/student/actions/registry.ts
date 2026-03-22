// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Action registry - maps action names to handlers
 * @fileType registry
 * @domain qa
 * @pattern action-registry
 * @normalized
 */
import type { ActionRegistry } from './types'

// Session actions (keep as-is)
import { login } from './login'
import { logout } from './logout'
import { startAsGuest } from './startAsGuest'

// Navigation actions - NEW unified navigate + existing back/tab
import { navigate } from './navigate'
import { navigateBack } from './navigateBack'
import { clickTab } from './clickTab'

// Navigation actions - DEPRECATED (aliases for migrate)
import { openHome } from './openHome'
import { openCourses } from './openCourses'
import { openCourse } from './openCourse'
import { openLesson } from './openLesson'
import { openTab } from './openTab'
import { goto } from './goto'
import { openAskPage } from './openAskPage'

// Lesson actions - NEW
import { startLesson } from './startLesson'
import { navigateExercise } from './navigateExercise'
import { completeLesson } from './completeLesson'

// Lesson actions - DEPRECATED
import { nextExercise } from './nextExercise'
import { previousExercise } from './previousExercise'

// Exercise actions - NEW
import { answer } from './answer'
import { checkAnswer } from './checkAnswer'
import { requestHelp } from './requestHelp'

// Exercise actions - DEPRECATED
import { submitAnswer } from './submitAnswer'
import { requestHint } from './requestHint'
import { requestSolution } from './requestSolution'

// Chat actions - NEW
import { sendMessage } from './sendMessage'
import { waitForMessage } from './waitForMessage'

// Chat actions - DEPRECATED
import { sendChatMessage } from './sendChatMessage'
import { expectChatResponse } from './expectChatResponse'

// Assertion actions - NEW
import { see } from './see'
import { dontSee } from './dontSee'
import { beAt } from './beAt'
import { seeFeedback } from './seeFeedback'

// Assertion actions - DEPRECATED
import { expectVisible } from './expectVisible'
import { expectNotVisible } from './expectNotVisible'
import { expectUrl } from './expectUrl'
import { expectFeedback } from './expectFeedback'

// PDF actions - NEW
import { seePdf } from './seePdf'

// PDF actions - DEPRECATED
import { expectPdfVisible, expectPdfDownloadButtonVisible, expectPdfNotVisible } from './expectPdf'

// Utility actions
import { resizeViewport } from './resizeViewport'

export const actionRegistry: ActionRegistry = {
  // ============================================================
  // NORMALIZED ACTIONS (preferred)
  // ============================================================

  // Session (3) - unchanged
  login,
  logout,
  startAsGuest,

  // Navigation (3) - normalized
  navigate,
  navigateBack,
  clickTab,

  // Lesson (3) - normalized
  startLesson,
  navigateExercise,
  completeLesson,

  // Exercise (3) - normalized
  answer,
  checkAnswer,
  requestHelp,

  // Chat (2) - normalized
  sendMessage,
  waitForMessage,

  // Assertions (4) - normalized
  see,
  dontSee,
  beAt,
  seeFeedback,

  // PDF (1) - normalized
  seePdf,

  // Utility (1) - responsive testing
  resizeViewport,

  // ============================================================
  // DEPRECATED ALIASES (for backward compatibility during migration)
  // Remove after all scenarios updated
  // ============================================================

  // Navigation aliases
  openHome,
  openCourses,
  openCourse,
  openLesson,
  openAskPage,
  openTab,
  goto,

  // Lesson aliases
  nextExercise,
  previousExercise,

  // Exercise aliases
  submitAnswer,
  requestHint,
  requestSolution,

  // Chat aliases
  sendChatMessage,
  expectChatResponse,

  // Assertion aliases
  expectVisible,
  expectNotVisible,
  expectUrl,
  expectFeedback,

  // PDF aliases
  expectPdfVisible,
  expectPdfDownloadButtonVisible,
  expectPdfNotVisible,
}
