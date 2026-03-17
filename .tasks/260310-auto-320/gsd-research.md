# GSD Research Report - Task 260310-auto-320

## Codebase Analysis

### Current Role System
- **Current roles**: Only `Admin` and `Student` exist in `src/infra/auth/roles.ts` (AccountRole enum)
- **Role storage**: Users collection stores role in `role` field with `saveToJWT: true` for fast access
- **Access patterns**: Role-based access control using helper functions like `isAdmin()`, `authenticated`, `adminOnly`
- **Hebrew labels**: ACCOUNT_ROLE_LABEL provides UI display names

**Based on clarified requirements**: Advanced Content Editor role is NOT needed - feature should be open to everyone

### Exercise Content Structure
- **Storage**: Exercises use `content` field (type: 'json') with Zod validation via `ContentSchema`
- **Block types**: 11+ block types including rich_text, question_select, question_free_response, etc.
- **Validation**: Strict Zod schemas in `src/server/payload/collections/Exercises/schemas.ts`
- **Editor component**: `ExerciseContentEditor` at `src/ui/admin/ExerciseContentEditor/index.tsx`
- **JSON inspector**: Existing `JSONInspector` component with edit capabilities, but no access control

### Pages Content Structure  
- **Storage**: Pages use native `layout` field (type: 'blocks') with predefined block types
- **Block types**: CallToAction, Content, Archive, FormBlock, HtmlBlock
- **Different pattern**: Uses Payload's native blocks system vs Exercises' custom JSON field

### Security & API Patterns
- **API wrapper**: `withApiHandler` provides authentication, validation, error handling
- **Auth levels**: 'admin', 'adminOrTest', 'authenticated', 'public'
- **Access control**: Server-side enforcement with `overrideAccess: false` pattern
- **Input validation**: Zod schemas for request/response validation
- **Error handling**: Structured error responses with proper HTTP status codes

### Structure Validation Patterns
- **Zod schemas**: Comprehensive validation for exercise content blocks
- **Discriminated unions**: Block types validated by 'type' discriminator
- **Custom validation**: Structure invariance can be enforced via Zod refinements
- **ID preservation**: Block IDs and structure keys are protected in schemas

## Files to Modify

### Core Implementation Files
1. **`src/ui/admin/ExerciseContentEditor/JSONInspector.tsx`**
   - Add access control check (removed from original spec per clarification)
   - Add structure invariance validation before save
   - Enhance error messaging for structural changes

2. **`src/ui/admin/ExerciseContentEditor/index.tsx`**  
   - Remove role-gating logic (per clarification)
   - Ensure JSONInspector integration works properly

3. **`src/server/payload/collections/Exercises/schemas.ts`**
   - Add structure validation utilities
   - Create helper functions for deep structure comparison

### API Endpoint (New)
4. **`src/app/api/exercises/[id]/blocks/[blockId]/route.ts`** (new)
   - PATCH endpoint for single block updates
   - Structure invariance validation
   - Authentication and authorization
   - Audit logging capability

### Validation Utilities (New)
5. **`src/server/services/exercise-validation/structure-validator.ts`** (new)
   - Block structure comparison logic
   - Key preservation validation  
   - Array length preservation checks

### Type Definitions (Update)
6. **`src/server/payload/collections/Exercises/types.ts`**
   - Add structure validation types if needed

## Dependencies

### External Dependencies
- **Zod**: Already used for validation, good foundation for structure checks
- **Payload Local API**: For secure database operations with access control
- **React state management**: JSONInspector already manages edit state properly

### Internal Dependencies  
- **Access control system**: Uses existing authenticated/admin patterns (no role gating needed)
- **Exercise content validation**: Builds on existing Zod schemas
- **API security patterns**: Uses established `withApiHandler` pattern
- **Error handling**: Integrates with existing error response patterns

### Integration Points
- **JSONInspector ↔ ExerciseContentEditor**: Already integrated, needs enhancement
- **Client validation ↔ Server validation**: Must align for structure invariance
- **Block editing ↔ Form state**: Must preserve form isolation per spec requirements

## Technical Constraints

### Structure Invariance Challenges
- **Deep comparison**: Need efficient algorithm to compare nested JSON structures
- **Key preservation**: Must prevent any key additions/deletions/renames at any depth
- **Array length**: Must prevent array element additions/removals/reorders
- **Reserved fields**: Block `id` and `type` fields must be immutable

### Payload CMS Limitations
- **Local API access**: Must use `overrideAccess: false` when user context provided
- **Transaction boundaries**: Hook operations must pass `req` for atomicity
- **Validation timing**: Structure checks must happen before Zod schema validation

### Performance Considerations
- **JSON comparison**: Structure validation on large blocks could be expensive
- **Form reactivity**: Must avoid triggering form re-renders during JSON editing
- **Validation frequency**: Real-time validation vs on-apply validation trade-offs

### Security Constraints
- **Prototype pollution**: Must sanitize JSON inputs for dangerous keys
- **Mass assignment**: Server must only update targeted block, never whole document
- **Access logging**: Audit trail for successful edits per spec requirements

## Recommendations

### Implementation Approach
1. **Start with JSONInspector enhancement**: Add structure validation before apply
2. **Create structure validator service**: Reusable for both client and server
3. **Add dedicated API endpoint**: Single block PATCH with full server-side validation  
4. **Remove role requirements**: Make feature available to all authenticated users per clarification

### Structure Validation Strategy
```typescript
// Recommended validation approach
function validateStructuralInvariance(original: ContentBlock, edited: ContentBlock): ValidationResult {
  // 1. Compare keys at all levels (no additions/deletions/renames)
  // 2. Validate array lengths unchanged
  // 3. Preserve block metadata (id, type)
  // 4. Allow only value changes within existing structure
}
```

### Security Implementation
- **Server-side enforcement**: Never trust client-side validation alone
- **Block-scoped updates**: API only accepts single block updates by ID
- **Audit logging**: Log successful structure changes with before/after diffs
- **Input sanitization**: Strip prototype pollution keys before processing

### UX Considerations
- **Clear error messages**: Distinguish JSON syntax vs structure errors
- **Path highlighting**: Show specific JSON paths that violate structure rules
- **Cancel behavior**: Revert to last saved state on invalid cancel per spec
- **Form isolation**: Prevent JSON edits from affecting parent form state

### Testing Strategy
- **Structure validation**: Unit tests for all edge cases (nested objects, arrays, mixed types)
- **Access control**: Integration tests with different user roles (though all can access now)
- **API security**: Test malicious inputs, prototype pollution, mass assignment attempts
- **Form isolation**: E2E tests confirming no state leakage to parent form

