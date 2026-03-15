# Task

## Issue Title

מסמך PDF לא נפתח בשעורים מסויימים
# 🐞 Bug Report

## 1. Title
מסמך PDF לא נפתח בשעורים מסויימים 

## 2. Environment
- Environment: prod
- Browser / Device: Chrome
- User Role / Tenant: Student

## 3. Preconditions
concolelog:
viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs:12788 Invalid or corrupted PDF file.

PDF.js v4.4.168 (build: 19fbc8998)
Message: Invalid PDF structure.
_otherError @ viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs:12788
await in _otherError
_documentError @ viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs:12765
(anonymous) @ viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs:12713
Promise.then
open @ viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs:12699
run @ viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs:12503
await in run
webViewerLoad @ viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs:14493
(anonymous) @ viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs:14497Understand this error
pdf.mjs:455 Uncaught (in promise) InvalidPDFException {message: 'Invalid PDF structure.', name: 'InvalidPDFException', stack: 'Error\n    at BaseExceptionClosure (https://96hg0ck…cel-storage.com/pdfjs/4.4.168/build/pdf.mjs:458:2'}
BaseExceptionClosure @ pdf.mjs:455
(anonymous) @ pdf.mjs:458Understand this error
1090-05a72dca955bae6d.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1 [Analytics] Validation failed (production mode - continuing): {event: 'pdf_viewed', issues: Array(1)}
(anonymous) @ 1090-05a72dca955bae6d.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
track @ 1090-05a72dca955bae6d.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
(anonymous) @ 6048-c8a47b8a6d5574c2.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
(anonymous) @ 6048-c8a47b8a6d5574c2.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
emit @ 3350-4aa595bc1d932583.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
(anonymous) @ page-e969210e3b10b134.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
o1 @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1Understand this warning
6048-c8a47b8a6d5574c2.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1 [Analytics] Subscriber already initialized, skipping
h @ 6048-c8a47b8a6d5574c2.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
(anonymous) @ 6048-c8a47b8a6d5574c2.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
o1 @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ux @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
uE @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
i_ @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
iT @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
iG @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
iW @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
iN @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
iz @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
ii @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
iu @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
iX @ 48b819ea-856c115c92149f24.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1
w @ 1914-864039186617ff7b.js?dpl=dpl_8jeGifntVjMDqW6cETbsS2ZRToCu:1Understand this warning
mixpanel-2-latest.min.js:34 Mixpanel error: Unknown persistence type localStorage+cookie; falling back to cookie

## 4. Steps to Reproduce
https://www.aguy.co.il/courses/----4----471/chapters/471/lessons/471-2025-winter



## 5. Expected Result
להופיע מסמך ה-PDF  

## 6. Actual Result
החלק שאמור להופיע ה-PDF נפתח, אבל PDF לא עולה, אבל מראה שזה טוען אבל לא מסיים

## 7. Reproducibility
sometimes


---
_Created by @korenguy123 via Cody dashboard_
