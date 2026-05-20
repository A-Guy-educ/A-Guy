---
every: 1h
worker: coo
---

# message-learner

## Job

Scan recent dashboard messages (GitHub Discussion comments in this repo,
in channels whose title starts with `#`) and drop a sticky note for any
message that explicitly opts into memory by starting with one of these
markers:

- `#remember` → `type: preference` (operator-stated rule)
- `#lesson` → `type: lesson` (operator-recorded learning)
- `#decision` → `type: decision` (operator-recorded decision)

Anything else is left alone. This avoids drowning memory in chat noise
— only messages the operator deliberately tags become memory.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script
[message-learner-tick.py](.kody/scripts/message-learner-tick.py) is
the **single source of truth** for the marker contract, lookback
window, and sticky-note shape.

Run the script:

```
python3 .kody/scripts/message-learner-tick.py
```

The script:

1. Queries GitHub Discussions via GraphQL for the last
   `LOOKBACK_DAYS` (default 14) of channel comments.
2. For each comment whose body starts with `#remember`, `#lesson`,
   or `#decision`, derive the sticky type and slug. Slug = first 6
   words of the body after the marker, kebab-cased, capped at 48 chars.
3. **Dedups** by comment GraphQL ID (each comment becomes
   `.kody/memory/msg-<databaseId>.md` exactly once).
4. Drops the sticky into `.kody/memory/inbox/` for the memory-writer
   to file.
5. Logs how many were dropped and exits 0.

## Restrictions

- Never edit or delete the source comment.
- Skip messages authored by bots (`*[bot]`) or by kody itself.
- Skip if the body after the marker is shorter than 20 chars (probably
  an accidental hashtag).
- Skip if a memory file already exists for the same comment.

## Scope

What this job remembers is **what the operator typed and tagged for
memory in the dashboard**. It does not capture untagged chat (that
would be too noisy) or AI-generated replies in the same thread.
