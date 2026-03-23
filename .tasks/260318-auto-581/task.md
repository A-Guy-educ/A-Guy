# Task

## Issue Title

MIXPANEL ANALYTICS SPECIFICATION - COMPLETE WITH FILTERING & REPORTING
# New Feature: MIXPANEL ANALYTICS SPECIFICATION - COMPLETE WITH FILTERING & REPORTING

| | |
|---|---|
| **Category** | New Feature |
| **Scope** | Full-stack |
| **Priority** | 🟡 P2 — Medium |

## Summary
Total Currently Tracked: 20 events  
Critical to Add: 9 events (coupon tracking + exercise details + engagement)  
Recommended: 8 events (content + learning + registration)  
Optional: 7 events (monetization + discovery)  

Minimum Scope for This Ticket: Add the 9 CRITICAL events

## Requirements
CURRENTLY TRACKED (20 events)

Session & Navigation

page_view - User visits a page

session_started - User arrives on platform

session_ended - User leaves platform

tab_away - User switches away from browser tab

tab_back - User returns to browser tab

Authentication

user_identified - User logs in / user profile loaded

registration_completed - New user finishes signup

login_modal_shown - Login prompt appears to user

Courses & Lessons

course_entered - User clicks into a course

lesson_started - User opens a lesson

lesson_completed - User finishes a lesson

Exercises

exercise_viewed - User opens an exercise

student_answer_submitted - User submits first answer

answer_selected - User selects MCQ/True-False option

exercise_completed - Exercise marked as done

chat_auto_triggered - AI chat opens automatically

Help System

hint_clicked - User clicks "Show Hint" button

guiding_question_clicked - User clicks guided question

solution_unlocked - User clicks to unlock solution

solution_clicked - User views full solution

Content

pdf_viewed - User views PDF

chat_message_sent - User sends message to AI tutor

MISSING EVENTS TO ADD (Recommended)

⭐ CRITICAL - Coupon & Access

coupon_code_entered - User enters coupon code to access lesson

Data: email, name, coupon_code, lesson_id, course_id, timestamp

Filterable by: coupon_code, is_coupon_user, email, course_id

access_gate_shown - User encounters paywall/login gate

Data: gate_type (free/login/paid/coupon), lesson_id, course_id

Filterable by: gate_type, lesson_id, course_id

access_granted - User gains access

Data: access_type (free/coupon/paid), coupon_code, lesson_id, course_id

Filterable by: access_type, coupon_code, lesson_id

⭐ CRITICAL - Exercise Quality

answer_correct - User gets answer RIGHT on first attempt

Data: exercise_id, lesson_id, time_seconds, attempt_number, difficulty_level

Filterable by: exercise_id, lesson_id, attempt_number, difficulty_level

answer_incorrect - User gets answer WRONG

Data: exercise_id, lesson_id, attempt_number, max_attempts, time_seconds

Filterable by: exercise_id, lesson_id, attempt_number

exercise_skipped - User skips exercise without answering

Data: exercise_id, lesson_id, reason

Filterable by: exercise_id, lesson_id, reason

⭐ CRITICAL - Engagement Signals

lesson_abandoned - User leaves lesson incomplete

Data: lesson_id, course_id, time_spent_seconds, progress_percent, exercises_attempted, exercises_completed

Filterable by: lesson_id, course_id, progress_percent (ranges), time_spent_seconds (ranges)

chapter_completed - User finishes all lessons in chapter

Data: course_id, chapter_id, total_lessons, completion_time_seconds

Filterable by: course_id, chapter_id

time_on_page - Abandonment signal at time thresholds

Data: page_url, time_seconds (30/60/120/300/600), scroll_depth_percent, user_interacted

Filterable by: time_seconds, page_url, scroll_depth_percent (ranges)

📊 RECOMMENDED - Content

pdf_downloaded - User downloads PDF

Data: pdf_id, lesson_id, file_size

Filterable by: pdf_id, lesson_id

