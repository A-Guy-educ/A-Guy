/**
 * @fileType api-route
 * @domain cody
 * @pattern scenario-export-api
 * @ai-summary API endpoint to export scenarios in QA runner format or as Playwright tests
 */
import { NextRequest, NextResponse } from 'next/server'
import { convertToQAFormat, generatePlaywrightTest } from '@/infra/qa/scenario-converter'
import type { Scenario } from '@/infra/qa/schema'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scenario, format = 'qa', options = {} } = body

    if (!scenario) {
      return NextResponse.json({ error: 'Missing scenario' }, { status: 400 })
    }

    const parsedScenario = scenario as Partial<Scenario>

    switch (format) {
      case 'qa':
        return NextResponse.json({
          success: true,
          format: 'qa',
          data: convertToQAFormat(parsedScenario, options),
        })

      case 'playwright':
        return NextResponse.json({
          success: true,
          format: 'playwright',
          data: generatePlaywrightTest(parsedScenario, options),
        })

      case 'prd':
        // Generate full PRD
        return NextResponse.json({
          success: true,
          format: 'prd',
          data: {
            title: `PRD: ${parsedScenario.name}`,
            scenario: parsedScenario,
            translations: [],
            components: [],
          },
        })

      default:
        return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Failed to export scenario:', error)
    return NextResponse.json({ error: 'Failed to export scenario' }, { status: 500 })
  }
}
