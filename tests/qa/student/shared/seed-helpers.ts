/**
 * Shared seed helpers
 * Adapts existing E2E helpers for the scenario system
 * @fileType helper
 * @domain qa
 * @pattern seed-helpers
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import type { ActionRef } from '../actions/types'

export interface SeedOptions {
  email?: string
  password?: string
  role?: 'student' | 'admin'
}

export async function seedUser(options: SeedOptions = {}): Promise<ActionRef> {
  const payload = await getPayload({ config })

  const email =
    options.email || `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@example.com`
  const password = options.password || 'testPassword123!'

  const user = await payload.create({
    collection: 'users',
    data: {
      name: email.split('@')[0],
      email,
      password,
      role: options.role || 'student',
    },
    overrideAccess: true,
  })

  return {
    id: user.id as string,
    email: email,
    password: password,
    role: options.role || 'student',
    _collection: 'users',
  }
}

export async function seedCourse(options: {
  title?: string
  slug?: string
  accessType?: 'free' | 'gated' | 'mandatory'
}): Promise<ActionRef> {
  const payload = await getPayload({ config })

  const slug =
    options.slug || `test-course-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

  const course = await payload.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: 'courses' as any,
    data: {
      title: options.title || 'Test Course',
      slug,
      courseLabel: 'TEST',
      status: 'published',
      isActive: true,
      accessType: options.accessType || 'free',
      locale: 'he',
    },
    overrideAccess: true,
  })

  return {
    id: course.id as string,
    slug: course.slug as string,
    title: options.title || 'Test Course',
    _collection: 'courses',
  }
}
