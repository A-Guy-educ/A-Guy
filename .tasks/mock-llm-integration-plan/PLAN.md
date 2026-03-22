# Plan: Integrate Mock-LLM into Cody Pipeline System Tests

## Executive Summary

The Cody pipeline system tests currently use real Groq API calls, taking ~1.5-2 hours per run. This plan outlines integrating the existing mock-llm tool to dramatically reduce test time by recording and replaying LLM responses.

## Current State

### Test Runtime (from GitHub History)
| Run | Duration | Outcome |
|-----|----------|---------|
| 23232044965 | 1h31m47s | failure |
| 23219961839 | 1h37m27s | failure |
| 23216665279 | 1h38m42s | failure |
| 23214538339 | 1h2m5s | cancelled |
| Early runs | 2-4 min | failure (early crash) |

**Average when running**: ~90-100 minutes

### Current Architecture
```
System Test → opencode.test.json → Groq API (real) → ~1.5-2 hours
```

### Available Mock Infrastructure
- ✅ `opencode.mock.json` - Config pointing to `http://localhost:8080/v1`
- ✅ `scripts/system-test/mock-llm/` - Record/replay server
- ❌ No recordings exist yet

## Proposed Integration

### Phase 1: Record Baseline (One-Time)

Run system test with mock-llm in **record mode** to capture all LLM calls:

```bash
# 1. Start mock server in record mode
pnpm tsx scripts/system-test/mock-llm/cli.ts \
  --mode record \
  --port 8080 \
  --recordings-dir scripts/system-test/recordings/scenario-02 \
  --upstream https://api.groq.com/openai \
  --api-key $GROQ_API_KEY &

# 2. Configure OpenCode to use mock
cp opencode.mock.json opencode.json

# 3. Run system test
pnpm tsx scripts/system-test/run-scenario.ts --scenario 02-full-high-complexity --repo "$REPO"

# 4. Kill mock server
# Recordings saved to scripts/system-test/recordings/scenario-02/
```

**Expected Output**: Directory with JSON files, each containing:
- Request (headers, body)
- Response (status, body)
- Metadata (timestamp, index)

### Phase 2: Replay Mode (Subsequent Runs)

Run tests with mock-llm in **replay mode** for fast execution:

```bash
# 1. Start mock server in replay mode
pnpm tsx scripts/system-test/mock-llm/cli.ts \
  --mode replay \
  --port 8080 \
  --recordings-dir scripts/system-test/recordings/scenario-02 &

# 2. Configure OpenCode to use mock
cp opencode.mock.json opencode.json

# 3. Run system test (FAST - no real API calls)
pnpm tsx scripts/system-test/run-scenario.ts --scenario 02-full-high-complexity --repo "$REPO"

# 4. Kill mock server
```

### Phase 3: Update CI Workflow

Modify `.github/workflows/cody-system-test.yml` to support both modes:

```yaml
on:
  workflow_dispatch:
    inputs:
      # ... existing inputs ...
      use_mock:
        description: 'Use mock LLM (requires existing recordings)'
        type: boolean
        default: false
      recordings_dir:
        description: 'Path to recordings directory'
        type: string
        default: 'scripts/system-test/recordings/scenario-02'
```

Add conditional steps:
```yaml
- name: Start Mock LLM Server
  if: inputs.use_mock == true
  run: |
    pnpm tsx scripts/system-test/mock-llm/cli.ts \
      --mode replay \
      --port 8080 \
      --recordings-dir ${{ inputs.recordings_dir }} &

- name: Configure OpenCode
  run: |
    if [ "${{ inputs.use_mock }}" == "true" ]; then
      cp opencode.mock.json opencode.json
    else
      cp opencode.test.json opencode.json
    fi
```

## Expected Results

### Time Comparison

| Mode | LLM Calls | Expected Duration |
|------|-----------|-------------------|
| Real API (current) | ~50-100 real calls | ~90-100 min |
| Mock Replay | 0 real calls | ~10-20 min |
| **Speedup** | - | **~5-10x faster** |

### Why It's Faster
1. **No network latency**: Localhost vs Groq API round-trip
2. **No API rate limiting**: Instant responses
3. **Deterministic**: Same response every time
4. **Parallelizable**: No API quota limits

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Recordings become stale | Test fails on new prompts | Re-record periodically |
| Different issue = different calls | Replayer error | Create recordings per-scenario |
| Recording size | Storage bloat | Compress or prune old recordings |

## Implementation Steps

### Step 1: Record Baseline (Manual)
- [ ] Run mock-llm in record mode
- [ ] Execute system test with real Groq
- [ ] Save recordings to `scripts/system-test/recordings/scenario-02/`

### Step 2: Test Replay (Manual)
- [ ] Run mock-llm in replay mode
- [ ] Execute same test
- [ ] Compare durations

### Step 3: Update CI (Code Change)
- [ ] Modify `cody-system-test.yml` workflow
- [ ] Add mock mode input
- [ ] Update test execution steps

### Step 4: Documentation
- [ ] Update `scripts/system-test/mock-llm/README.md`
- [ ] Document recording/update process

## Files to Modify

1. `.github/workflows/cody-system-test.yml` - Add mock support
2. `scripts/system-test/mock-llm/README.md` - Update documentation

## Acceptance Criteria

- [ ] Mock server can record LLM calls during system test
- [ ] Mock server can replay recorded calls
- [ ] Replay mode runs significantly faster (< 20 min vs ~90 min)
- [ ] CI workflow supports both real and mock modes
- [ ] Documentation explains how to update recordings

## Next Steps

1. **Execute Phase 1** - Record baseline with current failing tests (they still make LLM calls before failing)
2. **Analyze recordings** - Understand call patterns
3. **Execute Phase 2** - Test replay with recordings
4. **Implement Phase 3** - Update CI

---

*Plan created: 2026-03-18*
