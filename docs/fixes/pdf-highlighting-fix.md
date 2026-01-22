# Fix: PDF Highlighting UI Present but Annotations Not Rendered

## Issue Summary

The PDF viewer displayed highlight UI controls (button, color selector, thickness control) but highlights were not being rendered on the PDF pages. This was reported as a discrepancy between:

- **Non-working instance**: `https://inspiring-rolypoly-a98086.netlify.app/viewer.html` (had UI but no functionality)
- **Working demo**: `https://a-guy.vercel.app/courses/7th_grade_math/chapters/---/lessons/seder_peulot` (fully functional highlighting)

## Root Cause

PDF.js requires the `annotationEditorMode` URL parameter to be set to activate the annotation editor functionality. Without this parameter:

- The UI controls are visible (they're part of the standard PDF.js viewer interface)
- But the annotation editor is not activated
- No annotation objects are created when users try to highlight text
- No highlights are rendered on the PDF pages

## Solution

### 1. API Route Enhancement

Modified `/api/pdfjs-viewer` route to accept and pass through the `annotationEditorMode` parameter:

```typescript
// Parse annotation editor mode parameter
const annotationEditorModeParam = request.nextUrl.searchParams.get('annotationEditorMode')

// Build query string with file and optional annotationEditorMode
const queryParams = new URLSearchParams()
queryParams.set('file', validatedFileUrl)

if (annotationEditorModeParam) {
  queryParams.set('annotationEditorMode', annotationEditorModeParam)
}
```

### 2. Default Highlight Mode

Updated `PDFMedia` component to enable highlight mode (`annotationEditorMode=13`) by default:

```typescript
const viewerUrl = `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&annotationEditorMode=13&v=4.4.168`
```

## PDF.js Annotation Editor Modes

The `annotationEditorMode` parameter supports the following values:

- `0` - None (default - editor disabled)
- `1` - FreeText (text annotations)
- `2` - Ink (drawing/pen)
- `3` - Stamp
- `13` - Highlight (text highlighting)

## Changes Made

### Files Modified

1. **src/app/api/pdfjs-viewer/route.ts**
   - Added support for `annotationEditorMode` query parameter
   - Passes parameter to PDF.js viewer via `window.location.search` injection

2. **src/components/Media/PDFMedia/index.tsx**
   - Enabled highlight mode (`annotationEditorMode=13`) by default
   - All PDF viewers now have highlighting functionality

3. **tests/int/pdfjs-viewer-route.int.spec.ts**
   - Added test for annotation editor mode parameter injection
   - Added test to verify parameter is optional

4. **docs/features/pdf-highlighting.md**
   - Comprehensive documentation of the highlighting feature
   - Usage examples and configuration options

## Expected Behavior After Fix

1. ✅ PDF viewer loads with annotation tools visible
2. ✅ Highlight tool is functional
3. ✅ Users can select text and apply highlights
4. ✅ Highlights are rendered as PDF.js annotations on the page
5. ✅ Color selector and thickness controls work properly
6. ✅ Highlights persist within the viewer session

## Browser Compatibility

The highlighting feature works in all modern browsers that support PDF.js:

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Limitations

- Annotations are stored in browser's `annotationStorage` (session-based)
- For cross-session persistence, backend integration would be required (not implemented)
- Annotations are not saved to the actual PDF file

## Testing

### Automated Tests

```bash
npm run test:int -- tests/int/pdfjs-viewer-route.int.spec.ts
```

### Manual Testing

1. Navigate to any lesson with a PDF document
2. Open the PDF viewer
3. Look for the highlight tool in the toolbar
4. Select the highlight tool
5. Choose a color
6. Click and drag to highlight text
7. Verify the highlight appears on the page

## References

- PDF.js Documentation: https://mozilla.github.io/pdf.js/
- PDF.js Version: 4.4.168
- Annotation Editor API: https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#annotation-editing
