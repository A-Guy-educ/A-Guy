/**
 * Diagnose null-tenant users
 *
 * Lists all non-super-admin users with tenant == null so the team can
 * review or backfill them before deploying the fail-closed checkout fix.
 *
 * Exits 0 if no affected users are found.
 * Exits 1 if one or more affected users are found (so the script can be
 * used in CI/gates if desired).
 *
 * Usage: pnpm tsx scripts/diagnose-null-tenant-users.ts
 */
import { getPayload } from 'payload'

import config from '@payload-config'

interface UserDoc {
  id: string
  email?: string
  roles?: string[]
  tenant?: string | { id: string } | null
}

async function main() {
  const payload = await getPayload({ config })

  let page = 1
  let totalAffected = 0
  const limit = 100

  process.stdout.write('Scanning users for null tenant (excluding super-admins)...\n')

  while (true) {
    const result = await payload.find({
      collection: 'users',
      where: {
        tenant: { exists: false },
      },
      page,
      limit,
      depth: 0,
      overrideAccess: true,
    })

    if (result.docs.length === 0) break

    for (const user of result.docs as UserDoc[]) {
      const isSuperAdmin = Array.isArray(user.roles) && user.roles.includes('super-admin')
      if (isSuperAdmin) continue

      totalAffected++
      process.stdout.write(
        `  - [${user.id}] ${user.email ?? '(no email)'} roles=${JSON.stringify(user.roles)}\n`,
      )
    }

    if (page >= result.totalPages) break
    page++
  }

  process.stdout.write('\n')
  if (totalAffected === 0) {
    process.stdout.write('No non-super-admin users with null tenant found.\n')
    process.exit(0)
  } else {
    process.stdout.write(
      `Found ${totalAffected} non-super-admin user(s) with null tenant. ` +
        'Review or backfill before deploying fail-closed checkout fix.\n',
    )
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(2)
})
