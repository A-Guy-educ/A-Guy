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
- Create seed script or manual entries for 5 personas:
  - persona_strict, persona_thorough, persona_patient, persona_focused, persona_challenging
- Each with unique slug and full persona text

## Phase 2: Cookie & Anonymous Support

### 2.1 Cookie Utilities
- File: `src/utilities/cookies.ts`
- Functions:
  - `setPersonaCookie(personaSlug: string)` - Set cookie with persona
  - `getPersonaCookie()` - Get cookie value
  - `clearPersonaCookie()` - Clear on registration

### 2.2 Persona Resolution Logic
- File: `src/hooks/useTeacherPersona.ts` or similar
- Resolution order:
  1. UserPreferences.teacherPersona (if logged in)
  2. Cookie value (if valid)
  3. Fallback: persona_focused

## Phase 3: Registration Flow

### 3.1 Persona Selection Component
- File: `src/components/registration/PersonaSelection/index.tsx`
- Client Component using shadcn:
  - Card components for each persona
  - RadioGroup for selection
  - Skip button
  - Continue button
- Use next-intl for all strings

### 3.2 Registration Page Integration
- File: `src/app/(frontend)/register/page.tsx` (or relevant)
- Add persona selection step
- On continue: set cookie + save to DB if authenticated
- Handle skip: default to persona_focused

### 3.3 Server Action
- File: `src/app/actions/setPersona.ts`
- Validate persona slug exists in Prompts
- Update UserPreferences or set cookie

## Phase 4: Profile Settings

### 4.1 Persona Selector Component
- File: `src/components/profile/PersonaSelector/index.tsx`
- Client Component
- Similar to registration but in profile context
- Uses Server Action for mutation

### 4.2 Toast Confirmation
- Integrate shadcn useToast for confirmation

## Phase 5: Chat Orchestrator Integration

### 5.1 Persona Fetch Utility
- File: `src/lib/chat/getTeacherPersona.ts`
- Fetch persona content from Payload by slug
- Return formatted `<teacher_persona>` XML block

### 5.2 Orchestrator Update
- File: `src/lib/chat/orchestrator.ts` (or relevant)
- In step 1 (system prompt construction):
  - Call getTeacherPersona()
  - Append persona block to system prompt
- Exclude from memory/vector steps

### 5.3 Mid-Lesson Switching
- Ensure persona change takes effect immediately
- No lesson state reset required

## Phase 6: UI Visibility

### 6.1 Persona Label Component
- File: `src/components/chat/PersonaLabel/index.tsx`
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
- `src/utilities/cookies.ts` (or similar)
- `src/components/registration/PersonaSelection/index.tsx`
- `src/components/profile/PersonaSelector/index.tsx`
- `src/components/chat/PersonaLabel/index.tsx`
- `src/lib/chat/getTeacherPersona.ts`
- `src/app/actions/setPersona.ts`

### Modified Files
- `src/collections/Prompts/index.ts` - Add type and slug fields
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
