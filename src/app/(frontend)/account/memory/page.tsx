/** Memory Page — /account/memory */

import { redirect } from 'next/navigation'
import { getMeUser } from '@/infra/utils/getMeUser'
import { MemoryPageContent } from './MemoryPageContent'

export const metadata = { title: 'Memory' }

export default async function MemoryPage() {
  // Auth gate - redirect to login if not authenticated
  const { user } = await getMeUser({
    nullUserRedirect: '/login',
  })

  if (!user) {
    redirect('/login')
  }

  return <MemoryPageContent user={user} />
}