media_played - User plays video/media

Data: media_id, lesson_id, media_type (video/audio), duration_total_seconds

Filterable by: media_id, lesson_id, media_type

media_completed - User finishes watching video

Data: media_id, lesson_id, watched_percent, actual_seconds_watched

Filterable by: media_id, lesson_id, watched_percent (ranges)

📊 RECOMMENDED - Learning Behavior

multiple_attempts - User retries exercise

Data: exercise_id, lesson_id, attempt_number, previous_answer_correct

Filterable by: exercise_id, lesson_id, attempt_number (ranges)

help_effectiveness - User used hint but still got wrong

Data: exercise_id, lesson_id, hint_used, solution_needed, attempts_after_hint

Filterable by: exercise_id, lesson_id, solution_needed

📊 RECOMMENDED - Registration Flow

registration_started - User begins signup

Data: signup_method (google/email), referrer_page

Filterable by: signup_method, referrer_page

registration_failed - Signup fails

Data: signup_method, error_type, error_message (sanitized)

Filterable by: signup_method, error_type

💰 OPTIONAL - Monetization

course_purchase_started - User clicks "Buy Course"

Data: course_id, price, currency

Filterable by: course_id, price (ranges)

course_purchased - Purchase completes

Data: course_id, price, currency, payment_method, transaction_id

Filterable by: course_id, price (ranges), payment_method

subscription_upgraded - User upgrades plan

Data: old_plan, new_plan, price_difference

Filterable by: old_plan, new_plan

🔍 OPTIONAL - Discovery

search_performed - User searches courses

Data: search_query, results_count, category_filter

Filterable by: search_query, category_filter, results_count (ranges)

course_browsed - User views course list

Data: total_visible_courses, sorting_method, filter_applied

Filterable by: sorting_method, filter_applied

SUMMARY

Total Currently Tracked: 20 events  
Critical to Add: 9 events (coupon tracking + exercise details + engagement)  
Recommended: 8 events (content + learning + registration)  
Optional: 7 events (monetization + discovery)  

Minimum Scope for This Ticket: Add the 9 CRITICAL events

QUALITY ASSURANCE CHECKLIST ✅

For ALL 20 Current Events:

[ ] Event is actually firing in Mixpanel (test in dashboard)

[ ] Event includes user_id (MongoDB ID) for authenticated users

[ ] Event includes email (captured from user_identified) for authenticated users

[ ] Event includes name (captured from user_identified) for authenticated users

[ ] Anonymous users (before login) have session_id for tracking

[ ] Event includes timestamp (ISO 8601 format)

[ ] Event includes session_id (consistent across all events in a session)

[ ] Unauthenticated user events can be retroactively linked to user after login (via alias)

User Identification Properties:

[ ] user_identified event captures and sends email to Mixpanel

[ ] user_identified event captures and sends name to Mixpanel

[ ] Email & name are set in Mixpanel People profile (not just event properties)

[ ] is_coupon_user flag is set to true/false for each user

[ ] All subsequent events for that user include user_id, email, name

Event Data Quality:

[ ] All IDs (user_id, lesson_id, course_id, exercise_id) are consistent and traceable

[ ] No PII except email/name (no passwords, IP addresses, sensitive data)

[ ] All event property names are lowercase_with_underscores

[ ] Event names are lowercase_with_underscores

Verification in Mixpanel:

[ ] Run user profile search: Search by email → See all events for that user

[ ] Run funnel: page_view → course_entered → lesson_started → exercise_viewed

[ ] Create cohort "Users with email" → Should include all registered users

[ ] Create cohort "Coupon Users" → Filter by is_coupon_user == true

[ ] Export user list → Can see email addresses and names

FILTERING & REPORTING CAPABILITIES 🎯

Pre-Built Filters You Need:

By User:

[ ] Filter by email

[ ] Filter by user_id

[ ] Filter by name

[ ] Filter by is_coupon_user (true/false)

