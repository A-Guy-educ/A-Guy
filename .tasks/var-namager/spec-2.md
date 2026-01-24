Task: Runtime Config Loader (DB → Memory, Server-Side Only)
Goal

Add a runtime-only loading mechanism that reads configuration entries (variables + secrets) from the database into memory after Payload has bootstrapped, with explicit rules for precedence and lifecycle.
This task does not modify the Config Manager CRUD, encryption, or audit logic.

Scope
Included

Server-side loader that reads from ConfigEntries

In-memory cache (process-level)

Explicit load timing (after DB is ready)

Explicit access API for server code

Tests for correctness and safety

Excluded (explicit non-goals)

No admin UI changes

No encryption logic changes

No key rotation

No client-side exposure

No auto-reload/watch on DB changes (manual reload only in v1)

Design Decisions (Must Follow)

1. Load Timing

Config is loaded only after Payload is fully initialized

No reads during payload.config.ts or build time

Loader is triggered explicitly (e.g. on server start hook or first access)

2. Memory Model

In-memory singleton per Node process

Shape:

type RuntimeConfig = {
variables: Record<string, string>
secrets: Record<string, string> // decrypted
}

3. Precedence Rule

When resolving a key:

process.env[KEY] (hard override)

In-memory config loaded from DB

If missing → throw explicit error

Env always wins. This allows emergency overrides without touching DB.

API Surface (Required)
Public Server API
loadRuntimeConfig(): Promise<void>
getVariable(key: string): string
getSecret(key: string): string

Rules:

loadRuntimeConfig must be idempotent

get\* must throw if called before load

getSecret never logs or returns ciphertext

Internal Behavior

loadRuntimeConfig:

queries ConfigEntries where enabled=true

decrypts secrets

stores results in memory

No caching TTL. Reload only by explicit call.

Safety & Guardrails

Loader must never run on client

Secrets must never be logged (even in debug)

Errors must be explicit:

“Config not loaded”

“Missing required secret: X”

Loader must fail fast if DB is unreachable

Tests (Required)
Unit

loadRuntimeConfig populates memory correctly

env override beats DB value

secrets are decrypted

calling getSecret before load throws

Integration

With real Payload test harness:

create variable + secret in DB

call loadRuntimeConfig

getVariable / getSecret return correct values

Disabled entries are ignored

No value leakage to logs or responses

File Placement (Suggested)
src/lib/config/runtime/
├── runtime-config.ts # loader + getters
└── runtime-config.spec.ts # unit tests

Definition of Done

Config Manager remains unchanged

Runtime loader works server-side only

Env override works

Tests pass in CI

No secret leakage
