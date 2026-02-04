/**
 * Template Card Component
 *
 * Displays a conversion template summary with actions
 *
 * @fileType component
 * @domain admin
 * @pattern card
 * @ai-summary Card component for displaying template info
 */

'use client'

import { useState } from 'react'

interface TemplateCardProps {
  template: {
    id: string
    name: string
    description?: string
    config: {
      reviewMode: string
      segmentation?: { pagesPerSegment: number }
      extraction?: { mode: string; exerciseTypes?: string[] }
    }
    additionalRounds?: Array<{ name: string; isEnabled: boolean }>
    isDefault?: boolean
    usageCount?: number
  }
  onUse: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  isDeleting?: boolean
}

export function TemplateCard({
  template,
  onUse,
  onEdit,
  onDelete,
  onDuplicate,
  isDeleting,
}: TemplateCardProps) {
  const [showMenu, setShowMenu] = useState(false)

  const exerciseTypes = template.config.extraction?.exerciseTypes?.slice(0, 3).join(', ') || 'All'
  const extraTypes =
    (template.config.extraction?.exerciseTypes?.length || 0) > 3
      ? `+${(template.config.extraction?.exerciseTypes?.length || 0) - 3}`
      : ''

  return (
    <div className="template-card">
      <div className="card-header">
        <div className="card-title-row">
          <h3 className="template-name">{template.name}</h3>
          {template.isDefault && <span className="default-badge">Default</span>}
        </div>
        <div className="card-menu">
          <button
            className="menu-toggle"
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Template actions"
          >
            ⋮
          </button>
          {showMenu && (
            <div className="menu-dropdown">
              <button onClick={() => onUse(template.id)}>Use Template</button>
              <button onClick={() => onEdit(template.id)}>Edit</button>
              <button onClick={() => onDuplicate(template.id)}>Duplicate</button>
              {!template.isDefault && (
                <button
                  className="delete-option"
                  onClick={() => onDelete(template.id)}
                  disabled={isDeleting}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {template.description && <p className="template-description">{template.description}</p>}

      <div className="card-metrics">
        <div className="metric">
          <span className="metric-label">Review Mode</span>
          <span className="metric-value" style={{ textTransform: 'capitalize' }}>
            {template.config.reviewMode}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Segment Size</span>
          <span className="metric-value">
            {template.config.segmentation?.pagesPerSegment || 2} pages
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Exercise Types</span>
          <span className="metric-value">
            {exerciseTypes} {extraTypes}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Enrichment</span>
          <span className="metric-value">
            {template.additionalRounds?.filter((r) => r.isEnabled).length || 0} rounds
          </span>
        </div>
      </div>

      <div className="card-footer">
        <button className="btn-use" onClick={() => onUse(template.id)}>
          Use Template
        </button>
        <button className="btn-edit" onClick={() => onEdit(template.id)}>
          Edit
        </button>
      </div>

      {template.usageCount !== undefined && (
        <div className="usage-count">Used {template.usageCount} times</div>
      )}

      <style>{`
        .template-card {
          border: 1px solid var(--theme-elevation-200);
          border-radius: 8px;
          padding: 1rem;
          background: white;
          position: relative;
        }
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
        .card-title-row { display: flex; align-items: center; gap: 0.5rem; }
        .template-name { font-size: 1rem; font-weight: 600; margin: 0; }
        .default-badge {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          background: var(--theme-primary);
          color: white;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .card-menu { position: relative; }
        .menu-toggle {
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0.25rem;
          color: var(--theme-elevation-500);
        }
        .menu-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          background: white;
          border: 1px solid var(--theme-elevation-200);
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          z-index: 10;
          min-width: 120px;
        }
        .menu-dropdown button {
          display: block;
          width: 100%;
          padding: 0.5rem 1rem;
          border: none;
          background: none;
          text-align: left;
          cursor: pointer;
          font-size: 0.875rem;
        }
        .menu-dropdown button:hover { background: var(--theme-elevation-50); }
        .delete-option { color: #dc2626; }
        .delete-option:disabled { opacity: 0.5; cursor: not-allowed; }
        .template-description {
          font-size: 0.875rem;
          color: var(--theme-elevation-500);
          margin: 0 0 1rem 0;
        }
        .card-metrics {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .metric { display: flex; flex-direction: column; }
        .metric-label { font-size: 0.625rem; color: var(--theme-elevation-500); text-transform: uppercase; }
        .metric-value { font-size: 0.875rem; font-weight: 500; }
        .card-footer { display: flex; gap: 0.5rem; }
        .btn-use, .btn-edit {
          flex: 1;
          padding: 0.5rem;
          border-radius: 4px;
          font-size: 0.875rem;
          cursor: pointer;
        }
        .btn-use { background: var(--theme-primary); color: white; border: none; }
        .btn-edit { background: var(--theme-elevation-100); border: none; }
        .usage-count {
          font-size: 0.75rem;
          color: var(--theme-elevation-400);
          margin-top: 0.5rem;
          text-align: center;
        }
      `}</style>
    </div>
  )
}
