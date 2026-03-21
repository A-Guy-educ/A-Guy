/**
 * @fileType converter
 * @domain qa
 * @pattern scenario-converter
 * @ai-summary Converts scenarios between editor format and QA runner format
 */
import type { Scenario } from './schema'

// QA scenario format (inline type since we can't import from tests/)
interface QAScenario {
  id: string
  name: string
  journey: string
  type: 'core' | 'feature' | 'edge'
  area:
    | 'auth'
    | 'onboarding'
    | 'navigation'
    | 'lessons'
    | 'exercises'
    | 'chat'
    | 'account'
    | 'study-plan'
    | 'access-control'
  tags?: string[]
  locale: 'he' | 'en'
  preconditions?: Array<{
    action: 'seed'
    entity: string
    data: Record<string, unknown>
    ref: string
  }>
  steps: Array<{
    action: string
    input?: Record<string, unknown>
    description?: string
  }>
  teardown?: 'auto' | 'manual'
}

/**
 * Convert editor scenario format to QA runner format
 */
export function convertToQAFormat(
  editorScenario: Partial<Scenario>,
  options?: {
    journey?: string
    area?: string
  },
): QAScenario {
  const id = editorScenario.id || 'untitled-scenario'
  const journey = editorScenario.journey || options?.journey || 'default'
  const area = (editorScenario.area as QAScenario['area']) || options?.area || 'navigation'

  // Convert steps
  const steps = (editorScenario.steps || []).map((step) => ({
    action: step.action,
    input: step.input || (step.target ? { target: step.target } : undefined),
    description: step.description,
  }))

  // Convert preconditions
  const preconditions = (editorScenario.preconditions || []).map((pre) => ({
    action: pre.action as 'seed',
    entity: pre.entity as string,
    data: pre.data,
    ref: pre.ref || pre.entity,
  }))

  return {
    id: id.replace(/[^a-z0-9-]/g, '-').toLowerCase(),
    name: editorScenario.name || 'Untitled Scenario',
    journey,
    type: (editorScenario.type as QAScenario['type']) || 'feature',
    area,
    tags: editorScenario.tags,
    locale: (editorScenario.locale as QAScenario['locale']) || 'he',
    preconditions: preconditions.length > 0 ? preconditions : undefined,
    steps,
    teardown: 'auto',
  }
}

/**
 * Get suggested action type based on step properties
 */
export function suggestActionType(step: {
  type?: string
  action?: string
  target?: string
}): string {
  if (step.action) return step.action

  // Suggest based on step type
  switch (step.type) {
    case 'given':
      return 'navigate'
    case 'when':
      return 'navigate'
    case 'then':
      return 'see'
    default:
      return 'navigate'
  }
}

/**
 * Generate Playwright test code from scenario
 */
export function generatePlaywrightTest(
  scenario: Partial<Scenario>,
  options?: {
    testId?: string
    includeImports?: boolean
  },
): string {
  const lines: string[] = []

  if (options?.includeImports !== false) {
    lines.push("import { test, expect } from '@playwright/test'")
    lines.push('')
  }

  lines.push(`test('${scenario.name || 'Untitled scenario'}', async ({ page }) => {`)
  lines.push('  // Setup')
  if (scenario.preconditions?.length) {
    lines.push('  // TODO: Implement seed preconditions')
  }
  lines.push('')

  for (const step of scenario.steps || []) {
    lines.push(`  // ${step.type}: ${step.action} ${step.target || ''}`)

    // Generate basic Playwright code based on action
    switch (step.action) {
      case 'click':
        lines.push(`  await page.click('${step.target || '[selector]'}')`)
        break
      case 'navigate':
        lines.push(`  await page.goto('${step.target || '/'}' )`)
        break
      case 'fill':
        lines.push(
          `  await page.fill('${step.target || '[selector]'}', '${step.input?.value || ''}')`,
        )
        break
      case 'see':
        lines.push(`  await expect(page.locator('${step.target || '[selector]'}')).toBeVisible()`)
        break
      case 'dontSee':
        lines.push(
          `  await expect(page.locator('${step.target || '[selector]'}')).not.toBeVisible()`,
        )
        break
      case 'beAt':
        lines.push(`  await expect(page).toHaveURL(/${step.target || '.*'}/)`)
        break
      default:
        lines.push(`  // TODO: Implement ${step.action} action`)
    }
    lines.push('')
  }

  lines.push('})')

  return lines.join('\n')
}
