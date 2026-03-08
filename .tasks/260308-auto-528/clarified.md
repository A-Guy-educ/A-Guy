# Clarified

formula sheet collection doesnt existes yet, create it.
Existing PDF Viewer Components a. PDFMedia (Frontend)
Location: src/ui/web/media/PDFMedia/index.tsx
Uses: iframe loading PDF.js viewer via /api/pdfjs-viewer proxy
For: Public/student-facing pages b. PDFPreview (Admin)
Location: src/ui/admin/MediaPreview/PDFPreview.tsx
Uses: Dynamically imports PDFMedia with ssr: false
For: Admin media preview
ChatInterface is the main component used in lessons. Adding Toolbar Above Chat Input In ChatInterface/index.tsx, find the input container and add a toolbar div that will sit above the input
