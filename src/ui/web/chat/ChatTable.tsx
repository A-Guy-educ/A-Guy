import { TableModel, TableCell } from '@/infra/llm/table-types';

// This is a placeholder for the real MathRenderer. 
// You should replace it with your project's actual component.
const MathRenderer = ({ math }: { math: string }) => {
    return <span className="font-bold">{math}</span>;
}

const CellContent = ({ content, containsMath }: { content: string; containsMath: boolean }) => {
    if (!containsMath) {
      return <>{content}</>;
    }
    
    const parts = content.split(/(\$\$[\s\S]*?\$\$|\[(][\s\S]*?\[)])/g);
  
    return (
      <>
        {parts.map((part, index) => {
          const isMath = /^\$\$[\s\S]*?\$\$|^\[(][\s\S]*?\[)]$/.test(part);
          if (isMath) {
            return (
              <span key={index} className="math-inline text-primary">
                <MathRenderer math={part} />
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

const TableCellComponent = ({ cell, isHeader = false }: { cell: TableCell; isHeader?: boolean }) => {
    const Tag = isHeader ? 'th' : 'td';
    const cellClasses = "px-4 py-3 text-center border-l border-primary/20 first:border-l-0";
  
    return (
      <Tag className={cellClasses} dir={cell.direction}>
        <CellContent content={cell.content} containsMath={cell.containsMath} />
      </Tag>
    );
  };

export const ChatTable = ({ data }: { data: TableModel }) => {
    return (
      <div className="border border-primary/20 rounded-lg my-4 overflow-hidden" dir="rtl">
        <table className="w-full text-body-md">
          {data.headers.length > 0 && (
            <thead>
              <tr className="bg-primary/10 text-primary font-bold">
                {data.headers.map((cell, i) => (
                  <TableCellComponent key={i} cell={cell} isHeader />
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-b border-primary/10 last:border-b-0 even:bg-primary/5 odd:bg-white">
                {row.map((cell, j) => (
                  <TableCellComponent key={j} cell={cell} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
