/**
 * Account Memory Page
 *
 * /account/memory — Display and search user's memory items
 */

import { redirect } from 'next/navigation'

import { getMeUser } from '@/infra/utils/getMeUser'
import { MemoryPageContent } from './MemoryPageContent'

export const metadata = { title: 'My Memories' }

export default async function MemoryPage() {
  const { user } = await getMeUser()

  if (!user) {
    redirect('/login')
  }

  return <MemoryPageContent userId={user.id} />
}
