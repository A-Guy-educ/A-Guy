import { mongooseAdapter } from '@payloadcms/db-mongodb'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { getServerSideURL } from '@/infra/utils/getURL'
import { AccessCodes } from '@/server/payload/collections/AccessCodes'
import { Categories } from '@/server/payload/collections/Categories'
import { Chapters } from '@/server/payload/collections/Chapters'
import { ChatAssets } from '@/server/payload/collections/ChatAssets'
import { ConfigAuditLogs } from '@/server/payload/collections/ConfigAuditLogs'
import { ConfigSecrets } from '@/server/payload/collections/ConfigSecrets'
import { ConfigValues } from '@/server/payload/collections/ConfigValues'
import { Conversations } from '@/server/payload/collections/Conversations'
import { Courses } from '@/server/payload/collections/Courses'
import { ExerciseAssets } from '@/server/payload/collections/ExerciseAssets'
import { Exercises } from '@/server/payload/collections/Exercises'
import { ExtractionLogs } from '@/server/payload/collections/ExtractionLogs'
import { GuestSessions } from '@/server/payload/collections/GuestSessions'
import { Lessons } from '@/server/payload/collections/Lessons'
import { MCPAuditLogs } from '@/server/payload/collections/MCPAuditLogs'
import { Media } from '@/server/payload/collections/Media'
import { MemoryItems } from '@/server/payload/collections/MemoryItems'
import { Pages } from '@/server/payload/collections/Pages'
import { Posts } from '@/server/payload/collections/Posts'
import { PricingPlans } from '@/server/payload/collections/PricingPlans'
import { Prompts } from '@/server/payload/collections/Prompts'
import { TeacherProfiles } from '@/server/payload/collections/TeacherProfiles'
import { Tenants } from '@/server/payload/collections/Tenants'
import { UploadSessions } from '@/server/payload/collections/UploadSessions'
import { UserEntitlements } from '@/server/payload/collections/UserEntitlements'
import { UserProgress } from '@/server/payload/collections/UserProgress'
import { Users } from '@/server/payload/collections/Users'
import { UserSettings } from '@/server/payload/collections/UserSettings'
import { importExerciseFromImage } from '@/server/payload/endpoints/exercises/import-from-image'
import { importExerciseFromLesson } from '@/server/payload/endpoints/exercises/import-from-lesson'
import { defaultLexical } from '@/server/payload/fields/defaultLexical'
import { pdfToExercisesTask } from '@/server/payload/jobs/pdf-to-exercises-task'
import { pdfToExercisesV2Task } from '@/server/payload/jobs/pdf-to-exercises-v2-task'
import type { JobDocument } from '@/server/payload/jobs/types'
import { runBackfillOnInit } from '@/server/payload/migrations/backfillAdminTitle'
import { plugins } from '@/server/payload/plugins'
import { seedTeacherProfiles } from '@/server/payload/seed/teacher-profiles-seed'
import { Footer } from '@/ui/web/footer/config'
import { Header } from '@/ui/web/header/config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Helper to check if user is admin
 * Safely handles union type (User | PayloadMcpApiKey)
 */
function isAdminUser(req: PayloadRequest): boolean {
  const user = req.user
  if (!user) return false
  // PayloadMcpApiKey doesn't have 'role', check collection first
  if ('collection' in user && user.collection === 'users' && user.role === 'admin') {
    return true
  }
  return false
}

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
      beforeDashboard: [
        '@/ui/admin/BeforeDashboard',
        '@/ui/admin/AdminChat/DashboardWidget',
        '@/ui/admin/VersionInfo',
      ],
      beforeNavLinks: ['@/ui/admin/AdminChat/SidebarLink', '@/ui/admin/PdfConversion/SidebarLink'],
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
    connectOptions: {
      // Hardened connection pool configuration to prevent Atlas connection exhaustion
      // Tests: maxPoolSize=5 (default)
      // Production: maxPoolSize=2 (default, configurable via MONGODB_MAX_POOL_SIZE)
      // Rationale: With 500 connection limit, this allows 250 concurrent serverless instances
      // vs only 5 instances with the previous maxPoolSize=100 setting
      maxPoolSize: parseInt(
        process.env.MONGODB_MAX_POOL_SIZE ?? (process.env.VITEST ? '5' : '2'),
        10,
      ),
      // Allow pool to fully drain when idle
      minPoolSize: 0,
      // Close idle connections after 10 seconds
      maxIdleTimeMS: 10000,
    },
  }),
  collections: [
    Pages,
    Categories,
    ConfigSecrets,
    ConfigValues,
    ConfigAuditLogs,
    Conversations,
    GuestSessions,
    MemoryItems,
    Tenants,
    Courses,
    Chapters,
    Lessons,
    Exercises,
    ExtractionLogs,
    Prompts,
    TeacherProfiles,
    UserSettings,
    ExerciseAssets,
    Users,
    UserProgress,
    Media,
    ChatAssets,
    UploadSessions,
    Posts,
    PricingPlans,
    UserEntitlements,
    AccessCodes,
    MCPAuditLogs,
  ],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer],
  plugins,
  secret:
    process.env.PAYLOAD_SECRET ||
    (() => {
      throw new Error('PAYLOAD_SECRET env var is required')
    })(),
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
    tasks: [pdfToExercisesTask, pdfToExercisesV2Task],
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
        read: ({ req }) => isAdminUser(req),
        update: ({ req }) => isAdminUser(req),
        delete: ({ req }) => isAdminUser(req),
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
  onInit: async (payload) => {
    // Ensure default tenant exists BEFORE seedTeacherProfiles runs
    // This is required because TeacherProfilesSeed needs a tenant to link prompts to
    const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG || 'default'
    const existingTenant = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: defaultTenantSlug } },
      limit: 1,
      overrideAccess: true,
    })

    if (existingTenant.totalDocs === 0) {
      await payload.create({
        collection: 'tenants',
        data: {
          name: 'Default',
          slug: defaultTenantSlug,
          status: 'active',
        },
        overrideAccess: true,
      })
      payload.logger.info(`[onInit] Created default tenant "${defaultTenantSlug}"`)
    }

    await runBackfillOnInit(payload)
    await seedTeacherProfiles(payload)
  },
})