[ ] Filter by coupon_code

[ ] Filter by user_role (student/educator/admin)

By Content:

[ ] Filter by course_id

[ ] Filter by lesson_id

[ ] Filter by chapter_id

[ ] Filter by exercise_id

[ ] Filter by exercise_type (mcq/true_false/short_answer)

[ ] Filter by difficulty_level (easy/medium/hard)

By Behavior:

[ ] Filter by event_type (answer_correct, answer_incorrect, exercise_skipped)

[ ] Filter by access_type (free/coupon/paid)

[ ] Filter by gate_type (free/login/paid/coupon)

[ ] Filter by attempt_number (1st attempt vs retry)

[ ] Filter by time_spent (ranges: 0-30s, 30-60s, 60-300s, 300s+)

[ ] Filter by progress_percent (ranges: 0-25%, 25-50%, 50-75%, 75-100%)

By Time:

[ ] Filter by date range

[ ] Filter by day of week

[ ] Filter by time of day (morning/afternoon/evening)

MIXPANEL TABLES & REPORTS TO CREATE 📊

Table 1: Coupon Users Tracker

Columns: email | name | coupon_code | lesson_id | date_entered | access_granted | completion_status
Filters: is_coupon_user=true, coupon_code, date_range
Use Case: Track which coupon users accessed content and their progress

Table 2: Exercise Performance

Columns: exercise_id | lesson_id | total_attempts | correct_count | skipped_count | avg_time_seconds | difficulty_level
Filters: lesson_id, course_id, difficulty_level, date_range
Use Case: Identify which exercises are too hard or not engaging

Table 3: User Learning Journey

Columns: email | name | courses_entered | lessons_started | lessons_completed | exercises_completed | total_help_requests | avg_attempts
Filters: is_coupon_user, date_range, course_id
Use Case: See complete user journey in one table

Table 4: Engagement Signals

Columns: email | lesson_id | time_on_lesson | progress_percent | exercises_attempted | exercises_completed | hint_used | abandoned
Filters: abandoned=true, time_on_lesson (ranges), lesson_id
Use Case: Find struggling users who need intervention

Table 5: Registration Funnel

Columns: step | total_users | completion_rate | avg_time_seconds
Steps: registration_started → registration_completed
Filters: signup_method, date_range
Use Case: Identify signup bottlenecks

Funnel: Course Access Path

Steps: page_view → access_gate_shown → access_granted → course_entered
Filters: access_type, coupon_code, date_range
Use Case: Track where users drop off in access flow

Funnel: Exercise Completion

Steps: exercise_viewed → student_answer_submitted → (answer_correct OR answer_incorrect OR exercise_skipped)
Filters: exercise_type, difficulty_level, date_range
Use Case: See exercise completion rates

Cohort: Coupon Campaign Performance

Definition: is_coupon_user=true AND coupon_code="SUMMER2026"
Metrics: Retention, Completion Rate, Avg Attempts, Help Requests
Use Case: Measure coupon campaign effectiveness

## Acceptance Criteria
ACCEPTANCE CRITERIA

✅ All 20 current events are sending to Mixpanel  
✅ All events include user_id (when user is logged in)  
✅ All events include email (after user_identified fires)  
✅ All events include name (after user_identified fires)  
✅ Anonymous users can be tracked via session_id before login  
✅ Mixpanel can link anonymous session to user after login (alias working)  
✅ Can search user by email and see complete timeline  
✅ Can create "Coupon Users" cohort and filter by it  
✅ All events are verified in Mixpanel dashboard  

✅ NEW: All 9 critical events are added and firing to Mixpanel  
✅ NEW: All new events include proper filterable properties  
✅ NEW: Can create tables filtering by all event properties  
✅ NEW: Can export event data with filters applied  
✅ NEW: Can build funnels using new events  
✅ NEW: Can segment users by coupon_code, access_type, exercise performance  
✅ NEW: Pre-built tables for coupon tracking, exercise performance, user journey
