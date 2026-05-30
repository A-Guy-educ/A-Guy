Resolved merge conflicts for PR #2203 (deploy: dev → main, v0.25.10).

**What changed:** 4 of 21 listed "conflicted" files had real conflict markers — all were .kody event/session JSONL chat transcript files. The remaining 17 files had no markers (state files with identical content on both sides, or files not present in origin/main like missions/ and secrets.enc).

**Resolution decisions:**
- `.kody/events/vibe-1534-*.jsonl` and `.kody/sessions/vibe-1534-*.jsonl`: Took HEAD (PR branch) version — complete chat history with message+done+exit events, more complete than origin/main's chat.ready-only snapshot.
- `.kody/events/vibe-1587-*.jsonl` and `.kody/sessions/vibe-1587-*.jsonl`: Took HEAD version — complete chat history with full tool/thinking/message sequence.
- `.kody/secrets.enc`: Does not exist in origin/main (was added on PR branch); kept as-is.
- `.kody/last-run.jsonl`: Contains embedded conflict markers inside JSON string values (artifacts from prior merge attempt); these are not file-level git conflicts and will not block the merge commit.

**No code changes** — only Kody operational files were touched.
