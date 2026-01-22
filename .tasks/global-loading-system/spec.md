Task: Global Loading System (User UI Only)
Goal

Ensure every user-facing time-consuming action provides accurate, consistent loading feedback and prevents duplicate submissions — without touching the Admin panel.

Hard Boundary

IN SCOPE: /app/(frontend)/\*\*, user-facing API routes, user query utilities, user UI components.

OUT OF SCOPE: Payload Admin UI, admin hooks, seeds, internal ops tooling, migrations unrelated to user UI.

Key Principle

Loading indicators must reflect real async state (Promise lifecycle, route transitions, content loading) — no fake timers.

What “Generic” Means Here

We will implement a system-level loading infrastructure that covers the majority of cases automatically:

Route transitions → global minimal indicator

Server Actions (login/signup) → shared action wrapper

Content/data loading inside user pages (PDF/chat/data sections) → shared boundary component

Client fetch calls → routed through a single client wrapper (small scope)

You will NOT add “loading state” inside every screen manually.

System Building Blocks

1. Global Loading Manager (Source of Truth)

A single store that tracks active operations by key and type:

type: "route" | "screen" | "inline" | "action"

supports parallel operations safely

exposes selectors:

isBusy() (any)

isScreenBusy() (screen-level only)

isActionBusy(key) (per-action)

Rules

No component manages its own loading flags for long operations.

Everything long is registered here.

2. RouteLoadingIndicator (Minimal, Non-Blocking)

A global indicator that:

is not a full-screen lock

uses a visibility threshold (no flash for fast nav; show only if navigation exceeds X ms)

recommended UI: top progress bar or tiny header indicator

Rule

Route indicator is “life sign”, not a modal.

3. AsyncAction Wrapper (For Server Actions + Mutations)

A shared primitive used by any user-triggered async:

login action

signup action

chat send

save progress

contact submit

Features:

starts loading on invocation, ends on resolve/reject

blocks duplicate runs for same key

returns normalized result contract (success/error)

4. LoadingBoundary (For Content Areas)

A shared component to wrap heavy content regions:

PDF viewer container

chat panel container

lesson content that streams/loads

search results

It displays skeleton/placeholder until the underlying load is complete.

Implementation Strategy (User UI Only)
Step A — Introduce System Infrastructure

Add LoadingManager store + minimal API

Add RouteLoadingIndicator at the user root layout

Add AsyncAction primitive + result contract

Step B — Wire the Known User-Facing Actions (Small Set)

You currently have only 2 user Server Actions:

login_authenticate-action.ts

signup_createUser-action.ts

These should use AsyncAction wrapper (or be wrapped by the calling UI) to:

show accurate button-level loading

prevent duplicate submit

Step C — Standardize Fetch (Small Scope, Not a Big Refactor)

You have ~4 user-facing fetch calls and 1 API route.
Create a tiny userApiClient wrapper used only in user UI to:

register loading keys for long requests (where needed)

normalize errors consistently

keep callsites simple

Important: Only migrate the existing 4 calls + anything new going forward. Don’t “collect everything”.

Step D — Apply LoadingBoundary to 2–3 Heavy Regions

Pick the heaviest user-facing regions (likely PDF + chat + course/lesson page) and wrap them once.

Acceptance Criteria (Testable)

Any user-facing async operation expected >300ms shows an indicator that:

appears quickly (no delayed “I clicked and nothing happened”)

disappears immediately on completion

Double submissions are prevented for:

login

signup

chat send (if present)

contact submit (if present)

Route transitions show minimal indicator only when navigation exceeds threshold

No admin panel behavior changes

Should You Add a “Service Layer” for Server Calls?
My answer: Yes, but as a small Stage 2

Because your inventory is manageable:

Server Actions: 2

User fetch calls: 4

User API routes: 1

Payload query utilities: already somewhat centralized under src/lib/queries/** + utilities/**

Stage 1 (Now): Loading infrastructure + wire the few actions/fetches

Minimal risk, fast payoff.

Stage 2 (Next): “User Data Access Layer” (DAL) for consistency

Do NOT attempt “collect all calls” broadly.
Do:

wrap only the user fetch calls + the 2 actions

for Payload queries, enforce conventions going forward (optional refactor later)

This gives you:

one error contract

one place to add logging / tracing

predictable loading keys

What documents you should prepare (based on size/risk)

High-Level Spec (HLS): YES (this is cross-cutting UX + system infra)

Low-Level Plan (LLP): YES (because wiring points + thresholds + keys can get messy)

PRD: NO (you already have clear goal/UX; it’s not a product discovery task)
