/**
 * Localized strings for the ConversionTracking dashboard widgets.
 *
 * Admin panel supports English + Hebrew. Selection happens at runtime via
 * `useTranslation().i18n.language` from @payloadcms/ui (see `useStrings`).
 */

interface Strings {
  dashboard: string
  period: { week: string; month: string; year: string }

  userStatistics: string
  activeUsersToday: string
  activeUsersHint: string
  registered: string
  registrationYesterday: string
  registrationWeek: string
  registrationMonth: string
  registrationTotal: string
  vsPrior: string

  anonymousVisitors: string
  anonymousVisitorsHint: string
  guestToRegistered: string
  guestToRegisteredHint: string
  retentionRate: string
  retentionRateHint: (period: string) => string
  periodLabelWeek: string
  periodLabelMonth: string
  periodLabelYear: string

  contentOverview: string
  courses: string
  lessons: string
  exercises: string
  formulaSheets: string
  prompts: string

  engagementAndUsage: string
  courseEnrollments: string
  noEnrollments: string
  featureUsage: string
  avgTimeSpent: string
  minutes: string
  questionsAsked: string
  conversations: string
  lessonsCompleted: string
  exercisesCompleted: string
  contentByType: string
  typeLearning: string
  typePractice: string
  typeExam: string

  deletedCourse: string
  loading: (what: string) => string
  failedToLoad: (what: string) => string
}

const EN: Strings = {
  dashboard: 'Dashboard',
  period: { week: 'Week', month: 'Month', year: 'Year' },

  userStatistics: 'User Statistics',
  activeUsersToday: 'Active users today',
  activeUsersHint: 'Users whose last active date is today. Trend compares to yesterday.',
  registered: 'Registered',
  registrationYesterday: 'Yesterday',
  registrationWeek: 'This week',
  registrationMonth: 'This month',
  registrationTotal: 'Total',
  vsPrior: 'vs prior',

  anonymousVisitors: 'Anonymous visitors',
  anonymousVisitorsHint:
    'Total number of guest sessions ever created — visitors who used the site without registering.',
  guestToRegistered: 'Guest → Registered',
  guestToRegisteredHint:
    'Guest sessions that were claimed by a registered user. % shows conversion rate vs total anonymous visitors.',
  retentionRate: 'Retention rate',
  retentionRateHint: (period) =>
    `% of users active in the ${period} out of all users who existed before it started. Uses last active date from user-stats.`,
  periodLabelWeek: 'past week',
  periodLabelMonth: 'past month',
  periodLabelYear: 'past year',

  contentOverview: 'Content Overview',
  courses: 'Courses',
  lessons: 'Lessons',
  exercises: 'Exercises',
  formulaSheets: 'Formula Sheets',
  prompts: 'Prompts',

  engagementAndUsage: 'Engagement & Usage',
  courseEnrollments: 'Course Enrollments',
  noEnrollments: 'No enrollments yet',
  featureUsage: 'Feature Usage',
  avgTimeSpent: 'Avg time spent',
  minutes: 'min',
  questionsAsked: 'Questions asked',
  conversations: 'Conversations',
  lessonsCompleted: 'Lessons completed',
  exercisesCompleted: 'Exercises completed',
  contentByType: 'Content by Type',
  typeLearning: 'Learning',
  typePractice: 'Practice',
  typeExam: 'Exam',

  deletedCourse: 'Deleted course',
  loading: (what) => `Loading ${what}...`,
  failedToLoad: (what) => `Failed to load ${what}`,
}

const HE: Strings = {
  dashboard: 'לוח בקרה',
  period: { week: 'שבוע', month: 'חודש', year: 'שנה' },

  userStatistics: 'סטטיסטיקת משתמשים',
  activeUsersToday: 'משתמשים פעילים היום',
  activeUsersHint: 'משתמשים שתאריך הפעילות האחרון שלהם הוא היום. המגמה בהשוואה לאתמול.',
  registered: 'נרשמו',
  registrationYesterday: 'אתמול',
  registrationWeek: 'השבוע',
  registrationMonth: 'החודש',
  registrationTotal: 'סה״כ',
  vsPrior: 'לעומת התקופה הקודמת',

  anonymousVisitors: 'מבקרים אנונימיים',
  anonymousVisitorsHint: 'סך כל הסשנים של אורחים שנוצרו — מבקרים שהשתמשו באתר ללא הרשמה.',
  guestToRegistered: 'אורח → נרשם',
  guestToRegisteredHint:
    'סשנים של אורחים שהומרו למשתמש רשום. האחוז מראה שיעור המרה מתוך סך המבקרים האנונימיים.',
  retentionRate: 'שיעור שימור',
  retentionRateHint: (period) =>
    `אחוז המשתמשים שהיו פעילים ב${period} מתוך כלל המשתמשים שהיו קיימים לפני תחילתה. מבוסס על תאריך פעילות אחרון.`,
  periodLabelWeek: 'שבוע האחרון',
  periodLabelMonth: 'חודש האחרון',
  periodLabelYear: 'שנה האחרונה',

  contentOverview: 'סקירת תוכן',
  courses: 'קורסים',
  lessons: 'שיעורים',
  exercises: 'תרגילים',
  formulaSheets: 'דפי נוסחאות',
  prompts: 'פרומפטים',

  engagementAndUsage: 'מעורבות ושימוש',
  courseEnrollments: 'הרשמות לקורסים',
  noEnrollments: 'אין הרשמות עדיין',
  featureUsage: 'שימוש בפיצ׳רים',
  avgTimeSpent: 'זמן ממוצע במערכת',
  minutes: 'דק׳',
  questionsAsked: 'שאלות שנשאלו',
  conversations: 'שיחות',
  lessonsCompleted: 'שיעורים הושלמו',
  exercisesCompleted: 'תרגילים הושלמו',
  contentByType: 'תוכן לפי סוג',
  typeLearning: 'למידה',
  typePractice: 'תרגול',
  typeExam: 'מבחן',

  deletedCourse: 'קורס שנמחק',
  loading: (what) => `טוען ${what}...`,
  failedToLoad: (what) => `טעינת ${what} נכשלה`,
}

export function getStrings(lang: string): Strings {
  return lang.toLowerCase().startsWith('he') ? HE : EN
}
