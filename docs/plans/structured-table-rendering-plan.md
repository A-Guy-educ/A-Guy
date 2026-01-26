# Low-Level Plan: Structured Table Rendering in Chat (Revised)

This document outlines the technical implementation steps required to render structured tables in the chat interface, based on the provided High-Level Specification (HLS). This revision addresses gaps identified in the initial plan.

## Phase 1: Data Model and Type Definitions

**Objective:** Establish the core data structures for tables in TypeScript, allowing for rich content in headers.

1.  **Create/Update Type Definition File:**
    *   **File:** `src/infra/llm/table-types.ts`
    *   **Action:** Add the following TypeScript interfaces. Note that `headers` now uses `ChatTableCell` to support math and directional text.

    ```typescript
    // src/infra/llm/table-types.ts

    /**
     * Represents a single cell in a table, used for both headers and body cells.
     */
    export interface ChatTableCell {
      content: string;
      // Direction is authoritative. 'auto' is resolved by the UI, but math is always 'ltr'.
      direction: 'rtl' | 'ltr' | 'auto';
      containsMath: boolean;
    }

    /**
     * Defines the structure for a table to be rendered in chat.
     */
    export interface ChatTableModel {
      headers: ChatTableCell[];
      rows: Array<Array<ChatTableCell>>;
    }

    /**
     * Type for raw message content when the LLM explicitly returns a table schema.
     */
    export interface ExplicitTableContent {
      type: 'table';
      data: {
        headers: string[];
        rows: Array<string[]>; // Raw rows from LLM are strings
      };
    }
    ```

## Phase 2: Table Detection and Normalization

**Objective:** Create utility functions to identify and parse both explicit and implicit table data from incoming messages.

1.  **Create Detection & Parser Utilities:**
    *   **File:** `src/infra/llm/table-parser.ts`
    *   **Action:** Implement the following functions.

    ```typescript
    // src/infra/llm/table-parser.ts

    import { ChatTableModel, ChatTableCell, ExplicitTableContent } from './table-types';

    // Rule: Detects LaTeX blocks ($...$, $$...$$, \(...\), \[...\]) to qualify as math.
    const MATH_REGEX = /(?:\\\[.*?\\\]|\\\(.*?\\\)|\\$.*?\\$)/;
    const MARKDOWN_TABLE_REGEX = /^\s*\|.+\|\s*$/m;
    // Rule: Conservatively detects implicit tables like "Step / Reason" or "Claim: Explanation".
    const IMPLICIT_TABLE_REGEX = /^(?:[^\n\r|]+[ /:]{1}[^\n\r|]+)(?:\r?\n|$)/;
    const IMPLICIT_DELIMITER_REGEX = /[ /:]/;

    export function isExplicitTable(content: any): content is ExplicitTableContent {
      return content && content.type === 'table' && content.data && Array.isArray(content.data.rows);
    }

    export function isMarkdownTable(content: string): boolean {
        return typeof content === 'string' && MARKDOWN_TABLE_REGEX.test(content);
    }

    export function isImplicitTable(content: string): boolean {
        // Must not be a markdown table and should match the implicit pattern.
        return typeof content === 'string' && !isMarkdownTable(content) && IMPLICIT_TABLE_REGEX.test(content);
    }

    export function isTableMessage(content: any): boolean {
      if (typeof content === 'object') return isExplicitTable(content);
      if (typeof content === 'string') return isMarkdownTable(content) || isImplicitTable(content);
      return false;
    }

    export function normalizeToTableModel(content: any): ChatTableModel {
        if (isExplicitTable(content)) return normalizeFromJson(content);
        if (isMarkdownTable(content as string)) return normalizeFromMarkdown(content as string);
        if (isImplicitTable(content as string)) return normalizeFromImplicit(content as string);
        throw new Error('Unsupported table format');
    }

    function normalizeCell(cellContent: string): ChatTableCell {
        const containsMath = MATH_REGEX.test(cellContent);
        return {
            content: cellContent.trim(),
            // The data model is the source of truth. Math is always LTR.
            direction: containsMath ? 'ltr' : 'auto',
            containsMath,
        };
    }

    function normalizeFromJson(content: ExplicitTableContent): ChatTableModel {
        return {
            headers: content.data.headers.map(normalizeCell),
            rows: content.data.rows.map(row => row.map(normalizeCell)),
        };
    }

    function normalizeFromMarkdown(markdown: string): ChatTableModel {
        const lines = markdown.trim().split('\n');
        const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean).map(normalizeCell);
        const rows = lines.slice(2).map(line => {
            return line.split('|').map(c => c.trim()).filter(Boolean).map(normalizeCell);
        });
        return { headers, rows };
    }
    
    function normalizeFromImplicit(text: string): ChatTableModel {
        const lines = text.trim().split('\n').filter(Boolean);
        const headerLine = lines.shift() || '';
        const headers = headerLine.split(IMPLICIT_DELIMITER_REGEX).map(normalizeCell);
        const rows = lines.map(line => line.split(IMPLICIT_DELIMITER_REGEX).map(normalizeCell));
        return { headers, rows };
    }
    ```

## Phase 3: UI Component and Styling

**Objective:** Build an accessible and theme-aligned `<ChatTable />` component with a single, efficient math rendering context.

