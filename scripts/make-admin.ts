import { getPayload } from 'payload'
import config from '../src/payload.config'

/**
 * Script to promote a user to admin role
 * Usage: tsx scripts/make-admin.ts <email>
 * Example: tsx scripts/make-admin.ts aguyshayb@example.com
 */
async function makeUserAdmin(email: string) {
  console.log('Initializing Payload...')
  const payload = await getPayload({ config })

  try {
    // Find the user by email
    const users = await payload.find({
      collection: 'users',
      where: {
        email: {
          equals: email,
        },
      },
      limit: 1,
    })

    if (users.docs.length === 0) {
      console.error(`❌ User with email "${email}" not found`)
      process.exit(1)
    }

    const user = users.docs[0]
    console.log(`Found user: ${user.name} (${user.email})`)
    console.log(`Current role: ${user.role}`)

    if (user.role === 'admin') {
      console.log('✅ User is already an admin')
      process.exit(0)
    }

    // Update the user to admin
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        role: 'admin',
      },
    })

    console.log(`✅ Successfully promoted ${user.name} to admin`)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    process.exit(0)
  }
}

// Get email from command line arguments
const email = process.argv[2]

if (!email) {
  console.error('Usage: tsx scripts/make-admin.ts <email>')
  console.error('Example: tsx scripts/make-admin.ts user@example.com')
  process.exit(1)
}

makeUserAdmin(email)
