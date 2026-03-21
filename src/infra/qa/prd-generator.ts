/**
 * @fileType prd-generator
 * @domain qa
 * @pattern prd-generator
 * @ai-summary Generates Product Requirements Documents from scenarios with DS translations
 */
import path from 'path'
import fs from 'fs'

import type { Scenario, ElementMapping, DSComponent } from './schema'
import type { PRD, TranslationEntry, ComponentUsage } from './schema'
import { getDesignSystemComponent } from './design-system/loader'

/**
 * Generate a translation entry for PRD
 */
async function createTranslationEntry(
  prototypeElement: string,
  dsComponent: string,
  reason: string,
): Promise<TranslationEntry> {
  const component = await getDesignSystemComponent(dsComponent)

  return {
    prototypeElement,
    dsComponent,
    variant: component?.variants?.[0],
    reason,
  }
}

/**
 * Generate component usage entry for PRD
 */
function createComponentUsage(component: DSComponent, notes?: string): ComponentUsage {
  return {
    component: component.name,
    path: component.path,
    variant: component.variants?.[0],
    notes: notes || component.description,
  }
}

/**
 * Generate PRD from a scenario
 */
export async function generatePRD(
  scenario: Scenario,
  translations: ElementMapping[],
  componentUsages: DSComponent[],
): Promise<PRD> {
  const translationEntries: TranslationEntry[] = []
  const componentUsageEntries: ComponentUsage[] = []

  // Create translation entries
  for (const t of translations) {
    const entry = await createTranslationEntry(
      t.prototypeSelector,
      t.dsComponent,
      t.reason || `Use ${t.dsComponent} for ${t.prototypeSelector}`,
    )
    translationEntries.push(entry)
  }

  // Create component usage entries
  const seenComponents = new Set<string>()
  for (const component of componentUsages) {
    if (!seenComponents.has(component.name)) {
      seenComponents.add(component.name)
      componentUsageEntries.push(createComponentUsage(component))
    }
  }

  // Build overview from scenario
  const overview = `Implement ${scenario.name} following the scenario-first development system.`

  // Build user story
  const userStory = scenario.steps
    .filter((s) => s.type === 'when' || s.type === 'then')
    .map((s) => `- ${s.description || `${s.action} ${s.target}`}`)
    .join('\n')

  return {
    title: `PRD: ${scenario.name}`,
    overview,
    userStory,
    scenario,
    prototype: scenario.prototype,
    translations: translationEntries,
    components: componentUsageEntries,
    behaviors: scenario.siteBehaviors,
    fixture: scenario.fixture,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Convert PRD to markdown format
 */
export function prdToMarkdown(prd: PRD): string {
  const lines: string[] = []

  lines.push(`# ${prd.title}`)
  lines.push('')

  if (prd.overview) {
    lines.push('## Overview')
    lines.push('')
    lines.push(prd.overview)
    lines.push('')
  }

  if (prd.userStory) {
    lines.push('## User Story')
    lines.push('')
    lines.push(prd.userStory)
    lines.push('')
  }

  if (prd.scenario) {
    lines.push('## Scenario')
    lines.push('')
    lines.push(`**ID:** ${prd.scenario.id}`)
    lines.push(`**Name:** ${prd.scenario.name}`)
    lines.push(`**Type:** ${prd.scenario.type}`)
    if (prd.scenario.area) lines.push(`**Area:** ${prd.scenario.area}`)
    lines.push('')

    if (prd.scenario.steps && prd.scenario.steps.length > 0) {
      lines.push('### Steps')
      lines.push('')
      lines.push('| Type | Action | Target | Component |')
      lines.push('|------|--------|--------|-----------|')
      for (const step of prd.scenario.steps) {
        lines.push(
          `| ${step.type} | ${step.action} | ${step.target} | ${step.component || 'TBD'} |`,
        )
      }
      lines.push('')
    }
  }

  if (prd.translations && prd.translations.length > 0) {
    lines.push('## Prototype → Design System Translation')
    lines.push('')
    lines.push('| Prototype Element | DS Component | Variant | Reason |')
    lines.push('|-----------------|--------------|--------|--------|')
    for (const t of prd.translations) {
      lines.push(
        `| \`${t.prototypeElement}\` | ${t.dsComponent} | ${t.variant || '-'} | ${t.reason} |`,
      )
    }
    lines.push('')
  }

  if (prd.components && prd.components.length > 0) {
    lines.push('## Components Used')
    lines.push('')
    lines.push('| Component | Path | Variant | Notes |')
    lines.push('|-----------|------|---------|-------|')
    for (const c of prd.components) {
      lines.push(`| ${c.component} | \`${c.path}\` | ${c.variant || '-'} | ${c.notes || '-'} |`)
    }
    lines.push('')
  }

  if (prd.behaviors && prd.behaviors.length > 0) {
    lines.push('## Site Behaviors')
    lines.push('')
    for (const behavior of prd.behaviors) {
      lines.push(`- ${behavior}`)
    }
    lines.push('')
  }

  if (prd.fixture) {
    lines.push('## Fixture')
    lines.push('')
    lines.push(`Fixture: \`${prd.fixture}\``)
    lines.push('')
  }

  if (prd.implementationNotes) {
    lines.push('## Implementation Notes')
    lines.push('')
    lines.push(prd.implementationNotes)
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push(`*Generated: ${prd.createdAt}*`)

  return lines.join('\n')
}

/**
 * Save PRD to file
 */
export async function savePRD(prd: PRD, outputPath: string): Promise<void> {
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const markdown = prdToMarkdown(prd)
  fs.writeFileSync(outputPath, markdown)
}

/**
 * Generate PRD file path for a scenario
 */
export function getPRDPath(scenarioId: string): string {
  return path.resolve(process.cwd(), 'site-docs/prds', `${scenarioId}.md`)
}
