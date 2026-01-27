import { TableModel, TableCell } from './table-types';

function analyzeCell(text: string): TableCell {
  const containsMath = /(\$\$[\s\S]*?\$\$|\[(][\s\S]*?\[)])/.test(text);
  const direction = /[\u0590-\u05FF]/.test(text) ? 'rtl' : 'ltr';
  return { content: text, containsMath, direction };
}

export function parseTable(content: string): TableModel | null {
  try {
    // Rule 1: Explicit Markdown Table
    const markdownMatch = content.match(/^\|(.+)\|\n\|([\s\|:-]+)\|\n(\|(?:.+)\|\n?)+$/m);
    if (markdownMatch) {
      const lines = content.trim().split('\n');
      const headerLine = lines[0];
      const rows = lines.slice(2);

      const headers = headerLine.split('|').slice(1, -1).map(h => analyzeCell(h.trim()));
      const tableRows = rows.map(rowLine => {
        return rowLine.split('|').slice(1, -1).map(c => analyzeCell(c.trim()));
      });

      if (headers.length > 0 && tableRows.length > 0) {
        return { headers, rows: tableRows };
      }
    }

    // Rule 2: Implicit Structure (Conservative)
    const implicitMatch = content.split('\n').filter(line => line.includes('|'));
    if (implicitMatch.length >= 3) {
      const firstRowCols = implicitMatch[0].split('|').length;
      const isTable = implicitMatch.every(line => line.split('|').length === firstRowCols);

      if (isTable) {
        const headers = implicitMatch[0].split('|').map(h => analyzeCell(h.trim()));
        const tableRows = implicitMatch.slice(1).map(rowLine => {
          return rowLine.split('|').map(c => analyzeCell(c.trim()));
        });

        return { headers, rows: tableRows };
      }
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Table parsing failed:', error);
    }
    return null;
  }
}
