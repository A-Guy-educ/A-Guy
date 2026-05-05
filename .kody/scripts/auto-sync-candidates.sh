#!/usr/bin/env bash
# .kody/scripts/auto-sync-candidates.sh
#
# Deterministic candidate enumerator for the auto-sync mission. The mission
# agent must call this and use its output verbatim — do NOT compute candidates
# or behind-counts in the prompt. Past iterations of the agent silently dropped
# candidates and mis-paired parallel `gh api compare` outputs; this script
# removes both failure modes by walking PRs sequentially and emitting one
# fully-typed JSON row per candidate.
#
# Output: a single JSON array on stdout. One element per candidate PR (open,
# non-draft, MERGEABLE, no `kody:no-sync` label). Each element:
#   {
#     "pr":            <number>,
#     "head_sha":      <string>,
#     "base":          <string>,
#     "behind":        <number>,            // commits the head is behind base
#     "ci_in_progress": <bool>,             // any check IN_PROGRESS|QUEUED
#     "prior":         <object|null>        // perPr[pr] from the state file
#   }
#
# Side effects: none. The script never posts comments or mutates state.
#
# Exit code: 0 on success; non-zero on any tool or parse failure.

set -euo pipefail

STATE_FILE=".kody/missions/auto-sync.state.json"
OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

if [ -f "$STATE_FILE" ]; then
  PRIOR=$(jq -c '.data.perPr // {}' "$STATE_FILE")
else
  PRIOR='{}'
fi

# All open PRs, with the fields auto-sync needs to filter and decide.
PRS=$(gh pr list \
  --state open --limit 200 \
  --json number,isDraft,headRefOid,baseRefName,mergeable,labels,statusCheckRollup)

# Filter: non-draft, MERGEABLE, no kody:no-sync label.
CANDIDATES=$(echo "$PRS" | jq -c '[.[] | select(
  .isDraft == false and
  .mergeable == "MERGEABLE" and
  ([.labels[].name] | index("kody:no-sync") | not)
)]')

# Walk candidates sequentially. Compute behind_by per PR with one API call,
# echoing the (sha, behind) pair adjacent so misalignment is impossible.
COUNT=$(echo "$CANDIDATES" | jq 'length')
OUT='[]'
for i in $(seq 0 $((COUNT - 1))); do
  row=$(echo "$CANDIDATES" | jq -c ".[$i]")
  pr=$(echo "$row" | jq -r '.number')
  head=$(echo "$row" | jq -r '.headRefOid')
  base=$(echo "$row" | jq -r '.baseRefName')

  behind=$(gh api "repos/$OWNER_REPO/compare/$base...$head" --jq '.behind_by')

  ci_in_progress=$(echo "$row" | jq -c '
    [.statusCheckRollup // [] | .[] |
       select(.status == "IN_PROGRESS" or .status == "QUEUED")] | length > 0
  ')

  prior_entry=$(echo "$PRIOR" | jq -c --arg k "$pr" '.[$k] // null')

  OUT=$(echo "$OUT" | jq -c \
    --argjson pr "$pr" \
    --arg head "$head" \
    --arg base "$base" \
    --argjson behind "$behind" \
    --argjson ci "$ci_in_progress" \
    --argjson prior "$prior_entry" \
    '. + [{
      pr: $pr,
      head_sha: $head,
      base: $base,
      behind: $behind,
      ci_in_progress: $ci,
      prior: $prior
    }]')
done

echo "$OUT" | jq '.'
