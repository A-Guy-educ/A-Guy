// Safety guard: read-only script, but still refuse to run against prod
// without an explicit opt-in so accidental `pnpm tsx scripts/list-lessons.ts`
// against a prod-pointing .env file doesn't leak data into local terminal/log
// scrollback.
function assertSafeEnvironment(): void {
  if (process.env.ALLOW_LIVE === '1') return
  const uri = process.env.DATABASE_URI ?? process.env.MONGODB_URI ?? ''
  const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1') || uri.includes('mongo:')
  if (!isLocal) {
    console.error(
      '[list-lessons] Refusing to run against non-local Mongo. ' + 'Set ALLOW_LIVE=1 to override.',
    )
    process.exit(1)
  }
}
assertSafeEnvironment()

import { getPayload } from 'payload'
import config from '@payload-config'

async function main() {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'lessons',
    limit: 30,
    depth: 0,
    sort: '-updatedAt',
    overrideAccess: true,
  })
  console.log(`Found ${result.totalDocs} lessons. Recent 30:`)
  for (const l of result.docs) {
    const ex = await payload.find({
      collection: 'exercises',
      where: { lesson: { equals: l.id } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    console.log(`  ${l.id}  ex=${ex.docs.length}  "${l.title}"`)
  }
  await payload.db?.destroy?.()
  process.exit(0)
}
void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
