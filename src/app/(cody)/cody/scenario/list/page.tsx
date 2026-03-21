/**
 * @fileType page
 * @domain cody
 * @pattern scenario-list-page
 * @ai-summary List page for viewing all scenarios
 */
import Link from 'next/link'
import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { Badge } from '@/ui/web/components/badge'

export const metadata = {
  title: 'Scenarios',
  description: 'View and manage all scenarios',
  path: '/cody/scenario/list',
}

interface ScenarioSummary {
  id: string
  name: string
  type: string
  path: string
}

async function getScenarios(): Promise<{
  scenarios: ScenarioSummary[]
  prototypes: string[]
}> {
  try {
    // Fetch scenarios from API
    const scenariosRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/cody/scenario/scenarios`,
      {
        cache: 'no-store',
      },
    )
    const scenariosData = scenariosRes.ok ? await scenariosRes.json() : { scenarios: [] }

    // Fetch prototypes
    const { listPrototypes } = await import('@/infra/qa/prototype/loader')
    const prototypes = await listPrototypes()

    return {
      scenarios: scenariosData.scenarios || [],
      prototypes,
    }
  } catch {
    return { scenarios: [], prototypes: [] }
  }
}

export default async function ScenarioListPage() {
  const { scenarios, prototypes } = await getScenarios()

  // Group scenarios by type
  const coreScenarios = scenarios.filter((s) => s.type === 'core')
  const featureScenarios = scenarios.filter((s) => s.type === 'feature')
  const edgeScenarios = scenarios.filter((s) => s.type === 'edge')

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex items-center justify-between py-4">
          <div>
            <h1 className="text-2xl font-bold">Scenarios</h1>
            <p className="text-sm text-muted-foreground">
              {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/cody/scenario/new">
              <Button>New Scenario</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-6">
        {/* Quick Links */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Prototypes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {prototypes.length} prototype{prototypes.length !== 1 ? 's' : ''} available
              </p>
              <Link href="/cody/scenario">
                <Button variant="outline" size="sm">
                  Browse
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Design System</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Browse DS components</p>
              <Link href="/cody/scenario">
                <Button variant="outline" size="sm">
                  View Components
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">GitHub</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Create issue from scenario</p>
              <Link href="/cody/scenario">
                <Button variant="outline" size="sm">
                  Create Issue
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Scenarios by Category */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Scenario Categories</h2>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Core</span>
                  <Badge variant="default">{coreScenarios.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Critical user flows and main functionality
                </p>
                {coreScenarios.length > 0 ? (
                  <ul className="space-y-1 mb-4">
                    {coreScenarios.slice(0, 3).map((s) => (
                      <li key={s.id} className="text-sm truncate">
                        {s.name}
                      </li>
                    ))}
                    {coreScenarios.length > 3 && (
                      <li className="text-xs text-muted-foreground">
                        +{coreScenarios.length - 3} more
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">No scenarios yet</p>
                )}
                <Link href="/cody/scenario?category=core">
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Feature</span>
                  <Badge variant="secondary">{featureScenarios.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Specific feature functionality</p>
                {featureScenarios.length > 0 ? (
                  <ul className="space-y-1 mb-4">
                    {featureScenarios.slice(0, 3).map((s) => (
                      <li key={s.id} className="text-sm truncate">
                        {s.name}
                      </li>
                    ))}
                    {featureScenarios.length > 3 && (
                      <li className="text-xs text-muted-foreground">
                        +{featureScenarios.length - 3} more
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">No scenarios yet</p>
                )}
                <Link href="/cody/scenario?category=feature">
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Edge</span>
                  <Badge variant="outline">{edgeScenarios.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Edge case handling</p>
                {edgeScenarios.length > 0 ? (
                  <ul className="space-y-1 mb-4">
                    {edgeScenarios.slice(0, 3).map((s) => (
                      <li key={s.id} className="text-sm truncate">
                        {s.name}
                      </li>
                    ))}
                    {edgeScenarios.length > 3 && (
                      <li className="text-xs text-muted-foreground">
                        +{edgeScenarios.length - 3} more
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">No scenarios yet</p>
                )}
                <Link href="/cody/scenario?category=edge">
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
