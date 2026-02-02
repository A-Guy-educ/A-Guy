import { mongooseAdapter } from '@payloadcms/db-mongodb'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { getServerSideURL } from '@/infra/utils/getURL'
import { Categories } from '@/server/payload/collections/Categories'
import { Chapters } from '@/server/payload/collections/Chapters'
import { ConfigAuditLogs } from '@/server/payload/collections/ConfigAuditLogs'
import { ConfigEntries } from '@/server/payload/collections/ConfigEntries'
import { Conversations } from '@/server/payload/collections/Conversations'
import { Courses } from '@/server/payload/collections/Courses'
import { ExerciseAssets } from '@/server/payload/collections/ExerciseAssets'
import { Exercises } from '@/server/payload/collections/Exercises'
import { Lessons } from '@/server/payload/collections/Lessons'
import { MCPAuditLogs } from '@/server/payload/collections/MCPAuditLogs'
import { Media } from '@/server/payload/collections/Media'
import { MemoryItems } from '@/server/payload/collections/MemoryItems'
import { Pages } from '@/server/payload/collections/Pages'
import { Posts } from '@/server/payload/collections/Posts'
import { PricingPlans } from '@/server/payload/collections/PricingPlans'
import { Prompts } from '@/server/payload/collections/Prompts'
import { Tenants } from '@/server/payload/collections/Tenants'
import { UserProgress } from '@/server/payload/collections/UserProgress'
import { Users } from '@/server/payload/collections/Users'
import { importExerciseFromImage } from '@/server/payload/endpoints/exercises/import-from-image'
import { importExerciseFromLesson } from '@/server/payload/endpoints/exercises/import-from-lesson'
import { defaultLexical } from '@/server/payload/fields/defaultLexical'
import { pdfToExercisesTask } from '@/server/payload/jobs/pdf-to-exercises-task'
import type { JobDocument } from '@/server/payload/jobs/types'
import { plugins } from '@/server/payload/plugins'
import { Footer } from '@/ui/web/footer/config'
import { Header } from '@/ui/web/header/config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Validate DATABASE_URL is set and not empty
// This prevents accidental fallback to localhost when Atlas connection string is expected
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl || databaseUrl.trim() === '') {
  throw new Error(
    'DATABASE_URL environment variable is required but not set. ' +
      'Please set DATABASE_URL to your MongoDB connection string (e.g., mongodb+srv://... for Atlas).',
  )
}

const mcpEnabled = process.env.MCP_ENABLED === 'true'
if (
  mcpEnabled &&
  (!process.env.DEFAULT_TENANT_SLUG || process.env.DEFAULT_TENANT_SLUG.trim() === '')
) {
  throw new Error('DEFAULT_TENANT_SLUG environment variable is required when MCP_ENABLED=true.')
}

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/ui/admin/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/ui/admin/BeforeDashboard', '@/ui/admin/AdminChat/DashboardWidget'],
      beforeNavLinks: ['@/ui/admin/AdminChat/SidebarLink'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: mongooseAdapter({
    url: databaseUrl,
  }),
  collections: [
    Pages,
    Categories,
    ConfigEntries,
    ConfigAuditLogs,
    Conversations,
    MemoryItems,
    Tenants,
    Courses,
    Chapters,
    Lessons,
    Exercises,
    Prompts,
    ExerciseAssets,
    Users,
    UserProgress,
    Media,
    Posts,
    PricingPlans,
    MCPAuditLogs,
  ],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer],
  plugins,
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  endpoints: [
    {
      path: '/exercises/import',
      method: 'post',
      handler: (req: PayloadRequest) => {
        // Route based on whether lessonId query param exists
        const url = new URL(req.url || 'http://localhost')
        if (url.searchParams.has('lessonId')) {
          return importExerciseFromLesson(req)
        }
        return importExerciseFromImage(req)
      },
    },
  ],
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${process.env.CRON_SECRET}`
      },
    },
    tasks: [pdfToExercisesTask],
    // Expose jobs collection in admin panel for monitoring conversion jobs
    jobsCollectionOverrides: ({ defaultJobsCollection }) => ({
      ...defaultJobsCollection,
      admin: {
        ...defaultJobsCollection.admin,
        hidden: false, // Make visible in admin sidebar
        group: 'System', // Group with other system collections
        defaultColumns: [
          'taskSlug',
          'inputCtx',
          'status',
          'progress',
          'hasErrors',
          'createdAt',
          'completedAt',
        ],
      },
      access: {
        ...defaultJobsCollection.access,
        // Admin-only access
        read: ({ req }) => req.user?.role === 'admin',
        update: ({ req }) => req.user?.role === 'admin',
        delete: ({ req }) => req.user?.role === 'admin',
      },
      hooks: {
        afterRead: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args.doc type comes from Payload internal types
          (args: any) => {
            const job = args.doc as unknown as JobDocument
            // Compute display fields for admin UI

            // status: Compute from MongoDB fields
            let status = 'queued'
            if (job?.processing) {
              status = 'running'
            } else if (job?.hasError) {
              status = 'failed'
            } else if (job?.completedAt) {
              status = 'completed'
            }

            // inputCtx: Show lessonId prefix for quick identification
            const lessonId = job?.input?.ctx?.lessonId
            const inputCtx = lessonId ? `Lesson: ${lessonId.slice(0, 8)}...` : '—'

            // progress: Show segments progress if available
            let progress = '—'
            const output = job?.output as Record<string, unknown> | undefined
            if (output?.segmentsTotal && typeof output.segmentsTotal === 'number') {
              progress = `${(output.segmentsDone as number) || 0}/${output.segmentsTotal} segments`
            }

            // hasErrors: Show ✅ or ❌
            const errors = output?.errors as unknown[] | undefined
            const hasErrors = (errors?.length ?? 0) > 0 ? '❌' : '✅'

            return {
              ...job,
              status,
              inputCtx,
              progress,
              hasErrors,
            }
          },
        ],
      },
    }),
  },
})
