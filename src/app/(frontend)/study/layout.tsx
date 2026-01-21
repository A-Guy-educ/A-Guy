import { requireRegistration } from '@/lib/auth/registration-gate'

export default async function StudyLayout({ children }: { children: React.ReactNode }) {
  await requireRegistration('/study')

  return <>{children}</>
}
