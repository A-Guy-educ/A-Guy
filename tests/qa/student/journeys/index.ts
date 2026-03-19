/**
 * Student journey definitions
 * Behavioral domains for the student-facing application
 * @fileType definitions
 * @domain qa
 * @pattern journey-definitions
 */
export interface Journey {
  id: string
  name: string
  description: string
  entryPoints: string[]
  relatedScenarios: string[]
}

export const studentJourneys: Journey[] = [
  {
    id: 'student-onboarding',
    name: 'Student Onboarding',
    description:
      'First-time visitor goes through greeting flow, selects mood and grade, reaches study hub',
    entryPoints: ['/start', '/'],
    relatedScenarios: ['onboarding-greeting-flow', 'onboarding-course-selection'],
  },
  {
    id: 'student-auth',
    name: 'Student Authentication',
    description: 'Login via Google OAuth or email/password, logout, guest-to-authenticated upgrade',
    entryPoints: ['/login'],
    relatedScenarios: ['auth-student-login', 'auth-student-logout', 'auth-guest-upgrade'],
  },
  {
    id: 'student-navigates-content',
    name: 'Student Navigates Content',
    description: 'Browse courses, chapters, lessons through the content hierarchy',
    entryPoints: ['/courses'],
    relatedScenarios: [
      'navigate-course-catalog',
      'navigate-course-to-lesson',
      'course-tab-navigation',
    ],
  },
  {
    id: 'student-studies-lesson',
    name: 'Student Studies Lesson',
    description: 'Enter a lesson, page through exercises, use the help system, complete the lesson',
    entryPoints: ['/courses/*/chapters/*/lessons/*'],
    relatedScenarios: ['lesson-pager-start-to-complete', 'lesson-pager-flow'],
  },
  {
    id: 'student-solves-exercises',
    name: 'Student Solves Exercises',
    description: 'Answer MCQ, T/F, free response, matching questions; check answers; get feedback',
    entryPoints: [],
    relatedScenarios: [
      'solve-mcq-correct',
      'solve-mcq-incorrect',
      'solve-true-false-correct',
      'solve-free-response',
      'help-system-hint',
      'help-system-solution-unlock',
    ],
  },
  {
    id: 'student-chats-with-ai',
    name: 'Student Chats with AI Tutor',
    description:
      'Open chat in lesson context or standalone /ask, send messages, receive streaming AI responses',
    entryPoints: ['/ask'],
    relatedScenarios: ['chat-send-message-in-lesson', 'chat-send-message-standalone'],
  },
  {
    id: 'student-manages-account',
    name: 'Student Manages Account',
    description: 'View/edit account, change teacher persona, view selected course',
    entryPoints: ['/account'],
    relatedScenarios: ['account-view-profile', 'account-change-teacher'],
  },
  {
    id: 'student-plans-study',
    name: 'Student Plans Study',
    description: 'Create a 7-day study plan with exam date and topics',
    entryPoints: ['/study-plan'],
    relatedScenarios: ['study-plan-create', 'study-plan-view'],
  },
  {
    id: 'student-accesses-gated-content',
    name: 'Student Accesses Gated Content',
    description:
      'Encounter access gates (free/gated/mandatory), see modals, authenticate to continue',
    entryPoints: [],
    relatedScenarios: ['access-gate-mandatory', 'access-gate-gated'],
  },
]
