# Self-Growing Pipeline

The Cody pipeline includes a learning system that improves itself over time through pattern recognition, knowledge accumulation, and automatic skill creation.

## Architecture

```
Task Completed
      ↓
  docs stage (writes docs.md + memory.json)
  [nightly inspector: Knowledge Gardener]
      ↓
  ┌─────────────┬──────────────┐
  │             │              │
Pattern      Skill          Knowledge
Detection    Creation       Aggregation
  │             │              │
  ▼             ▼              ▼
Update       .agents/       .ai-docs/
knowledge    skills/        knowledge/
index        <new>/         index.json
```

> **Note**: The `reflect` stage has been removed from the pipeline. Pattern detection, knowledge update, and skill creation are now handled by the **Knowledge Gardener** nightly inspector plugin.

## Current Implementation

### Memory Items (`memory.json`)
Each completed task produces a structured memory item in its task directory:
- **Patterns**: Architectural/integration/code patterns used
- **Gotchas**: Lessons learned, things that caused fix loops
- **Reusable code**: New utilities, shared components created
- **Skill candidates**: Patterns that could become skills

### Knowledge Index (`.ai-docs/knowledge/index.json`)
Cross-task knowledge base that grows over time:
- **Entries**: One per completed task (capped at 100)
- **Pattern frequency**: How often each pattern appears across tasks
- **Skills created**: Auto-generated skills and when

### Auto-Created Skills
When a pattern appears 3+ times, the Knowledge Gardener automatically creates a skill:
- Located in `.agents/skills/<pattern-name>/SKILL.md`
- Contains recipe, examples from past tasks, aggregated gotchas
- Available to future architect/build agents via skill discovery

### Knowledge-Aware Planning
The architect and build stages read the knowledge index to:
- Find relevant past tasks for reference
- Avoid known gotchas
- Use existing reusable code instead of recreating

## Files

| File | Purpose |
|------|---------|
| `.ai-docs/knowledge/index.json` | Cross-task knowledge base |
| `.tasks/<id>/memory.json` | Per-task structured memory |
| `.opencode/agents/docs.md` | Docs agent (writes memory.json) |

---

## Future: Self-Creating Subagents

> **Status**: Recommendation — not yet implemented

### Vision
When the pipeline encounters a task requiring domain expertise that no current agent has, it should be able to create a specialist agent on the fly.

### Proposed Architecture

```
Knowledge Gardener detects:
  "3 tasks needed MongoDB aggregation expertise, no mongo-expert agent exists"
      ↓
  Creates .opencode/agents/mongo-expert.md with:
    - Domain knowledge extracted from past tasks
    - Common patterns and gotchas
    - Tool permissions (bash for mongosh, read/write/edit for code)
      ↓
  Registers in opencode.json:
    "mongo-expert": { "model": "...", "description": "..." }
      ↓
  Future tasks can invoke @mongo-expert as a subagent
```

### Implementation Steps
1. **Agent template system**: Standard `.opencode/agents/<name>.md` template with sections
2. **Registration API**: Script to safely add/update agents in `opencode.json`
3. **Trigger**: Reflect agent detects repeated domain-specific fix loops or review failures
4. **Quality gate**: New agents start with `advisory: true` — their output is suggestions, not actions
5. **Promotion**: After 3 successful uses without corrections, promote to full agent

### Guardrails
- **Max agents**: Cap at 30 registered agents to prevent sprawl
- **Expiry**: Agents unused for 30 days get archived (moved to `.opencode/agents/archived/`)
- **Review**: Auto-created agents are included in PR for human review
- **Model selection**: New agents default to the cheapest model; upgrade based on performance

### Key Risks
- Agent prompt quality — auto-generated prompts may be poor
- Model cost — more agents = more API calls
- Complexity — more agents = harder to debug pipeline
- Mitigation: Start with advisory-only agents, require human promotion

---

## Future: Dynamic MCP Integration

> **Status**: Recommendation — not yet implemented

### Vision
When a task requires external service integration (Stripe, Twilio, AWS, etc.), the pipeline should be able to discover and install relevant MCP servers automatically.

### Proposed Architecture

```
architect stage detects:
  "Task requires Stripe API integration"
      ↓
  Checks knowledge index: "stripe-mcp" not in installed MCPs
      ↓
  Searches MCP registry (npm, GitHub) for Stripe MCP server
      ↓
  If found with sufficient trust signals:
    - Install: npx @stripe/mcp-server
    - Configure in opencode.json mcp section
    - Make available to build agent
      ↓
  Build agent uses Stripe MCP for API calls during implementation
```

### Implementation Steps
1. **MCP Registry Client**: Search npm for `@*/mcp-server` packages, check downloads/stars
2. **Trust scoring**: Only install MCPs with >1000 weekly downloads, from known publishers
3. **Sandboxing**: Run new MCPs in isolated context, limit filesystem/network access
4. **Configuration**: Auto-generate MCP config in `opencode.json`
5. **Cleanup**: Remove task-specific MCPs after PR is merged (or keep if reused)

### Trust Signals for Auto-Install
| Signal | Weight | Threshold |
|--------|--------|-----------|
| npm weekly downloads | High | >1,000 |
| GitHub stars | Medium | >100 |
| Known publisher (@stripe, @aws, etc.) | High | Allowlist |
| Package age | Medium | >3 months |
| Recent updates | Medium | Within 6 months |
| Security advisories | Blocker | 0 |

### Guardrails
- **Allowlist-first**: Start with a curated allowlist of trusted MCP packages
- **Human approval**: For MCPs not on the allowlist, pause and request approval (like risk gates)
- **Cost tracking**: Track MCP API costs per task
- **Isolation**: Each MCP runs in its own process with minimal permissions
- **Audit trail**: Log all MCP installations and usages in knowledge index

### Key Risks
- **Supply chain attacks**: Malicious MCP packages could exfiltrate data
- **API costs**: MCPs may make paid API calls without cost awareness
- **Reliability**: External MCPs may fail or have incompatible APIs
- **Mitigation**: Allowlist + human approval + sandboxing + cost limits

### Alternative: MCP Template System
Instead of auto-installing third-party MCPs, create an internal MCP template:
1. Reflect agent detects repeated patterns of external API usage
2. Creates a lightweight MCP wrapper for the specific integration
3. Wrapper uses project's existing HTTP utilities (no third-party dependency)
4. Lower risk, but more limited capability

---

## Metrics & Monitoring

Track these to measure self-growth effectiveness:

| Metric | Source | Target |
|--------|--------|--------|
| Skills auto-created | knowledge/index.json | 1-2 per month |
| Pattern reuse rate | knowledge/index.json | Increasing trend |
| Fix loop reduction | status.json feedbackLoops | Decreasing trend |
| Knowledge entries | knowledge/index.json | Growing, capped at 100 |
| Skill usage | architect plan.md references | >0 for auto-skills |
