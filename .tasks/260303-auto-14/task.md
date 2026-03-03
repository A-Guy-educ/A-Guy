# Task

## Issue Title

Sluggish Typing Animation in GreetingFlow
# 🐞 Bug Report

## 1. Title
Sluggish Typing Animation in GreetingFlow

## 2. Environment
- Environment: dev
- User Role / Tenant: Sudent or admin it is a new user facing the system for the first time 

## 3. Preconditions
User is navigating to the greeting/onboarding flow (first-time entry or guest session).

The GreetingFlow component is triggered and active.

## 4. Steps to Reproduce


Open the application in a clean environment (incognito).

Enter the landing page/onboarding section.

Observe the "EduGuide AI" bot as it begins typing the welcome message.

Attempt to read along with the animation.

## 5. Expected Result
The typing animation should be twice as fast as the current implementation.

Base character delay should be approximately $20\text{ms}$ to $25\text{ms}$.

The interaction should feel "snappy" and nearly instant while maintaining a subtle "human" dialogue feel.

Users should not feel the urge to "skip" the text because it is taking too long to appear

## 6. Actual Result


The animation is significantly slower than natural reading speed (estimated at $60\text{ms}$–$100\text{ms}$ per character). This results in a "crawl" effect where a single sentence takes several seconds to complete, making the application feel unresponsive or "buggy" to new users.

## 7. Reproducibility
always
