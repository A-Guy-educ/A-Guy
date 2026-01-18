# High-Level Analytics Data Collection Spec

Based on the documentation and code analysis, here's a comprehensive overview of all data being collected through **Mixpanel** and **Google Analytics 4 (GA4)**:

---

## 📊 Platform Overview

**Dual Analytics Setup:**
- **Mixpanel** - Product analytics, user funnels, session recording
- **Google Analytics 4** - Web analytics, Google ecosystem integration

**Key Features:**
- All events sent to **BOTH** platforms simultaneously
- Unified utility: `Frontend/aguy/src/api/analytics.js`
- Anonymous user tracking with identity merging at registration
- Session recordings (100% of sessions in Mixpanel)

---

## 👤 User Identity & Properties

### Identity Tracking
1. **Anonymous Users**
   - Auto-generated UUID: `anon_<uuid>`
   - Stored in localStorage
   - Tracked from first visit

2. **Registered Users**
   - User ID (MongoDB `_id` or email)
   - Anonymous identity **merged** with registered identity on signup

### User Properties Collected
```javascript
{
  $email: string,
  $name: string,
  $distinct_id: string,
  user_type: 'anonymous' | 'student' | 'teacher' | 'admin',
  signup_date: ISO timestamp,
  signup_method: 'email' | 'google',
  last_login: ISO timestamp,
  role: string,
  grade: number,
  subscription_type: string,
  language: 'Hebrew' | 'English',
  poc_fullname: string (from localStorage if available),
  created_at: ISO timestamp
}
```

---

## 🎯 Core Events Tracked

### 1. Authentication & Registration

| Event Name | When Triggered | Properties |
|------------|---------------|------------|
| `Anonymous Session Started` | First visit without login | `anonymous_id`, `timestamp` |
| `Registration Prompt Shown` | Registration modal opens | `trigger_type` (EXERCISE_LIMIT, COPILOT_LIMIT, SCREENSHOT_ATTEMPT) |
| `Registration Started` | User clicks Google/email signup | `method` (google/email), `timestamp` |
| `Registration Completed` | Signup success (before alias) | `user_id`, `email`, `method`, `timestamp` |
| `User Login` | User logs in | `user_id`, `email` |
| `User Signup` | **(DEPRECATED)** Old signup event | `method` |

---

### 2. Course & Unit Activity

| Event Name Pattern | Example | Properties |
|-------------------|---------|------------|
| `Course Viewed: [Name]` | "Course Viewed: Grade 7 Math" | `course_id`, `course_name` |
| `Grade X Unit Y Viewed` | "Grade 7 Unit 4 Viewed" | `unit_id`, `grade`, `unitNumber`, `unit_name`, `course_id` |
| `Grade X Unit Y Started` | "Grade 7 Unit 4 Started" | `unit_id`, `grade`, `unitNumber`, `start_timestamp`, `start_time_readable` |
| `Grade X Unit Y Completed` | "Grade 7 Unit 4 Completed" | `unit_id`, `grade`, `unitNumber`, `time_spent_seconds`, `time_spent_minutes` |

---

### 3. Exercise Activity

| Event Name Pattern | Example | Properties |
|-------------------|---------|------------|
| `Grade X Unit Y Exercise Z Started` | "Grade 7 Unit 4 Exercise 2 Started" | `exercise_id`, `exercise_name`, `course_id`, `grade`, `unitNumber`, `exerciseNumber`, `unit_name`, `start_timestamp`, `start_time_readable` |
| `Grade X Unit Y Exercise Z Completed` | "Grade 7 Unit 4 Exercise 2 Completed" | `exercise_id`, `exercise_name`, `grade`, `unitNumber`, `exerciseNumber`, `unit_name`, `course_id`, `time_spent_seconds`, `time_spent_minutes` |
| `Grade X Unit Y Exercise Z Navigation next` | "Grade 7 Unit 4 Exercise 2 Navigation next" | `direction` (next/previous), `exercise_id`, `grade`, `unitNumber`, `exerciseNumber` |
| `Grade X Unit Y Exercise Z Navigation previous` | "Grade 7 Unit 4 Exercise 2 Navigation previous" | Same as above |

---

### 4. Exercise Interaction Events

| Event Name Pattern | Example | Properties |
|-------------------|---------|------------|
| `Grade X Unit Y Exercise Z Hint Clicked` | "Grade 7 Unit 4 Exercise 2 Hint Clicked" | `exercise_id`, `section_index`, `grade`, `unitNumber`, `exerciseNumber`, `time_from_start_seconds` |
| `Grade X Unit Y Exercise Z Solution Clicked` | "Grade 7 Unit 4 Exercise 2 Solution Clicked" | Same as above |
| `Grade X Unit Y Exercise Z Full Solution Clicked` | "Grade 7 Unit 4 Exercise 2 Full Solution Clicked" | Same as above |
| `Grade X Unit Y Exercise Z MCQ Answer Submitted` | "Grade 7 Unit 4 Exercise 2 MCQ Answer Submitted" | `exercise_id`, `section_index`, `is_correct` (boolean), `grade`, `unitNumber`, `exerciseNumber`, `time_from_start_seconds` |
| `Grade X Unit Y Exercise Z Open Text Answer Submitted` | "Grade 7 Unit 4 Exercise 2 Open Text Answer Submitted" | Same as MCQ |
| `Grade X Unit Y Exercise Z Matching Answer Submitted` | "Grade 7 Unit 4 Exercise 2 Matching Answer Submitted" | Same as MCQ |

