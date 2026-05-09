#!/usr/bin/env bash
# .kody/scripts/auto-resolve-tick.sh
#
# Deterministic full tick for the auto-resolve job.
# Reads state, enumerates open non-draft CONFLICTING PRs, applies the
# attempts/stuck rules, posts comments, and emits the
# kody-job-next-state block on stdout. Job agent's only job:
# run this script and emit its stdout verbatim.
#
# Replaces a prose iteration that hallucinated PR numbers and SHAs and
# posted @kody resolve on closed PRs. The rules are fully deterministic.

set -euo pipefail

STATE_FILE=".kody/jobs/auto-resolve.state.json"
OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if [ -f "$STATE_FILE" ]; then
  PRIOR=$(jq -c '.data.perPr // {}' "$STATE_FILE")
else
  PRIOR='{}'
fi

PRS=$(gh pr list --state open --limit 200 \
  --json number,isDraft,headRefOid,mergeable,labels)

CANDIDATES=$(echo "$PRS" | jq -c '[.[] | select(
  .isDraft == false and
  .mergeable == "CONFLICTING"
)]')

NEW_PERPR='{}'
ACTIONS_TAKEN=()

COUNT=$(echo "$CANDIDATES" | jq 'length')
echo "[auto-resolve] now=$NOW_ISO open_non_draft_conflicting=$COUNT"
echo
echo "| pr | head[:8] | prior | action | reason |"
echo "|---|---|---|---|---|"

for i in $(seq 0 $((COUNT - 1))); do
  row=$(echo "$CANDIDATES" | jq -c ".[$i]")
  pr=$(echo "$row" | jq -r '.number')
  head=$(echo "$row" | jq -r '.headRefOid')
  prior_entry=$(echo "$PRIOR" | jq -c --arg k "$pr" '.[$k] // null')
  prior_summary="—"
  if [ "$prior_entry" != "null" ]; then
    p_sha=$(echo "$prior_entry" | jq -r '.lastSha')
    p_att=$(echo "$prior_entry" | jq -r '.attempts')
    p_stk=$(echo "$prior_entry" | jq -r '.stuck')
    prior_summary="sha=${p_sha:0:8} att=$p_att stuck=$p_stk"
  fi

  # SHA-change reset
  if [ "$prior_entry" = "null" ] || [ "$(echo "$prior_entry" | jq -r '.lastSha')" != "$head" ]; then
    effective=$(jq -nc --arg s "$head" '{lastSha:$s, attempts:0, stuck:false}')
  else
    effective="$prior_entry"
  fi

  stuck=$(echo "$effective" | jq -r '.stuck')
  if [ "$stuck" = "true" ]; then
    echo "| #$pr | ${head:0:8} | $prior_summary | skip | already stuck |"
    NEW_PERPR=$(echo "$NEW_PERPR" | jq -c --arg k "$pr" --argjson v "$effective" '. + {($k):$v}')
    continue
  fi

  attempts=$(echo "$effective" | jq -r '.attempts')
  if [ "$attempts" -ge 2 ]; then
    gh pr comment "$pr" --body "kody resolve stuck — needs human" >/dev/null
    gh pr edit "$pr" --add-label "kody:stuck-conflict" >/dev/null || true
    new_entry=$(echo "$effective" | jq -c '. + {stuck:true}')
    NEW_PERPR=$(echo "$NEW_PERPR" | jq -c --arg k "$pr" --argjson v "$new_entry" '. + {($k):$v}')
    ACTIONS_TAKEN+=("marked stuck #$pr")
    echo "| #$pr | ${head:0:8} | $prior_summary | mark-stuck | attempts=$attempts >= 2 |"
    continue
  fi

  gh pr comment "$pr" --body '@kody resolve' >/dev/null
  new_entry=$(echo "$effective" | jq -c --arg s "$head" '
    {lastSha:$s, attempts:((.attempts // 0)+1), stuck:false}
  ')
  NEW_PERPR=$(echo "$NEW_PERPR" | jq -c --arg k "$pr" --argjson v "$new_entry" '. + {($k):$v}')
  ACTIONS_TAKEN+=("posted @kody resolve on #$pr")
  echo "| #$pr | ${head:0:8} | $prior_summary | resolve | conflicting, attempts→$((attempts+1)) |"
done

echo
echo "actions taken: ${#ACTIONS_TAKEN[@]}"
for a in "${ACTIONS_TAKEN[@]}"; do echo "  - $a"; done

cat <<EOF

\`\`\`kody-job-next-state
{
  "cursor": "auto-resolve-$NOW_ISO",
  "data": { "perPr": $NEW_PERPR },
  "done": false
}
\`\`\`
EOF
