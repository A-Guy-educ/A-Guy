import type { GuidedExplanationV1 } from '@/infra/contracts/guided-explanation/v1'

interface ProofTableProps {
  table: NonNullable<GuidedExplanationV1['proofTable']>
}

/**
 * Dumb presentational proof table. Rows carry stable ids so the engine's
 * `highlightRow` action can target them. Claim/reason fields are rendered
 * via `textContent` (React default), so no HTML injection surface.
 */
export function ProofTable({ table }: ProofTableProps) {
  return (
    <div className="ge-proof-table-wrap">
      <table className="ge-proof-table">
        <thead>
          <tr>
            <th className="ge-proof-table-col-index">{table.columns[0]}</th>
            <th className="ge-proof-table-col-claim">{table.columns[1]}</th>
            <th className="ge-proof-table-col-reason">{table.columns[2]}</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={row.id} id={row.id} className="ge-proof-table-row">
              <td className="ge-proof-table-index">{index + 1}</td>
              <td className={`ge-proof-table-claim ge-emphasis-${row.emphasis ?? 'none'}`}>
                {row.claim}
              </td>
              <td className={`ge-proof-table-reason ge-emphasis-${row.emphasis ?? 'none'}`}>
                {row.reason}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
