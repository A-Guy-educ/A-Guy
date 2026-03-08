import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const AGENTS_DIR = path.join(process.cwd(), '.opencode', 'agents')

/** Agents that MUST include domain subagent invocation sections */
const AGENTS_WITH_SUBAGENTS = ['spec.md', 'build.md']

/** Domain subagents that should be referenced consistently across all three agents */
const REQUIRED_SUBAGENTS = [
  'payload-expert',
  'web-expert',
  'admin-expert',
  'llm-expert',
  'security-auditor',
]

function readAgent(filename: string): string {
  return fs.readFileSync(path.join(AGENTS_DIR, filename), 'utf-8')
}

function extractAtMentions(content: string): string[] {
  const matches = content.match(/@[\w-]+/g) || []
  return [...new Set(matches.map((m) => m.slice(1)))] // remove @ prefix, dedupe
}

describe('agent subagent consistency', () => {
  describe('domain subagent references', () => {
    it.each(AGENTS_WITH_SUBAGENTS)(
      '%s should reference all required domain subagents',
      (agentFile) => {
        const content = readAgent(agentFile)

        for (const subagent of REQUIRED_SUBAGENTS) {
          expect(content, `${agentFile} missing @${subagent}`).toContain(`@${subagent}`)
        }
      },
    )

    it('all three agents should reference the exact same set of domain subagents', () => {
      const subagentSets = AGENTS_WITH_SUBAGENTS.map((file) => {
        const content = readAgent(file)
        return REQUIRED_SUBAGENTS.filter((s) => content.includes(`@${s}`)).sort()
      })

      // Every agent should have the same subagents
      for (let i = 1; i < subagentSets.length; i++) {
        expect(
          subagentSets[i],
          `${AGENTS_WITH_SUBAGENTS[i]} differs from ${AGENTS_WITH_SUBAGENTS[0]}`,
        ).toEqual(subagentSets[0])
      }
    })
  })

  describe('subagent files exist', () => {
    it.each(REQUIRED_SUBAGENTS)('agent file should exist for @%s', (subagent) => {
      const agentPath = path.join(AGENTS_DIR, `${subagent}.md`)
      expect(fs.existsSync(agentPath), `Missing agent file: ${agentPath}`).toBe(true)
    })

    it.each(REQUIRED_SUBAGENTS)('@%s should have mode: subagent in frontmatter', (subagent) => {
      const content = readAgent(`${subagent}.md`)
      expect(content, `${subagent}.md missing mode: subagent`).toMatch(/mode:\s*subagent/)
    })
  })

  describe('subagent scoping', () => {
    const SCOPED_SUBAGENTS = [
      'web-expert',
      'admin-expert',
      'payload-expert',
      'security-auditor',
      'llm-expert',
    ]

    it.each(SCOPED_SUBAGENTS)('@%s should have a Focus Area or Scope section', (subagent) => {
      const content = readAgent(`${subagent}.md`)
      const hasScope = /^##\s+(Focus Area|Scope)/m.test(content)
      expect(hasScope, `${subagent}.md missing Focus Area/Scope section`).toBe(true)
    })
  })

  describe('no dangling @mentions', () => {
    it.each(AGENTS_WITH_SUBAGENTS)(
      '%s should not reference subagents without matching agent files',
      (agentFile) => {
        const content = readAgent(agentFile)
        const mentions = extractAtMentions(content)

        // Filter to likely agent references (exclude @param, @returns, etc.)
        const jsdocTags = ['param', 'returns', 'fileType', 'domain', 'pattern', 'ai']
        // Filter skill examples like @skill-name, @webapp-testing (from "npx skills add owner/repo@skill-name")
        const skillExamples = ['skill-name', 'webapp-testing']
        // Filter Skill tool invocations (not agents - use Skill tool, not @mention)
        const skillToolInvocations = [
          'new-block',
          'add-ui-component',
          'quality-check',
          'tdd-workflow',
        ]
        const agentMentions = mentions.filter(
          (m) =>
            !jsdocTags.includes(m) &&
            !skillExamples.includes(m) &&
            !skillToolInvocations.includes(m),
        )

        for (const mention of agentMentions) {
          const agentPath = path.join(AGENTS_DIR, `${mention}.md`)
          expect(
            fs.existsSync(agentPath),
            `${agentFile} references @${mention} but ${mention}.md does not exist`,
          ).toBe(true)
        }
      },
    )
  })
})
