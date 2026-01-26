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
