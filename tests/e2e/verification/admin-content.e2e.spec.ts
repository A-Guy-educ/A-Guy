/**
 * Pre-Launch Verification: #19 Course Creation, #20 Course Archiving,
 * #21 Chapter Management, #22 Content Updates
 *
 * Strategy: Hybrid – API for data ops, verify admin UI loads correctly.
 * @tags @critical
 */
import { expect, test } from '@playwright/test'
import config from '@payload-config'
import { getPayload } from 'payload'

import {
  cleanupVerificationData,
  loginAsAdmin,
  seedVerificationData,
  type VerificationData,
} from '../helpers/verification-fixtures'

let data: VerificationData | null = null

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000)
  data = await seedVerificationData()
})

test.setTimeout(60_000)

test.afterAll(async () => {
  await cleanupVerificationData(data)
})

test.describe('Scenario #19 – Course Creation', () => {
  test('new course created via API appears in catalog', async ({ page }) => {
    const payload = await getPayload({ config })

    const slug = `verify-course-${Date.now()}`
    const course = await payload.create({
      collection: 'courses',
      data: {
        title: 'Verification Test Course',
        slug,
        status: 'published',
        isActive: true,
        locale: 'he',
        order: 999,
        pageAccessType: 'free',
        accessType: 'free',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
      draft: false,
    })

    try {
      await loginAsAdmin(page)
      await page.goto('/courses')
      await page.waitForLoadState('domcontentloaded')

      const body = await page.locator('body').textContent()
      expect(body).toContain('Verification Test Course')
    } finally {
      await payload.delete({
        collection: 'courses',
        id: course.id,
        overrideAccess: true,
      })
    }
  })
})

test.describe('Scenario #20 – Course Archiving', () => {
  test('unpublished course is hidden from student view', async ({ page }) => {
    const payload = await getPayload({ config })

    const slug = `archive-test-${Date.now()}`
    const course = await payload.create({
      collection: 'courses',
      data: {
        title: 'Archive Test Course',
        slug,
        status: 'draft',
        isActive: false,
        locale: 'he',
        order: 999,
        pageAccessType: 'free',
        accessType: 'free',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
      draft: false,
    })

    try {
      await loginAsAdmin(page)
      await page.goto('/courses')
      await page.waitForLoadState('domcontentloaded')

      const body = await page.locator('body').textContent()
      expect(body).not.toContain('Archive Test Course')
    } finally {
      await payload.delete({
        collection: 'courses',
        id: course.id,
        overrideAccess: true,
      })
    }
  })
})

test.describe('Scenario #21 – Chapter Management', () => {
  test('admin panel shows chapters collection', async ({ page }) => {
    test.skip(!data, 'No test data available')
    await loginAsAdmin(page)

    await page.goto('/admin/collections/chapters')
    await page.waitForLoadState('domcontentloaded')

    const content = page.locator('main, [class*="collection-list"], table')
    await expect(content.first()).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Scenario #22 – Content Updates', () => {
  test('changing lesson text via API updates the site', async ({ page }) => {
    test.skip(!data, 'No test data available')
    const payload = await getPayload({ config })

    const uniqueText = `Updated-${Date.now()}`
    await payload.update({
      collection: 'lessons',
      id: data!.course.lessonId,
      data: { description: uniqueText },
      overrideAccess: true,
    })

    await loginAsAdmin(page)
    await page.goto(data!.lessonUrl)
    await page.waitForLoadState('domcontentloaded')

    const body = await page.locator('body').textContent()
    expect(body).toContain(uniqueText)
  })
})
