import { mongooseAdapter } from '@payloadcms/db-mongodb'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { importExerciseFromImage } from '@/endpoints/exercises/import-from-image'
import { importExerciseFromLesson } from '@/endpoints/exercises/import-from-lesson'
import { Footer } from '@/ui/web/footer/config'
import { Header } from '@/ui/web/header/config'
import { Categories } from '@/server/payload/collections/Categories'
import { Chapters } from '@/server/payload/collections/Chapters'
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
import { defaultLexical } from '@/server/payload/fields/defaultLexical'
import { plugins } from '@/server/payload/plugins'
import { getServerSideURL } from '@/utilities/getURL'

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
      beforeDashboard: ['@/ui/admin/BeforeDashboard'],
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
    tasks: [],
  },
})
