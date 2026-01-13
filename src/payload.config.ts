import { mongooseAdapter } from '@payloadcms/db-mongodb'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { defaultLexical } from '@/fields/defaultLexical'
import { Categories } from './collections/Categories'
import { Chapters } from './collections/Chapters'
import { Conversations } from './collections/Conversations'
import { Courses } from './collections/Courses'
import { ExerciseAssets } from './collections/ExerciseAssets'
import { Exercises } from './collections/Exercises'
import { Lessons } from './collections/Lessons'
import { Media } from './collections/Media'
import { MemoryItems } from './collections/MemoryItems'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { PricingPlans } from './collections/PricingPlans'
import { Users } from './collections/Users'
import { UserProgress } from './collections/UserProgress'
import { importExerciseFromImage } from './endpoints/exercises/import-from-image'
import { importExerciseFromLesson } from './endpoints/exercises/import-from-lesson'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Validate DATABASE_URL is set and not empty
// This prevents accidental fallback to localhost when Atlas connection string is expected
// During build time, we allow missing DATABASE_URL to avoid build failures
// The error will be thrown at runtime when the config is actually used
const databaseUrl = process.env.DATABASE_URL
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL

if (!isBuildTime && (!databaseUrl || databaseUrl.trim() === '')) {
  throw new Error(
    'DATABASE_URL environment variable is required but not set. ' +
      'Please set DATABASE_URL to your MongoDB connection string (e.g., mongodb+srv://... for Atlas).',
  )
}

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
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
    url: databaseUrl || 'mongodb://localhost:27017/payload',
  }),
  collections: [
    Pages,
    Categories,
    Conversations,
    MemoryItems,
    Courses,
    Chapters,
    Lessons,
    Exercises,
    ExerciseAssets,
    Users,
    UserProgress,
    Media,
    Posts,
    PricingPlans,
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
