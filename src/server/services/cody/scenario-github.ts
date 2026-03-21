/**
 * @fileType api-client
 * @domain cody
 * @pattern scenario-github-api
 * @ai-summary GitHub API integration for scenario-based issues
 */
import { Octokit } from '@octokit/rest'
import { throttling } from '@octokit/plugin-throttling'

// Minimal GitHub client for scenario issues (inlined to avoid UI layer imports)

const GITHUB_OWNER = 'A-Guy-educ'
const GITHUB_REPO = 'A-Guy'

type ThrottledOctokit = Octokit & ReturnType<typeof throttling>

let octokitInstance: Octokit | null = null

function getOctokit(): Octokit {
  if (octokitInstance) return octokitInstance as ThrottledOctokit

  const token = process.env.CODY_BOT_TOKEN || process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured')
  }

  const MyOctokit = Octokit.plugin(throttling)
  octokitInstance = new MyOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, _options, _octokit) => {
        if (_options.request?.headers?.['x-octokit-retry-count'] === 0) {
          console.warn(`[Cody] Rate limited, retrying after ${retryAfter}s`)
          return true
        }
        console.error(`[Cody] Rate limit hit twice, giving up`)
        return false
      },
      onSecondaryRateLimit: (retryAfter, _options, _octokit) => {
        const retryCount = (_options.request?.retryCount as number) ?? 0
        if (retryCount < 2) {
          console.warn(`[Cody] Secondary rate limit, retrying after ${retryAfter}s`)
          return true
        }
        console.error(`[Cody] Secondary rate limit hit ${retryCount + 1} times, giving up`)
        return false
      },
    },
  })

  return octokitInstance as ThrottledOctokit
}

export interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  labels: Array<{ name: string; color: string }>
  milestone: { title: string } | null
  assignees: Array<{ login: string; avatar_url: string }>
  created_at: string
  updated_at: string
  closed_at: string | null
  html_url: string
}

export interface ScenarioIssue {
  number: number
  title: string
  category: 'core' | 'feature' | 'edge'
  area?: string
  scenario: string
  prototype?: string
  fixture?: string
  behaviors?: string[]
  dsComponents?: string[]
  status: 'draft' | 'planned' | 'implemented' | 'verified'
  createdAt: string
  updatedAt: string
}

/**
 * Create a scenario issue on GitHub
 */
