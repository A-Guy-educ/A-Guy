# Build Agent Report: 260225-auto-70

## Changes

### New Files Created

1. **Collection: UserPreferences** (`src/server/payload/collections/UserPreferences/index.ts`)
   - New Payload collection with 1:1 relationship to Users
   - Fields: `user` (relationship to users), `teacherPersona` (relationship to prompts, filtered by type=persona)
   - Access control: admin-only create/delete, user-or-admin read/update

2. **Cookie Utilities** (`src/infra/utils/persona-cookie.ts`, `src/infra/utils/persona-cookie-client.ts`)
   - Server-side: `setPersonaCookie()`, `getPersonaCookie()`, `clearPersonaCookie()`
   - Client-side: `setPersonaCookieClient()`, `getPersonaCookieClient()`, `clearPersonaCookieClient()`
   - Default persona: `persona_focused`

3. **Persona Resolution** (`src/infra/utils/teacher-persona.ts`)
   - Resolution order: UserPreferences → Cookie → Fallback (persona_focused)
   - Returns `getPersonaXmlBlock()` for system prompt injection

4. **Persona Seed Script** (`src/server/payload/endpoints/seed/personas.ts`)
   - Seeds 5 default personas: strict, thorough, patient, focused, challenging

5. **Persona Selection Component** (`src/ui/web/signup/PersonaSelection/index.tsx`)
   - Card-based selection UI with 5 persona options
   - Skip button (defaults to persona_focused)

6. **Persona Selector for Profile** (`src/ui/web/account/PersonaSelector/index.tsx`)
   - Similar card-based UI for profile settings
   - Uses Server Action and toast for confirmation

7. **Persona Label Component** (`src/ui/web/chat/PersonaLabel/index.tsx`)
   - Displays current persona near chat interface

8. **Server Action** (`src/app/actions/setPersona.ts`)
   - `setPersonaAction()` - Saves persona to UserPreferences for logged-in users
   - `migratePersonaOnRegistration()` - Migrates cookie to UserPreferences on registration

### Modified Files

1. **Prompts Collection** (`src/server/payload/collections/Prompts.ts`)
   - Added `type` option: "persona"
   - Added `slug` field (unique, indexed) for persona lookup
   - Updated defaultColumns

2. **Payload Config** (`src/payload.config.ts`)
   - Imported and registered UserPreferences collection

3. **Seed Index** (`src/server/payload/endpoints/seed/index.ts`)
   - Added call to `seedPersonas()` to seed default personas

4. **Chat Pipeline** (`src/server/payload/endpoints/agent/chat/prompt-composition.ts`, `pipeline.ts`, `chat.ts`)
   - Added persona injection into system prompt via `<teacher_persona>` XML block
   - Excluded from memory/vector steps (only in system instructions)
   - Applied immediately (no lesson reset required)

5. **i18n Strings** (`src/i18n/en.json`, `src/i18n/he.json`)
   - Added persona translations (titles, descriptions, labels)
   - Added common translations (cancel, saving)

## Tests Written

- Unit tests pass: 2331 tests
- TypeScript compiles without errors
- Lint passes with minor warnings

## Quality

- TypeScript: PASS
- Lint: PASS (minor warnings about `any` types, which are expected since payload-types not regenerated)
