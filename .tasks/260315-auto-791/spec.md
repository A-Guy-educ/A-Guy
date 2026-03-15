# Access Code Gate (Coupon Logic) - Specification

## Overview

Provide specific institutions (e.g., schools) with free access to paid or restricted courses/lessons via a "Coupon Code" mechanism. This allows the system to grant access without traditional payment while enabling the administration to track exactly which students (by name and email) are utilizing each school's allocation.

## Requirements

### 1. User Identity
- The user must be a registered and logged-in student before interacting with the gate.

### 2. Content Status
- By default, courses are open.
- The gate only appears if an admin has specifically flagged a course or lesson as "Restricted by Code."

### 3. User Experience (The Student Flow)

#### 3.1 Encountering the Gate
- Main content area is blurred or hidden.
- Small, clean popup appears in the center of the screen.
- Message: "Access restricted. Please insert your school access code to unlock this content."

#### 3.2 Unlocking Content
- Student enters provided code into a text field.
- Upon clicking "Unlock":
  - If valid: Popup disappears, content is revealed, student gains permanent access.
  - If invalid: Warning appears: "Incorrect code. Please check with your teacher."

#### 3.3 Persistence
- Once a code is successfully redeemed, the student is never asked for a code for that specific content again.
- Access is tied to their account profile.

### 4. Admin Requirements (Management & Tracking)

#### 4.1 Access Code Creation
Admins need a dedicated area to:
- Generate Codes: Create unique strings (e.g., MACCABI-2024-FREE).
- Define Scope: Set whether a code unlocks one specific lesson, an entire course, or all site content.
- Set Limits: (Optional) Define a maximum number of redemptions allowed for a code.

#### 4.2 Content Control
In the Course/Lesson management area:
- A toggle to enable/disable the "Access Code Gate."
- A selection list to choose which specific codes are valid for that item.

#### 4.3 Usage Tracking & Analytics
Admins must be able to view a report for every generated code showing:
- Usage Count: Total number of redemptions.
- Student Details: A list of every student who used the code, including:
  - Full Name
  - Email Address
  - Date of Redemption
- Export: Option to download this data as a CSV/Excel file for school reporting.

## Acceptance Criteria

1. A student from "School A" can log in, enter a code, and immediately see their lesson.
2. The Admin can go to the dashboard and see that "Student Name (Email)" redeemed the "School A" code at 10:00 AM.
3. Content that is not flagged remains open and accessible as usual.
4. Code validation checks against valid codes for the content.
5. Permanent access is granted after successful code redemption.
6. Usage tracking captures student details and timestamp.
7. CSV export functionality works for reporting.
