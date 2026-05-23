# Product

A-Guy is one platform with four tightly integrated capabilities:

**Learning (LMS).** Content follows a clear, queryable hierarchy:
**Course → Chapter → Lesson → Exercise**. The Exercise is the atomic unit of
the system — AI-aware, aware of its place in the lesson, with solutions that can
be checked against multiple valid approaches.

**AI tutor.** The tutor is the primary interface, embedded on the learning
pages — not a separate chat window. It knows the full context (course, chapter,
lesson, exercise), has access to learning history and progress, and remembers
preferences and knowledge gaps across sessions.

**Content & math pipeline.** PDFs are not just displayed — they're **extracted**
with Vision AI and converted into structured, AI-processable exercises, then
decomposed into context blocks and stored as embedded `MemoryItems` for vector
retrieval. Math is first-class: LaTeX/KaTeX, MathLive, JSXGraph diagrams.

**Platform.** Multi-tenant and multi-locale by design (one installation serves
many organizations), with a full Payload CMS admin, block-based editing, and a
draft / preview / scheduled-publish workflow.

Stack: Payload CMS 3, Next.js 15 (App Router), MongoDB Atlas with Vector Search,
Tailwind + shadcn/ui, Google Gemini + OpenAI, deployed on Vercel.
