import { RequiredDataFromCollectionSlug } from 'payload'

/**
 * @fileType seed-data
 * @domain pages
 * @pattern published-content
 * @ai-summary Seed data for the A-Guy platform introduction page, converted from docs/a-guy/intro.md
 */

const introHtml = `<article class="intro-page">

<style>
.intro-page table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
}
.intro-page th,
.intro-page td {
  border: 1px solid var(--theme-elevation-200, #e2e8f0);
  padding: 0.75rem 1rem;
  text-align: left;
}
.intro-page th {
  background-color: var(--theme-elevation-100, #f1f5f9);
  font-weight: 600;
}
.intro-page pre {
  background-color: var(--theme-elevation-100, #f1f5f9);
  padding: 1rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  margin: 1.5rem 0;
  font-size: 0.85rem;
  line-height: 1.6;
}
.intro-page code {
  font-family: ui-monospace, monospace;
}
.intro-page hr {
  margin: 2.5rem 0;
  border: none;
  border-top: 1px solid var(--theme-elevation-200, #e2e8f0);
}
.intro-page h2 {
  margin-top: 2rem;
}
.intro-page h3 {
  margin-top: 1.5rem;
}
.intro-page ul, .intro-page ol {
  padding-left: 1.5rem;
  margin: 1rem 0;
}
.intro-page li {
  margin: 0.5rem 0;
}
</style>

<h1>A-Guy: An AI-Native Educational Platform</h1>

<h2>Introduction</h2>

<p>A-Guy is not just another learning management system (LMS) or educational website. It represents a fundamental shift in how educational technology can be architected — built from the ground up as an <strong>AI-Native Operating System for Education</strong>.</p>

<p>Where traditional platforms treat AI as an add-on or chatbot wrapper, A-Guy integrates artificial intelligence into its core architecture, making AI an inseparable part of the learning experience.</p>

<hr>

<h2>The Unique Approach</h2>

<h3>1. AI as Infrastructure, Not a Feature</h3>

<p>Most educational platforms bolt on AI as a separate feature — a chatbot here, a recommendation engine there. A-Guy takes a different path:</p>

<ul>
<li><strong>Context-Aware AI</strong>: The AI understands the full learning context — the course, chapter, lesson, and exercise a student is working on</li>
<li><strong>Memory Across Sessions</strong>: Long-term memory persists between sessions, learning student preferences, strengths, and gaps</li>
<li><strong>Embedded Tutoring</strong>: The AI tutor lives inside the learning flow, not in a separate chat window</li>
<li><strong>Semantic Understanding</strong>: Vector embeddings enable truly understanding content meaning, not just keyword matching</li>
</ul>

<h3>2. Content as Data, Not Pages</h3>

<p>A-Guy treats educational content as structured data that can be transformed, queried, and AI-processed:</p>

<ul>
<li><strong>Hierarchical Structure</strong>: Courses → Chapters → Lessons → Exercises follow a clear, queryable hierarchy</li>
<li><strong>Block-Based Content</strong>: Rich content is decomposed into processable blocks (text, math, diagrams, code)</li>
<li><strong>Extraction Pipeline</strong>: PDF documents are not just displayed — they're <strong>extracted</strong> and converted into structured, AI-processable exercises</li>
<li><strong>Context Layering</strong>: Content is tagged with multiple context layers (lesson context, exercise context, diagram context) for precise AI retrieval</li>
</ul>

<h3>3. The Exercise Atom</h3>

<p>In traditional platforms, exercises are static questions. In A-Guy, exercises are <strong>AI-aware atoms</strong>:</p>

<ul>
<li>Exercises understand their context within lessons and chapters</li>
<li>Solutions can be verified against multiple valid approaches</li>
<li>Diagrams and math are first-class citizens (LaTeX, MathLive, JSXGraph)</li>
<li>Media attachments (images, PDFs) are embedded and searchable</li>
</ul>

<h3>4. Tutor is the Interface</h3>

<p>Rather than building a UI around content and adding a chat widget, A-Guy makes the <strong>tutor the primary interface</strong>:</p>

<ul>
<li>Every exercise page includes an embedded AI tutor</li>
<li>Students can ask questions in context of what they're learning</li>
<li>The tutor has access to the full learning history and progress</li>
<li>Conversational learning replaces linear navigation</li>
</ul>

<hr>

<h2>Advantages</h2>

<h3>For Students</h3>

<table>
<thead>
<tr>
<th>Advantage</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Personalized Learning</strong></td>
<td>AI adapts to individual pace, preferences, and knowledge gaps</td>
</tr>
<tr>
<td><strong>Immediate Feedback</strong></td>
<td>AI tutor provides instant explanations, not just correct/incorrect</td>
</tr>
<tr>
<td><strong>Contextual Help</strong></td>
<td>Assistance is relevant to exactly what the student is working on</td>
</tr>
<tr>
<td><strong>Persistent Memory</strong></td>
<td>Progress and preferences are remembered across sessions</td>
</tr>
<tr>
<td><strong>Rich Media Support</strong></td>
<td>Math (LaTeX/KaTeX), diagrams, and interactive content are first-class</td>
</tr>
</tbody>
</table>

<h3>For Educators and Content Creators</h3>

<table>
<thead>
<tr>
<th>Advantage</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>AI-Assisted Content Creation</strong></td>
<td>Import exercises from PDFs using Vision AI</td>
</tr>
<tr>
<td><strong>Block-Based Editor</strong></td>
<td>Flexible content blocks with lexical rich text</td>
</tr>
<tr>
<td><strong>Multi-Tenant Support</strong></td>
<td>Single installation serves multiple organizations</td>
</tr>
<tr>
<td><strong>Version Control</strong></td>
<td>Draft/preview workflow with scheduled publishing</td>
</tr>
<tr>
<td><strong>Admin UI</strong></td>
<td>Full-featured Payload CMS admin panel</td>
</tr>
</tbody>
</table>

<h3>For Developers and Platform Builders</h3>

<table>
<thead>
<tr>
<th>Advantage</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Modern Stack</strong></td>
<td>Next.js 15, Payload CMS 3, MongoDB Atlas</td>
</tr>
<tr>
<td><strong>Type Safety</strong></td>
<td>Full TypeScript with generated Payload types</td>
</tr>
<tr>
<td><strong>AI-Ready Architecture</strong></td>
<td>Vector search, embeddings, and memory built-in</td>
</tr>
<tr>
<td><strong>Extensible</strong></td>
<td>Modular collection structure, custom endpoints, job queues</td>
</tr>
<tr>
<td><strong>Deployable</strong></td>
<td>Vercel-compatible with blob storage and edge caching</td>
</tr>
</tbody>
</table>

<hr>

<h2>Technical Abilities</h2>

<h3>Core Architecture</h3>

<pre><code>┌─────────────────────────────────────────────────────────┐
│                    Next.js 15 App Router                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  Frontend   │  │   Admin UI  │  │  API Routes    │ │
│  │  (Pages)    │  │  (Payload)  │  │  (REST/GraphQL) │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   Payload CMS 3.73                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────┐  │
│  │Collections│ │  Globals  │ │ Endpoints │ │  Jobs   │  │
│  └───────────┘ └───────────┘ └───────────┘ └─────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│              MongoDB Atlas (with Vector Search)         │
│  ┌──────────────┐ ┌────────────┐ ┌─────────────────┐   │
│  │ Operational   │ │  Memories  │ │  Embeddings     │   │
│  │   Data        │ │  (Vectors) │ │  (Semantic)     │   │
│  └──────────────┘ └────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────┘</code></pre>

<h3>AI and Memory System</h3>

<p>The AI infrastructure is built on multiple layers:</p>

<ol>
<li><strong>Session Memory</strong>: Ephemeral context within a single conversation</li>
<li><strong>Interaction History</strong>: Persistent conversation logs with summaries</li>
<li><strong>MemoryItems</strong>: Long-term memories stored with vector embeddings</li>
<li><strong>Vector Search</strong>: MongoDB Atlas vector search for semantic retrieval</li>
</ol>

<pre><code>User Input → Context Builder → Memory Retrieval → LLM Processing → Response
                 │                  │
                 └──── Lesson Context ──┘
                 └──── Memory Context ──┘
                 └──── Exercise Context ──┘</code></pre>

<h3>PDF Processing Pipeline</h3>

<p>A-Guy can ingest PDF documents and convert them into structured exercises:</p>

<ol>
<li><strong>Upload</strong>: PDF is stored in Vercel Blob</li>
<li><strong>Rendering</strong>: PDF.js renders pages for display</li>
<li><strong>Extraction</strong>: Vision AI (Gemini) analyzes page content</li>
<li><strong>Chunking</strong>: Content is split into context-aware chunks</li>
<li><strong>Storage</strong>: Chunks stored as MemoryItems with embeddings</li>
<li><strong>Exercise Generation</strong>: AI generates structured exercises from extracted content</li>
</ol>

<h3>Content Rendering</h3>

<p>The platform supports rich educational content:</p>

<ul>
<li><strong>Lexical Editor</strong>: Structured rich text with custom blocks</li>
<li><strong>Math Support</strong>: LaTeX via KaTeX, interactive MathLive fields</li>
<li><strong>Diagrams</strong>: JSXGraph for interactive mathematical visualizations</li>
<li><strong>Code Blocks</strong>: Syntax-highlighted code with language support</li>
<li><strong>Media</strong>: Images, embedded videos (YouTube, Vimeo)</li>
</ul>

<h3>Access Control</h3>

<p>Enterprise-grade security with role-based access:</p>

<ul>
<li><strong>Collection-Level</strong>: Read/create/update/delete permissions per role</li>
<li><strong>Field-Level</strong>: Granular control over sensitive fields</li>
<li><strong>Multi-Tenant</strong>: Tenant-scoped data isolation</li>
<li><strong>API Security</strong>: JWT authentication, MCP key management</li>
</ul>

<h3>Background Jobs</h3>

<p>Asynchronous processing for heavy operations:</p>

<ul>
<li><strong>PDF to Exercise Conversion</strong>: Queue-based processing with progress tracking</li>
<li><strong>Scheduled Publishing</strong>: Time-based content release</li>
<li><strong>Memory Processing</strong>: Async embedding generation</li>
<li><strong>Custom Tasks</strong>: Extensible job queue system</li>
</ul>

<hr>

<h2>Comparison with Traditional Platforms</h2>

<table>
<thead>
<tr>
<th>Aspect</th>
<th>Traditional LMS</th>
<th>A-Guy</th>
</tr>
</thead>
<tbody>
<tr>
<td>AI Integration</td>
<td>Chat widget overlay</td>
<td>Core infrastructure</td>
</tr>
<tr>
<td>Content Format</td>
<td>Pages of text</td>
<td>Structured data blocks</td>
</tr>
<tr>
<td>Exercises</td>
<td>Static questions</td>
<td>AI-aware atoms</td>
</tr>
<tr>
<td>Tutoring</td>
<td>Optional add-on</td>
<td>Primary interface</td>
</tr>
<tr>
<td>Memory</td>
<td>None</td>
<td>Persistent, semantic</td>
</tr>
<tr>
<td>PDF Handling</td>
<td>Display only</td>
<td>Extract and process</td>
</tr>
<tr>
<td>Math Support</td>
<td>Images or basic LaTeX</td>
<td>Full LaTeX + interactive</td>
</tr>
<tr>
<td>Multi-tenant</td>
<td>Often separate instances</td>
<td>Built-in</td>
</tr>
<tr>
<td>Extensibility</td>
<td>Plugins</td>
<td>Full code access</td>
</tr>
</tbody>
</table>

<hr>

<h2>Summary</h2>

<p>A-Guy represents a new category of educational technology — not an LMS with AI added, but an <strong>AI platform with education as the primary use case</strong>. Its advantages emerge from architectural decisions made at every level:</p>

<ul>
<li>The <strong>content model</strong> treats learning material as processable data</li>
<li>The <strong>memory system</strong> gives AI genuine understanding of each learner</li>
<li>The <strong>tutor interface</strong> makes AI the primary learning companion</li>
<li>The <strong>extraction pipeline</strong> transforms static PDFs into dynamic learning material</li>
</ul>

<p>The result is a platform where artificial intelligence isn't a feature — it's the foundation.</p>

</article>`

export const introPage: () => RequiredDataFromCollectionSlug<'pages'> = () => {
  return {
    slug: 'about',
    locale: 'en',
    _status: 'published',
    title: 'About A-Guy',
    publishedAt: new Date().toISOString(),
    hero: {
      type: 'lowImpact',
      richText: {
        root: {
          type: 'root',
          children: [
            {
              type: 'heading',
              children: [
                {
                  type: 'text',
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                  text: 'About A-Guy',
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              tag: 'h1',
              version: 1,
            },
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                  text: 'An AI-Native Educational Platform',
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      },
    },
    layout: [
      {
        blockType: 'html',
        html: introHtml,
      },
    ],
  }
}
