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
