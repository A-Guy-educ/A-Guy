# Version Footer - Implementation Spec

## Overview

Display the version number from `package.json` in the site footer.

## Files to Modify

- `src/ui/web/footer/Component.tsx` - Add version display

## Implementation Steps

### 1. Read version from package.json

```typescript
import { version } from '../../../package.json'
```

### 2. Add version to footer component

Add a subtle version display element to the footer, positioned minimally (e.g., right-aligned or below copyright).

### 3. Styling

- Small, subtle text
- Lower opacity or muted color
- Consistent with existing footer styling

## Deliverable

PR with version footer implemented.
