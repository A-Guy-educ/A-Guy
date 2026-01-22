# PDF Highlighting Feature

## Overview

The PDF viewer now supports PDF.js's built-in highlight annotation feature, allowing users to highlight text in PDF documents.

## How It Works

### Annotation Editor Mode

PDF.js supports several annotation editor modes:

- `0` - None (default)
- `1` - FreeText
- `2` - Ink (drawing/pen)
- `3` - Stamp
- `13` - Highlight

The highlight mode (`annotationEditorMode=13`) is enabled by default in our PDF viewer.

### Implementation

#### 1. API Route (`src/app/api/pdfjs-viewer/route.ts`)

The PDF viewer proxy route accepts an optional `annotationEditorMode` query parameter:

```typescript
const annotationEditorModeParam = request.nextUrl.searchParams.get('annotationEditorMode')
```

This parameter is then passed through to the PDF.js viewer via the injected `window.location.search`:

```typescript
const queryParams = new URLSearchParams()
queryParams.set('file', validatedFileUrl)

if (annotationEditorModeParam) {
  queryParams.set('annotationEditorMode', annotationEditorModeParam)
}
```

#### 2. PDFMedia Component (`src/components/Media/PDFMedia/index.tsx`)

The React component that renders PDFs now includes the `annotationEditorMode=13` parameter by default:

```typescript
const viewerUrl = `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&annotationEditorMode=13&v=4.4.168`
```

This ensures all PDF viewers have highlighting enabled by default.

## Usage

### Default Behavior

All PDFs rendered through the `<PDFMedia>` component automatically have highlighting enabled.

### Manual Configuration

If you need to use the viewer directly or change the annotation mode, you can pass different values:

```typescript
// Enable highlight mode
const url = `/api/pdfjs-viewer?file=${pdfUrl}&annotationEditorMode=13`

// Enable ink/drawing mode
const url = `/api/pdfjs-viewer?file=${pdfUrl}&annotationEditorMode=2`

// Disable annotation editor
const url = `/api/pdfjs-viewer?file=${pdfUrl}&annotationEditorMode=0`
```

## User Experience

When highlighting is enabled:

1. Users see annotation toolbar buttons in the PDF viewer
2. They can select the highlight tool
3. Choose a color using the color selector
4. Adjust thickness if needed
5. Click and drag to highlight text or regions
6. Highlights are rendered as PDF.js annotations
7. Annotations persist within the PDF.js viewer session

## Browser Storage

PDF.js stores annotations in the browser's `annotationStorage`. For persistence across sessions, integration with a backend storage system would be required (not currently implemented).

## References

- PDF.js Annotation Editor: https://mozilla.github.io/pdf.js/
- PDF.js Version: 4.4.168