export async function createScenarioIssue(data: {
  title: string
  category: 'core' | 'feature' | 'edge'
  area?: string
  scenario: string
  prototype?: string
  fixture?: string
  behaviors?: string[]
  dsComponents?: string[]
}): Promise<GitHubIssue> {
  const octokit = getOctokit()

  const labels = ['type:scenario', `category:${data.category}`]
  if (data.area) {
    labels.push(`area:${data.area}`)
  }

  const body = buildScenarioBody(data)

  const { data: issue } = await octokit.issues.create({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    title: `[Scenario] ${data.title}`,
    body,
    labels,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedIssue = issue as any

  return {
    id: typedIssue.id,
    number: typedIssue.number,
    title: typedIssue.title,
    body: typedIssue.body ?? null,
    state: typedIssue.state as 'open' | 'closed',
    labels: (typedIssue.labels ?? []).map((l: { name?: string; color?: string }) => ({
      name: l.name ?? '',
      color: l.color ?? '000000',
    })),
    milestone: typedIssue.milestone ? { title: typedIssue.milestone.title ?? '' } : null,
    assignees: (typedIssue.assignees ?? []).map((a: { login?: string; avatar_url?: string }) => ({
      login: a.login ?? '',
      avatar_url: a.avatar_url ?? '',
    })),
    created_at: typedIssue.created_at ?? '',
    updated_at: typedIssue.updated_at ?? '',
    closed_at: typedIssue.closed_at ?? null,
    html_url: typedIssue.html_url ?? '',
  }
}

/**
 * Build the scenario body markdown
 */
function buildScenarioBody(data: {
  scenario: string
  prototype?: string
  fixture?: string
  behaviors?: string[]
  dsComponents?: string[]
}): string {
  const lines: string[] = []

  lines.push('## Scenario')
  lines.push('')
  lines.push(data.scenario)
  lines.push('')

  if (data.prototype) {
    lines.push('## Prototype')
    lines.push('')
    lines.push(`Reference: \`${data.prototype}\``)
    lines.push('')
  }

  if (data.fixture) {
    lines.push('## Fixture')
    lines.push('')
    lines.push(`\`${data.fixture}\``)
    lines.push('')
  }

  if (data.behaviors && data.behaviors.length > 0) {
    lines.push('## Site Behaviors')
    lines.push('')
    for (const behavior of data.behaviors) {
      lines.push(`- ${behavior}`)
    }
    lines.push('')
  }

  if (data.dsComponents && data.dsComponents.length > 0) {
    lines.push('## Design System Components')
    lines.push('')
    for (const component of data.dsComponents) {
      lines.push(`- ${component}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('*Created via Scenario Editor*')

  return lines.join('\n')
}

/**
 * Get all scenario issues
 */
export async function getScenarioIssues(options?: {
  category?: 'core' | 'feature' | 'edge'
  status?: 'draft' | 'planned' | 'implemented' | 'verified'
}): Promise<ScenarioIssue[]> {
  const octokit = getOctokit()

  const { data } = await octokit.issues.listForRepo({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    labels: 'type:scenario',
    state: 'all',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let issues = data.map((issue: any) => parseScenarioIssue(issue))

  if (options?.category) {
    issues = issues.filter((i: ScenarioIssue) => i.category === options.category)
  }

  if (options?.status) {
    issues = issues.filter((i: ScenarioIssue) => i.status === options.status)
  }

  return issues
}

/**
 * Parse a GitHub issue into a ScenarioIssue
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseScenarioIssue(issue: any): ScenarioIssue {
  const labels = issue.labels || []

  // Extract metadata from labels
  const categoryLabel = labels.find((l: { name?: string }) => l.name?.startsWith('category:'))
  const category = categoryLabel?.name?.replace('category:', '') as
    | 'core'
    | 'feature'
    | 'edge'
    | undefined

  const areaLabel = labels.find((l: { name?: string }) => l.name?.startsWith('area:'))
  const area = areaLabel?.name?.replace('area:', '')

  const statusLabel = labels.find((l: { name?: string }) =>
    ['draft', 'planned', 'implemented', 'verified'].includes(l.name ?? ''),
  )
  const status = statusLabel?.name as 'draft' | 'planned' | 'implemented' | 'verified' | undefined

  // Extract scenario from body
  const scenarioMatch = issue.body?.match(/## Scenario\n\n([\s\S]*?)(?=\n## |$)/)
  const scenario = scenarioMatch?.[1]?.trim() || ''

  // Extract prototype reference
  const prototypeMatch = issue.body?.match(/## Prototype\n\n`([^`]+)`/)
  const prototype = prototypeMatch?.[1]

  // Extract fixture
  const fixtureMatch = issue.body?.match(/## Fixture\n\n`([^`]+)`/)
  const fixture = fixtureMatch?.[1]

  // Extract behaviors
  const behaviorsMatch = issue.body?.match(/## Site Behaviors\n\n([\s\S]*?)(?=\n## |$)/)
  const behaviors = behaviorsMatch?.[1]
    ?.split('\n')
    .filter((l: string) => l.startsWith('- '))
    .map((l: string) => l.replace('- ', ''))

  // Extract DS components
  const dsComponentsMatch = issue.body?.match(
    /## Design System Components\n\n([\s\S]*?)(?=\n## |$)/,
  )
  const dsComponents = dsComponentsMatch?.[1]
    ?.split('\n')
    .filter((l: string) => l.startsWith('- '))
    .map((l: string) => l.replace('- ', ''))

  return {
    number: issue.number,
    title: issue.title.replace('[Scenario] ', ''),
    category: category || 'feature',
    area,
    scenario,
    prototype,
    fixture,
    behaviors,
    dsComponents,
    status: status || 'draft',
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
  }
}

/**
 * Update a scenario issue status
 */
export async function updateScenarioStatus(
  issueNumber: number,
  newStatus: 'draft' | 'planned' | 'implemented' | 'verified',
): Promise<void> {
  const octokit = getOctokit()

  // Get current issue to find old status label
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentIssue } = await (octokit as any).issues.get({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    issue_number: issueNumber,
  })

  const oldStatusLabels = [
    'status:draft',
    'status:planned',
    'status:implemented',
    'status:verified',
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentLabels = (currentIssue.labels as any[]).map((l: { name?: string }) => l.name ?? '')

  // Filter out old status labels and add new one
  const newLabels = [
    ...currentLabels.filter((l: string) => !oldStatusLabels.includes(l)),
    `status:${newStatus}`,
  ]

  await octokit.issues.update({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    issue_number: issueNumber,
    labels: newLabels,
  })
}

/**
 * Get a single scenario by issue number
 */
export async function getScenarioIssue(issueNumber: number): Promise<ScenarioIssue | null> {
  try {
    const octokit = getOctokit()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (octokit as any).issues.get({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      issue_number: issueNumber,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(data.labels as any[]).some((l: { name?: string }) => l.name === 'type:scenario')) {
      return null
    }

    return parseScenarioIssue(data)
  } catch {
    return null
  }
}
