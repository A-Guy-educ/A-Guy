# PDF.js Highlighting Fix - Manual Verification Guide

## Overview
This fix enables PDF.js annotation editor mode for highlighting by adding the `annotationEditorMode` parameter to the viewer API.

## Root Cause
The PDF.js viewer UI displays the highlight tool button, but clicking and dragging doesn't create visible highlights because:
1. The annotation editor mode was not being initialized
2. No URL parameter was being passed to enable the editor mode
3. The viewer needed a script to dispatch the `switchannotationeditormode` event

## Solution
Added support for `annotationEditorMode` query parameter with:
- Security validation (allowlist of valid modes)
- JavaScript injection to enable annotation mode on viewer load
- Default highlight mode (15) enabled in PDFMedia component

## Manual Verification Steps

### 1. Start the Development Server
```bash
pnpm dev
```

### 2. Test Highlighting Directly via API

#### A. With Highlighting Enabled (Default)
Navigate to:
```
http://localhost:3000/api/pdfjs-viewer?file=/media/sample.pdf&annotationEditorMode=15
```

**Expected:**
- PDF loads in the viewer
- View the page source and verify it contains:
  - `switchannotationeditormode` in a script tag
  - `mode: 15` in that script
- The highlight tool should be available in the PDF.js toolbar

#### B. Without Highlighting (Default Mode)
Navigate to:
```
http://localhost:3000/api/pdfjs-viewer?file=/media/sample.pdf
```

**Expected:**
- PDF loads normally
- Page source does NOT contain `switchannotationeditormode`
- Standard PDF viewer without annotation tools

### 3. Test via Lesson Page

Navigate to a lesson with a PDF:
```
http://localhost:3000/courses/[course]/chapters/[chapter]/lessons/[lesson]
```

**Expected:**
- PDF loads with highlighting enabled by default
- The highlight tool (if visible in toolbar) should be functional
- Dragging over text should create highlight annotations

### 4. Test Security Validation

#### A. Invalid Mode Value (Should Fail)
Navigate to:
```
http://localhost:3000/api/pdfjs-viewer?file=/media/sample.pdf&annotationEditorMode=999
```

**Expected:**
- HTTP 400 error
- JSON response: `{"error":"Invalid annotation mode","details":"Invalid annotation mode: 999 not in allowed list"}`

#### B. Non-Numeric Mode (Should Fail)
Navigate to:
```
http://localhost:3000/api/pdfjs-viewer?file=/media/sample.pdf&annotationEditorMode=invalid
```

**Expected:**
- HTTP 400 error
- JSON response: `{"error":"Invalid annotation mode","details":"Invalid annotation mode: must be a number"}`

### 5. Test Other Annotation Modes

Try different annotation modes:

- **Mode 0** (None/Disabled): `annotationEditorMode=0` - No annotation tools
- **Mode 1** (Free Text): `annotationEditorMode=1` - Text annotation tool
- **Mode 2** (Ink/Drawing): `annotationEditorMode=2` - Drawing tool
- **Mode 3** (Stamp): `annotationEditorMode=3` - Stamp tool
- **Mode 15** (Highlight): `annotationEditorMode=15` - Highlight tool (our fix)

## Browser Testing

Test in multiple browsers to ensure compatibility:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (macOS)
- [ ] Edge

## What to Look For

### Visual Indicators
1. **Toolbar**: PDF.js annotation toolbar should be visible with highlight tool
2. **Cursor**: Should change to highlight mode when tool is active
3. **Highlights**: Dragging over text should create visible yellow/colored highlights
4. **Persistence**: Highlights should persist (client-side only, not saved to server)

### Console Logs
Check browser console for:
- No JavaScript errors
- PDF.js initialization messages
- Annotation mode activation (if PDF.js has debug logging)

### Network Tab
Check network requests for:
- Successful load of viewer HTML (200 status)
- Correct `annotationEditorMode` parameter in URL
- All PDF.js assets loaded successfully

## Known Limitations

1. **No Backend Persistence**: Highlights are client-side only and not saved to the server
2. **PDF.js Version**: Requires PDF.js 4.4.168 with annotation editor support
3. **Browser Support**: Annotation features may vary by browser/PDF.js version

## Rollback Plan

If issues occur, highlighting can be disabled by:
1. Remove `&annotationEditorMode=15` from PDFMedia component (line 51)
2. Or set `annotationEditorMode=0` to explicitly disable

## Success Criteria

✅ Integration tests pass (23/23)
✅ Highlight mode parameter is validated and injected
✅ Security validation rejects invalid modes
✅ Manual testing shows highlights are rendered
✅ No regressions in normal PDF viewing

## Comparison URLs

- **Non-working (before fix)**: The Netlify deployment without annotation mode
- **Working (after fix)**: Local dev server with `annotationEditorMode=15`
- **Reference**: https://a-guy.vercel.app/courses/7th_grade_math/chapters/---/lessons/seder_peulot
