# PDF Download and Print Disabling Implementation

## Overview
This document describes the implementation of security features to disable PDF download and print functionality in the lesson viewer while maintaining read-only access to PDFs.

## Problem Statement
The lesson view displays PDFs using PDF.js. Previously, users could download or print PDFs via the viewer controls, which allowed uncontrolled file distribution.

## Solution
Modified the PDF.js viewer HTML rendering pipeline to inject CSS and JavaScript that disable download and print functionality while keeping PDFs readable.

## Implementation Details

### Files Modified
1. **src/lib/pdfjs/renderer.ts** - Added security features to the HTML rendering pipeline
2. **tests/unit/pdfjs-security.spec.ts** - New comprehensive test suite for security features

### Security Features

#### 1. CSS Button Hiding
Hides all download, print, and file open buttons in the PDF.js viewer toolbar:
- `#download`, `#downloadButton`
- `#print`, `#printButton`
- `#secondaryDownload`, `#secondaryPrint`
- `#openFile`, `#secondaryOpenFile`

Uses triple-layer protection:
```css
display: none !important;
visibility: hidden !important;
pointer-events: none !important;
```

#### 2. Keyboard Shortcut Prevention
Blocks Ctrl+P (Windows/Linux) and Cmd+P (Mac) keyboard shortcuts:
- Event listener in capture phase (runs before PDF.js handlers)
- Calls `preventDefault()`, `stopPropagation()`, and `stopImmediatePropagation()`
- Returns `false` for extra protection

#### 3. window.print() Override
Overrides the browser's print function to prevent programmatic printing:
```javascript
window.print = function() {
  console.warn('Printing is disabled for this document');
  return false;
};
```

#### 4. Context Menu Disabling
Prevents right-click context menu to block "Print" option:
```javascript
document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
  return false;
}, false);
```

## Testing

### Test Coverage
Created comprehensive test suite with 10 tests covering:
- Download button hiding
- Print button hiding
- Secondary button hiding
- Open file button hiding
- Keyboard shortcut disabling
- Capture phase event listener verification
- window.print() override
- Context menu disabling
- PDF viewing functionality preservation
- Viewer assets preservation

### Test Results
- ✅ All 10 security tests pass
- ✅ All 457 unit tests pass
- ✅ All 17 PDF.js integration tests pass
- ✅ TypeScript compilation successful
- ✅ ESLint checks pass (no new warnings)

## Acceptance Criteria Status

| Criteria | Status | Implementation |
|----------|--------|----------------|
| PDF.js download button is removed or disabled | ✅ Complete | CSS hiding with triple protection |
| PDF.js print button is removed or disabled | ✅ Complete | CSS hiding with triple protection |
| Keyboard shortcuts related to printing are disabled | ✅ Complete | Event listener in capture phase |
| No print dialog can be triggered from the viewer | ✅ Complete | window.print() override + context menu disable |
| PDF content is still rendered correctly | ✅ Complete | Verified via tests |

## Security Considerations

### Protection Layers
1. **CSS Layer**: Hides UI controls (display, visibility, pointer-events)
2. **JavaScript Layer**: Blocks keyboard shortcuts and function calls
3. **Event Phase**: Uses capture phase to intercept events early

### Known Limitations
This is a client-side implementation. Determined users with technical knowledge could:
- Use browser DevTools to modify the page
- Disable JavaScript and view raw PDF
- Take screenshots of the content
- Use third-party screen capture tools

For truly secure document protection, consider:
- Server-side watermarking
- DRM solutions
- Screenshot detection/prevention
- Authenticated PDF access with expiration

## Deployment Notes

### No Configuration Required
The security features are automatically applied to all PDFs viewed through the lesson viewer.

### Backward Compatibility
- ✅ No breaking changes
- ✅ Existing tests pass
- ✅ PDF viewing functionality preserved
- ✅ No changes to PDF.js version or CDN URLs

## Maintenance

### Files to Monitor
- `src/lib/pdfjs/renderer.ts` - Contains security implementation
- `tests/unit/pdfjs-security.spec.ts` - Security test suite
- `tests/int/pdfjs-viewer-route.int.spec.ts` - Integration tests

### Future PDF.js Updates
When updating PDF.js version:
1. Run security tests to verify controls still exist
2. Check if PDF.js added new download/print buttons (update CSS selectors)
3. Verify keyboard shortcuts still work the same way
4. Test on both Chrome and Safari

## References
- Issue: Disable PDF download and print in lesson viewer (PDF.js)
- PR: [Link will be added after merge]
- PDF.js Documentation: https://mozilla.github.io/pdf.js/
- Implementation Date: January 2026
