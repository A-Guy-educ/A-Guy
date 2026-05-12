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
