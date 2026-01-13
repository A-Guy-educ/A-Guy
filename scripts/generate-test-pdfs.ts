/**
 * Generate test PDF fixtures for PDF extraction tests
 * Creates minimal valid PDF files
 */
import { writeFileSync } from 'fs'
import { join } from 'path'
import { mkdirSync } from 'fs'

const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures', 'pdfs')

// Ensure directory exists
mkdirSync(FIXTURES_DIR, { recursive: true })

// Minimal valid PDF structure
// PDF format: Header, Body, Cross-reference table, Trailer

// Sample lesson PDF (~2000 chars, single chunk)
const sampleLessonPDF = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
100 700 Td
(This is a sample lesson PDF. It contains educational content for testing PDF extraction. The text should be extracted correctly by the PDF parser. This document is used in integration tests to verify that PDF text extraction works as expected. The content is simple and straightforward, making it easy to verify extraction accuracy.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000316 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
516
%%EOF`

// Long lesson PDF (~10000 chars, multiple chunks)
// Create a longer text string with actual sentences
const longText = Array.from({ length: 300 }, (_, i) =>
  `This is sentence ${i + 1} of a long lesson PDF. It contains educational content for testing PDF extraction with multiple chunks. The text should be extracted and chunked correctly by the PDF parser. `.repeat(
    2,
  ),
).join('')

// Calculate approximate length for PDF structure
const textLength = longText.length
const longLessonPDF = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length ${textLength + 100}
>>
stream
BT
/F1 12 Tf
100 700 Td
(${longText}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000316 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${316 + textLength + 100}
%%EOF`

// Empty PDF (no text content)
const emptyPDF = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 0
>>
stream
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000316 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
316
%%EOF`

// Corrupted PDF (invalid structure)
const corruptedPDF = `%PDF-1.4
This is not a valid PDF structure.
Invalid content that will cause parsing errors.
<<< Broken PDF format >>>
%%EOF`

writeFileSync(join(FIXTURES_DIR, 'sample-lesson.pdf'), sampleLessonPDF)
writeFileSync(join(FIXTURES_DIR, 'long-lesson.pdf'), longLessonPDF)
writeFileSync(join(FIXTURES_DIR, 'empty.pdf'), emptyPDF)
writeFileSync(join(FIXTURES_DIR, 'corrupted.pdf'), corruptedPDF)

console.log('✅ Test PDF fixtures generated successfully')