1.  **Create Component File:**
    *   **File:** `src/ui/web/chat/ChatMessageContent/ChatTable.tsx`
    *   **Action:** Implement the React component. The `MathJax.Provider` now wraps the entire table to optimize performance.

    ```tsx
    // src/ui/web/chat/ChatMessageContent/ChatTable.tsx
    import React from 'react';
    import { ChatTableModel, ChatTableCell } from '@/infra/llm/table-types';
    import { MathJax } from 'react-mathjax'; // Assuming a project-wide provider setup
    import './ChatTable.css';

    const renderCellContent = (cell: ChatTableCell) => {
      if (cell.containsMath) {
        return <MathJax.Node formula={cell.content} />;
      }
      return cell.content;
    };

    export const ChatTable: React.FC<{ data: ChatTableModel }> = ({ data }) => {
      return (
        <MathJax.Provider>
          <div className="chat-table-container" dir="rtl">
            <table className="chat-table">
              {data.headers.length > 0 && (
                <thead>
                  <tr>
                    {data.headers.map((header, index) => (
                      <th key={index} scope="col" dir={header.direction}>
                        {renderCellContent(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {data.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} dir={cell.direction}>
                        {renderCellContent(cell)}
                      </td>
                    ))}
                  </tr>
                </tbody>
            </table>
          </div>
        </MathJax.Provider>
      );
    };
    ```

2.  **Create Styling File & Accessibility:**
    *   **File:** `src/ui/web/chat/ChatMessageContent/ChatTable.css`
    *   **Action:** Add CSS rules per Figma. The `unicode-bidi: isolate` rule is critical for preventing LTR math expressions from being affected by the parent RTL context.

    ```css
    /* src/ui/web/chat/ChatMessageContent/ChatTable.css */
    .chat-table-container {
      border-radius: var(--rounded-lg, 12px);
      overflow: hidden;
      border: 1px solid var(--border-color, #E5E7EB);
      width: 100%;
      overflow-x: auto; /* Responsive scrolling on mobile */
    }

    .chat-table {
      width: 100%;
      border-collapse: collapse;
      text-align: right; /* RTL default */
    }

    .chat-table th, .chat-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #E5E7EB);
      /* Accessibility: Ensure sufficient contrast */
      color: var(--text-color, #111827);
    }
    
    .chat-table thead th {
        background-color: var(--subtle-bg, #F9FAFB);
        font-weight: 600;
    }

    .chat-table tbody tr:last-child td {
      border-bottom: none;
    }
    
    /* Direction Ownership: CSS reflects the 'direction' property from the data model. */
    .chat-table [dir="ltr"] {
        text-align: left;
        /* Critical: Isolates LTR content from parent RTL context to prevent symbol flipping. */
        unicode-bidi: isolate; 
    }
    ```

## Phase 4: Integration with Chat Renderer

**Objective:** Modify the main chat component to use the new table rendering logic, with a fallback for parsing errors.

1.  **Update Chat Message Component:**
    *   **File:** `src/ui/web/chat/ChatMessageContent/index.tsx`
    *   **Action:** Import and use the new functions and component. Ideally, the `MathJax.Provider` should live at a higher level, wrapping all potential chat content, but for this component, wrapping at the message level is a good start if not already present.

    ```tsx
    // src/ui/web/chat/ChatMessageContent/index.tsx
    import React from 'react';
    // ... other imports
    import { isTableMessage, normalizeToTableModel } from '@/infra/llm/table-parser';
    import { ChatTable } from './ChatTable';
    import { ChatTableModel } from '@/infra/llm/table-types';

    // ... inside the component
    const [tableData, setTableData] = React.useState<ChatTableModel | null>(null);
    const [isTable, setIsTable] = React.useState(false);
    const [parseError, setParseError] = React.useState(false);

    React.useEffect(() => {
        // Reset state on content change
        setIsTable(false);
        setTableData(null);
        setParseError(false);
        try {
            if (isTableMessage(message.content)) {
                setIsTable(true);
                setTableData(normalizeToTableModel(message.content));
            }
        } catch (error) {
            console.error("Failed to parse table, falling back to text:", error);
            setParseError(true);
            setIsTable(false);
        }
    }, [message.content]);

    if (isTable && tableData && !parseError) {
        return <ChatTable data={tableData} />;
    }

    // Fallback to existing logic for rendering plain text/markdown
    return <div className="prose">{/* Existing renderer for non-table content */}</div>;
    ```

## Phase 5: Testing Strategy

**Objective:** Ensure the feature is robust, visually correct, and handles all specified cases.

1.  **Unit & Integration Tests (`table-parser.spec.ts`):**
    *   Test `isTableMessage` with valid JSON, Markdown, **implicit patterns**, and plain text.
    *   Test `normalizeToTableModel` for **all three** input types.
    *   Verify `normalizeCell` correctly identifies math content with the new `MATH_REGEX` and sets direction to `ltr`.
    *   Test with malformed data and mixed content to ensure graceful error handling and correct parsing.

2.  **Component Tests (Vitest/Storybook):**
    *   Create stories for `<ChatTable />` with:
        *   Headers containing math expressions.
        *   Mixed RTL text and LTR math.
        *   Long content to validate horizontal scrolling on mobile.
        *   Implicitly detected tables.

3.  **End-to-End Tests (Playwright):**
    *   Mock LLM responses for **explicit JSON, Markdown, and implicit** tables.
    *   Assert that the `<ChatTable />` component renders correctly for each case.
    *   Use visual regression testing to match snapshots against the Figma design.
    *   Assert that a malformed table message falls back to plain text without crashing.

## MVP Assumptions and Out of Scope

To align with the HLS and manage scope, the following are explicitly **not** part of this implementation:

*   ❌ **User-editable tables:** Tables are for display only.
*   ❌ **Nested tables:** Only a single level of table structure is supported.
*   ❌ **Sorting / filtering:** No interactive data manipulation.
*   ❌ **Table export:** No functionality to export to CSV, etc.
*   ❌ **Animated row reveal:** Rows will render statically.
*   ❌ **LLM-guided table generation:** This plan focuses on rendering existing data, not creating it.
