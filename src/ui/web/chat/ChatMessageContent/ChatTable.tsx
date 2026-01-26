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
            ))}
          </tbody>
        </table>
      </div>
    </MathJax.Provider>
  );
};
