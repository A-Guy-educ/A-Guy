import { requireRegistration } from '@/lib/auth/registration-gate'

export default async function CoursesLayout({ children }: { children: React.ReactNode }) {
  await requireRegistration('/courses')

  return <>{children}</>
}