---

### 5. Copilot (AI Tutor) Events

| Event Name Pattern | Example | Properties |
|-------------------|---------|------------|
| `Grade X Unit Y Chat Used` | "Grade 7 Unit 4 Chat Used" | `action`, `exercise_id`, `grade`, `unitNumber` |
| `Grade X Unit Y Chat Opened` | "Grade 7 Unit 4 Chat Opened" | `exercise_id`, `grade`, `unitNumber` |
| `Grade X Unit Y Chat Closed` | "Grade 7 Unit 4 Chat Closed" | Same as above |
| `Chat Math Helper Used` | N/A | `exercise_id`, `helper_type` (fraction, sqrt, power, etc.) |
| `Chat Speech-to-Text Used` | N/A | `exercise_id`, `language` (en-US/he-IL) |
| `Copilot Prompt Updated` | N/A | `user_id`, `action` (save/reset), `timestamp`, `previous_introduction`, `previous_tutoring`, `previous_transition`, `new_introduction`, `new_tutoring`, `new_transition`, `introduction_changed`, `tutoring_changed`, `transition_changed` |

---

### 6. Chatbot Events

| Event Name | When Triggered | Properties |
|------------|---------------|------------|
| `Chatbot Interaction` | User sends message to chatbot | `room_id`, `message_type` |

---

### 7. UI Interaction Events

| Event Name Pattern | Example | Properties |
|-------------------|---------|------------|
| `Button Click: [Name]` | "Button Click: Enter Course Grade 7" | `button_name`, `location`, `course_id`, `grade`, `has_access` |
| `UI Action: [Name]` | "UI Action: Toggle Chat View" | `action`, `location`, custom metadata |

---

### 8. Wix Pilot Integration Events

| Event Name | When Triggered | Properties |
|------------|---------------|------------|
| `wix_lesson_redirect` | User redirects from Wix site | `source: 'wix'`, `timestamp`, `unit_id`, `grade`, `lesson_number` |
| `wix_pilot_popup_shown` | Welcome popup shown | `timestamp`, `unit_id` |
| `wix_pilot_popup_closed` | Welcome popup closed | `timestamp`, `unit_id` |
| `lesson_loaded_new_structure` | Lesson loads with new structure | `source: 'wix'`, `timestamp`, `unit_id`, `grade`, `lesson_number` |
| `lesson_completed` | Lesson finished | `source: 'wix'`, `timestamp`, `time_spent_seconds`, `time_spent_minutes`, metadata |

---

## 🔍 Additional Data Points Collected

### Timing Data
- **Exercise duration** - Time from start to completion (seconds & minutes)
- **Unit duration** - Time from first view to completion
- **Time from start** - Elapsed time when hints/solutions clicked
- **Session timestamps** - ISO formatted timestamps for all events

### Context Data
- **Page location** - Current URL path
- **Referrer** - Where user came from
- **Device/Browser** - Automatically collected by analytics platforms
- **Screen resolution** - Automatically collected

### Custom Properties
- **POC Full Name** - Automatically added from localStorage to all events
- **Course hierarchy** - grade → unit → exercise numbering
- **Content metadata** - exercise names, unit names, course names

---

## 📈 Analytics Configuration

### Mixpanel Settings
```javascript
{
  project_token: 'ba307e7fbdc0750381e0e601e0e6c9ab',
  autocapture: false,  // Disabled for cleaner data
  record_sessions_percent: 100,  // Record all sessions
  unmask_text: true  // All text visible in session replays
}
```

### Google Analytics 4 Settings
```javascript
{
  measurement_id: 'G-LT158994Q7',
  automatic_pageviews: true,
  enhanced_measurement: true  // Scroll, video, file downloads auto-tracked
}
```

---

## 🔒 Privacy & Data Handling

1. **Anonymous Tracking**
   - UUID-based anonymous IDs
   - No PII collected before registration
   - Identity merged on signup (continuous user journey)

2. **Sensitive Data**
   - Email addresses collected (with user consent during registration)
   - Full names collected (if provided)
   - User answers NOT tracked (only correct/incorrect status)

3. **Session Recording**
   - 100% of sessions recorded in Mixpanel
   - All text visible (unmask configuration)
   - Used for UX improvement and debugging

---

## 📊 Event Volume Summary

Based on code analysis, **152 total tracking calls** across **20+ component files**:

- **Authentication**: 6 event types
- **Course/Unit Activity**: 4 event types
- **Exercise Activity**: 12+ event types
- **Copilot/Chat**: 7 event types
- **UI Interactions**: 2 event types (unlimited variations)
- **Wix Integration**: 5 event types

---

## 🔗 Key Files Reference

- **Main Analytics Utility**: `Frontend/aguy/src/api/analytics.js`
- **Documentation**: `docs/ANALYTICS_INTEGRATION.md`
- **Legacy Mixpanel Docs**: `docs/MIXPANEL_INTEGRATION.md`

---

## 📅 Version History

- **November 4, 2025**: Initial Mixpanel integration
- **December 22, 2025**: Anonymous identity tracking added
- **January 1, 2026**: Google Analytics 4 integration (dual analytics)
- **January 15, 2026**: This comprehensive spec created

---

**Status:** ✅ Both Mixpanel and GA4 are live and collecting data in production

**Last Updated:** January 15, 2026
