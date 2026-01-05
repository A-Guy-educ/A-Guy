import { mongooseAdapter } from '@payloadcms/db-mongodb'
import sharp from 'sharp'
import path from 'path'
import { addDataAndFileToRequest, buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'
import { generateExerciseFromImage } from '@/lib/ai/services/exercise-generator'

import { Categories } from './collections/Categories'
import { Chapters } from './collections/Chapters'
import { Courses } from './collections/Courses'
import { Exercises } from './collections/Exercises'
import { ExerciseAssets } from './collections/ExerciseAssets'
import { Lessons } from './collections/Lessons'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { PricingPlans } from './collections/PricingPlans'
import { Users } from './collections/Users'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// AI Image Upload Validation
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']

type UploadedFileLike = {
  mimetype?: string
  size?: number
  data?: Buffer
  buffer?: Buffer
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
    url: process.env.DATABASE_URL || '',
  }),
  collections: [
    Pages,
    Categories,
    Courses,
    Chapters,
    Lessons,
    Exercises,
    ExerciseAssets,
    Users,
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
      path: '/ai/image-to-exercise',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        // 1) Auth - endpoints not authenticated by default
        if (!req.user) {
          return Response.json(
            { success: false, error: 'Authentication required' },
            { status: 401 },
          )
        }

        // 2) Parse multipart (Payload doesn't auto-attach data/file)
        await addDataAndFileToRequest(req)

        const file = (req as any).file as UploadedFileLike | undefined
        const data = (req as any).data as Record<string, unknown> | undefined

        if (!file) {
          return Response.json({ success: false, error: 'Image file is required' }, { status: 400 })
        }

        const mimeType = file.mimetype
        const fileSize = file.size ?? 0
        const imageBuffer = file.data ?? file.buffer

        if (!imageBuffer || !mimeType) {
          return Response.json({ success: false, error: 'Invalid uploaded file' }, { status: 400 })
        }

        // 3) Validate
        if (fileSize > MAX_FILE_SIZE) {
          return Response.json(
            { success: false, error: 'File size must be under 10MB' },
            { status: 400 },
          )
        }

        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
          return Response.json(
            { success: false, error: 'Invalid file type. Allowed: PNG, JPG, WEBP' },
            { status: 400 },
          )
        }

        const accompanyingTextRaw = data?.accompanyingText
        const accompanyingText =
          typeof accompanyingTextRaw === 'string' ? accompanyingTextRaw.trim() : undefined

        if (accompanyingText && accompanyingText.length > 1000) {
          return Response.json(
            { success: false, error: 'Accompanying text must be under 1000 characters' },
            { status: 400 },
          )
        }

        // 4) Call AI service
        const result = await generateExerciseFromImage({
          imageBuffer,
          mimeType,
          accompanyingText,
        })

        if (!result.success) {
          return Response.json(
            { success: false, error: result.error || 'Failed to process image' },
            { status: 500 },
          )
        }

        return Response.json({
          success: true,
          data: result.data,
          metadata: result.metadata,
        })
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
