# PDF Highlighting - Technical Flow Diagram

## Before Fix (Non-Working)

```
User Action: Click highlight tool
    ↓
PDF Viewer UI: Shows highlight controls
    ↓
URL: /api/pdfjs-viewer?file=/media/doc.pdf
    ↓
window.location.search: "?file=/media/doc.pdf"
    ↓
PDF.js Initialization:
  - annotationEditorMode: undefined (defaults to 0 = disabled)
  - UI controls visible but inactive
    ↓
User tries to highlight text
    ↓
❌ NO ANNOTATION OBJECT CREATED
❌ NO HIGHLIGHT RENDERED
```

## After Fix (Working)

```
User Action: Click highlight tool
    ↓
PDF Viewer UI: Shows highlight controls
    ↓
PDFMedia Component:
  viewerUrl = /api/pdfjs-viewer?file=/media/doc.pdf&annotationEditorMode=13
    ↓
API Route (/api/pdfjs-viewer):
  1. Parse parameters:
     - file: /media/doc.pdf
     - annotationEditorMode: 13
  2. Build query string:
     - file=/media/doc.pdf&annotationEditorMode=13
  3. Inject into HTML:
     - window.location.search = "?file=/media/doc.pdf&annotationEditorMode=13"
    ↓
PDF.js Initialization:
  - annotationEditorMode: 13 (HIGHLIGHT mode enabled)
  - Annotation editor activated
  - Event listeners registered
    ↓
User tries to highlight text
    ↓
✅ PDF.js creates annotation object
✅ Highlight rendered on page
✅ Stored in annotationStorage
✅ Visible to user
```

## Parameter Flow

```
┌─────────────────────────────────────────────────────────┐
│  PDFMedia Component                                      │
│  src/components/Media/PDFMedia/index.tsx                │
├─────────────────────────────────────────────────────────┤
│  Sets default: annotationEditorMode=13                   │
│  URL: /api/pdfjs-viewer?file=X&annotationEditorMode=13  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  API Route                                               │
│  src/app/api/pdfjs-viewer/route.ts                      │
├─────────────────────────────────────────────────────────┤
│  1. Extract: request.nextUrl.searchParams.get()         │
│  2. Validate: file parameter                            │
│  3. Build query: URLSearchParams                        │
│  4. Inject: window.location.search override             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Viewer HTML (served to browser)                        │
├─────────────────────────────────────────────────────────┤
│  <script>                                                │
│    Object.defineProperty(window.location, 'search', {   │
│      get: () => '?file=X&annotationEditorMode=13'      │
│    })                                                    │
│  </script>                                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  PDF.js viewer.mjs                                       │
│  (loaded from CDN)                                       │
├─────────────────────────────────────────────────────────┤
│  1. Reads: window.location.search                       │
│  2. Parses: URLSearchParams                             │
│  3. Gets: annotationEditorMode = 13                     │
│  4. Initializes: AnnotationEditorLayer                  │
│  5. Enables: Highlight mode                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  User Experience                                         │
├─────────────────────────────────────────────────────────┤
│  ✅ Highlight tool active                               │
│  ✅ Color picker works                                  │
│  ✅ Text selection creates highlights                   │
│  ✅ Annotations rendered on page                        │
│  ✅ Stored in annotationStorage                         │
└─────────────────────────────────────────────────────────┘
```

## Annotation Editor Mode Values

| Value | Mode      | Description                    |
|-------|-----------|--------------------------------|
| 0     | None      | Editor disabled (default)      |
| 1     | FreeText  | Text annotations               |
| 2     | Ink       | Drawing/pen mode               |
| 3     | Stamp     | Stamp annotations              |
| 13    | Highlight | Text highlighting (our use)    |

## Code Locations

### 1. Parameter Parsing
File: `src/app/api/pdfjs-viewer/route.ts`
```typescript
const annotationEditorModeParam = request.nextUrl.searchParams.get('annotationEditorMode')
```

### 2. Parameter Injection
File: `src/app/api/pdfjs-viewer/route.ts`
```typescript
const queryParams = new URLSearchParams()
queryParams.set('file', validatedFileUrl)
if (annotationEditorModeParam) {
  queryParams.set('annotationEditorMode', annotationEditorModeParam)
}
```

### 3. Default Mode Setting
File: `src/components/Media/PDFMedia/index.tsx`
```typescript
const viewerUrl = `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&annotationEditorMode=13&v=4.4.168`
```

## Security Considerations

✅ **Safe**: The `annotationEditorMode` parameter is a numeric value
✅ **Validated**: PDF.js validates the value internally
✅ **No XSS Risk**: Parameter is URL-encoded and not executed as code
✅ **Same Security Model**: Uses same validation as file parameter

## Browser Storage

```
┌──────────────────────────────────────┐
│  Browser                              │
│  ┌────────────────────────────────┐  │
│  │  PDF.js annotationStorage      │  │
│  │  (in-memory)                   │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │  Annotation 1: Highlight │  │  │
│  │  │  - pageIndex: 0          │  │  │
│  │  │  - color: yellow         │  │  │
│  │  │  - rect: [x, y, w, h]   │  │  │
│  │  └──────────────────────────┘  │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │  Annotation 2: Highlight │  │  │
│  │  │  - pageIndex: 1          │  │  │
│  │  │  - color: green          │  │  │
│  │  │  - rect: [x, y, w, h]   │  │  │
│  │  └──────────────────────────┘  │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘

Note: Annotations persist only during the current session.
For cross-session persistence, backend integration needed.
```
