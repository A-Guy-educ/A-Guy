# Teacher Persona Selection - Implementation Plan

## Phase 1: Data Model

### 1.1 Update Prompts Collection
- File: `src/collections/Prompts/index.ts`
- Add `type: select` field with options: `system`, `user`, `persona`
- Add `slug: text` field (unique: true, index: true)
- Add admin hooks to filter by type in list view
- Run `generate:types`

### 1.2 Create UserPreferences Collection
- File: `src/collections/UserPreferences/index.ts`
- Fields:
  - `user`: relationship to `users` (1:1, required)
  - `teacherPersona`: relationship to `prompts` (filtered: type=persona)
- Access control:
  - read: admin OR user equals current user
  - create: admin only
  - update: admin OR user equals current user
  - delete: admin only
- Run `generate:types`

### 1.3 Seed Personas
- File: `src/seed/personas.ts`
- Create a dedicated seed script for 5 personas:
  - persona_strict, persona_thorough, persona_patient, persona_focused, persona_challenging
- Each with unique slug and full persona text

### 1.4 Update Payload Config
- File: `payload.config.ts`
- Register `UserPreferences` collection

## Phase 2: Cookie & Anonymous Support

### 2.1 Cookie Utilities
- File: `src/utilities/cookies.ts`
- Functions:
  - `setPersonaCookie(personaSlug: string)` - Set short-lived cookie with persona
  - `getPersonaCookie()` - Get cookie value
  - `clearPersonaCookie()` - Clear on registration

### 2.2 Persona Resolution Logic
- File: `src/hooks/useTeacherPersona.ts`
- Resolution order:
  1. UserPreferences.teacherPersona (if logged in)
  2. Cookie value (if valid)
  3. Fallback: persona_focused

## Phase 3: Registration Flow

### 3.1 Persona Selection Component
- File: `src/ui/web/registration/PersonaSelection/index.tsx`
- Client Component using shadcn:
  - Card components for each persona
  - RadioGroup for selection
  - Skip button
  - Continue button
- Use next-intl for all strings

### 3.2 Registration Page Integration
- File: `src/app/(frontend)/register/page.tsx` (or relevant)
- Add persona selection step
- On continue (standard or OAuth registration):
   - If an anonymous persona cookie exists, migrate its value to `UserPreferences.teacherPersona` for the newly registered user.
   - If no cookie exists or user skips, default to `persona_focused`.
   - Create or update `UserPreferences.teacherPersona` for the new user in the DB.
   - Clear the anonymous persona cookie.

### 3.3 Server Action
- File: `src/app/actions/setPersona.ts`
- Validates persona slug and user authentication.
- Creates or updates `UserPreferences` record for the logged-in user or sets a cookie for anonymous users.

## Phase 4: Profile Settings

### 4.1 Persona Selector Component
- File: `src/ui/web/profile/PersonaSelector/index.tsx`
- Client Component
- Similar to registration but in profile context
- Uses Server Action for mutation

### 4.2 Toast Confirmation
- Integrate shadcn useToast for confirmation

## Phase 5: Chat Orchestrator Integration

### 5.1 Persona Fetch Utility
- File: `src/lib/chat/getTeacherPersona.ts`
- Uses Persona Resolution Logic (Phase 2.2) to determine the active persona.
- Fetches the resolved persona content from Payload by slug.
- Returns formatted `<teacher_persona>` XML block.

### 5.2 Orchestrator Update
- File: `src/lib/chat/orchestrator.ts` (or relevant)
- In step 1 (system prompt construction):
  - Call getTeacherPersona()
  - Append persona block to system prompt, ensuring existing `UnifiedLLMProvider` and `AI_MODELS` are used for prompt injection.
- Exclude from memory/vector steps

### 5.3 Mid-Lesson Switching
- Ensure persona change takes effect immediately
- No lesson state reset required

## Phase 6: UI Visibility

### 6.1 Persona Label Component
- File: `src/ui/web/chat/PersonaLabel/index.tsx`
- Display current persona name near chat
- Use next-intl for translations

### 6.2 i18n Strings
- Add to `messages/en.json` and `messages/he.json`:
  - Persona names
  - Selection labels
  - Toast messages

## Files to Create/Modify

### New Files
- `src/collections/UserPreferences/index.ts`
- `src/utilities/cookies.ts`
- `src/seed/personas.ts`
- `src/ui/web/registration/PersonaSelection/index.tsx`
- `src/ui/web/profile/PersonaSelector/index.tsx`
- `src/ui/web/chat/PersonaLabel/index.tsx`
- `src/lib/chat/getTeacherPersona.ts`
- `src/app/actions/setPersona.ts`

### Modified Files
- `src/collections/Prompts/index.ts` - Add type and slug fields
- `payload.config.ts` - Register new collection
- `src/app/(frontend)/register/page.tsx` - Add persona selection
- `src/app/(frontend)/profile/page.tsx` - Add persona setting
- `src/lib/chat/orchestrator.ts` - Inject persona into prompt
- `messages/en.json` - Add i18n strings
- `messages/he.json` - Add i18n strings

## Testing Checklist
- [ ] UserPreferences CRUD operations work
- [ ] Prompts persona filtering works
- [ ] Cookie persists across refresh
- [ ] Cookie survives OAuth redirect
- [ ] Registration persona selection UI works
- [ ] Skip defaults to persona_focused
- [ ] Profile persona change works with toast
- [ ] Persona injected in chat prompt
- [ ] Persona excluded from memory/vector
- [ ] Mid-lesson persona switch takes effect
- [ ] Persona label displays correctly
- [ ] All 5 personas have distinct behavior
