/**
 * Selector constants for QA action handlers
 * Provides centralized, reusable selectors that can be updated in one place
 *
 * Selector priority:
 * 1. data-testid attributes (most stable)
 * 2. ARIA attributes (semantic, stable)
 * 3. Role-based selectors (semantic)
 * 4. Text-based selectors (fragile, use as fallback)
 *
 * @fileType constants
 * @domain qa
 * @pattern selector-constants
 */
export const SELECTORS = {
  // ============================================================
  // AUTH
  // ============================================================
  auth: {
    loginButton: '[data-testid="login-button"], button:has-text("התחבר"), button:has-text("Login")',
    logoutButton:
      '[data-testid="logout-button"], button:has-text("התנתק"), button:has-text("Logout")',
    emailInput: 'input[name="email"], input[type="email"]',
    passwordInput: 'input[name="password"], input[type="password"]',
    submitButton: 'button[type="submit"], button:has-text("Submit"), button:has-text("שלח")',
  },

  // ============================================================
  // NAVIGATION
  // ============================================================
  nav: {
    homeLink: 'a[href="/"], a[href="/he"], a:has-text("Home"), a:has-text("בית")',
    coursesLink: 'a[href*="/courses"], a:has-text("Courses"), a:has-text("קורסים")',
    backButton: 'button:has-text("חזרה"), button:has-text("Back"), [aria-label="Back"]',
    tabButton: (tab: string) => `button:has-text("${tab}"), [data-tab="${tab}"]`,
  },

  // ============================================================
  // LESSON
  // ============================================================
  lesson: {
    startButton:
      'button:has-text("התחל"), button:has-text("Start Lesson"), [data-testid="start-lesson"]',
    completeButton:
      'button:has-text("סיום"), button:has-text("Complete"), [data-testid="complete-lesson"]',
    nextButton: 'button:has-text("הבא"), button:has-text("Next"), [data-testid="next-exercise"]',
    previousButton:
      'button:has-text("הקודם"), button:has-text("Previous"), [data-testid="prev-exercise"]',
    progressIndicator: '[class*="progress"], [data-testid="lesson-progress"]',
  },

  // ============================================================
  // EXERCISES
  // ============================================================
  exercise: {
    // Question containers
    questionContainer:
      '[data-testid="question-container"], [class*="question"], [class*="exercise"]',

    // MCQ specific
    mcqOption: (id: string) =>
      `[data-option-id="${id}"], label:has-text("${id}"), [class*="option"][data-id="${id}"]`,
    mcqSelected: '[class*="selected"], [class*="border-primary"]',

    // True/False
    trueButton: 'button:has-text("True"), button:has-text("נכון"), [data-testid="tf-true"]',
    falseButton: 'button:has-text("False"), button:has-text("שגוי"), [data-testid="tf-false"]',

    // Free response
    textInput: 'textarea, input[type="text"]',

    // Matching
    matchItem: (id: string) => `[data-match-id="${id}"], [class*="match-item"][data-id="${id}"]`,
    matchConnected: '[class*="connected"], [class*="matched"]',

    // Table
    tableCell: (row: number, col: number) => `table input[data-row="${row}"][data-col="${col}"]`,

    // Actions
    checkAnswerButton:
      'button:has-text("בדוק"), button:has-text("Check Answer"), [data-testid="check-answer"]',
    hintButton: 'button:has-text("רמז"), button:has-text("Hint"), [data-testid="hint-button"]',
    solutionButton:
      'button:has-text("פתרון"), button:has-text("Solution"), [data-testid="solution-button"]',

    // Feedback
    feedbackCorrect: '[class*="correct"], [class*="success"], [class*="text-success"]',
    feedbackIncorrect: '[class*="incorrect"], [class*="error"], [class*="text-error"]',
    feedbackContainer: '[class*="feedback"], [class*="result"], [data-testid="feedback"]',
  },

  // ============================================================
  // CHAT
  // ============================================================
  chat: {
    messageInput:
      '[data-testid="chat-input"], input[placeholder*="שאל"], input[placeholder*="Ask"]',
    sendButton: 'button:has-text("שלח"), button:has-text("Send"), [data-testid="send-message"]',
    messageBubble: '[class*="message"], [class*="chat-bubble"], [data-testid="chat-message"]',
    aiTypingIndicator: '[class*="typing"], [class*="loading"], [data-testid="ai-typing"]',
  },

  // ============================================================
  // ACCESS GATES
  // ============================================================
  accessGate: {
    signInPrompt: 'text=/התחבר.*כדי|Sign in to continue/i',
    signInButton:
      'button:has-text("התחבר"), button:has-text("Sign In"), [data-testid="gate-sign-in"]',
    closeButton: 'button:has-text("סגור"), button:has-text("Close"), [aria-label="Close"]',
  },

  // ============================================================
  // PDF
  // ============================================================
  pdf: {
    iframe: 'iframe[src*=".pdf"], [data-testid="pdf-viewer"]',
    downloadButton: 'a:has-text("Download"), [data-testid="pdf-download"]',
  },

  // ============================================================
  // GENERAL
  // ============================================================
  general: {
    // Loading states
    loadingSpinner: '[class*="spinner"], [class*="loading"]',
    skeleton: '[class*="skeleton"]',

    // Error states
    errorMessage: '[class*="error"], [class*="alert"]',
    notFoundPage: 'text=/404|Not Found/i',

    // Cookie consent
    acceptCookiesButton: 'button:has-text("Accept"), button:has-text("אישור")',
  },
}

// Helper function to get a selector with fallback
export function getSelector(selector: string, _fallback: string): string {
  // In production, could check for data-testid availability
  // For now, returns the selector as-is
  return selector
}

// Helper to build nth-element selector
export function nth(selector: string, index: number): string {
  return `${selector}:nth-of-type(${index + 1})`
}

// ============================================================
// VIEWPORT PRESETS
// ============================================================

export const VIEWPORT_PRESETS = {
  mobile: { width: 375, height: 667 }, // iPhone SE
  tablet: { width: 768, height: 1024 }, // iPad
  desktop: { width: 1920, height: 1080 },
  large: { width: 2560, height: 1440 },
} as const

export type ViewportPreset = keyof typeof VIEWPORT_PRESETS
