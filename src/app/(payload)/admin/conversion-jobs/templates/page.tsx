/**
 * Templates Management Page
 *
 * Route for viewing and managing conversion templates
 *
 * @fileType page
 * @domain admin
 * @pattern admin-page
 * @ai-summary Page for managing conversion templates
 */

'use client'

import { useState } from 'react'

import { TemplateCard } from '@/ui/admin/conversion-jobs/components/TemplateCard'
import {
  ConversionTemplate,
  useConversionTemplates,
} from '@/ui/admin/conversion-jobs/hooks/useConversionTemplates'

export default function TemplatesPage() {
  const {
    templates,
    isLoading,
    error,
    refetch,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
  } = useConversionTemplates()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ConversionTemplate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    setDeletingId(id)
    await deleteTemplate(id)
    setDeletingId(null)
  }

  const handleUseTemplate = (id: string) => {
    // Navigate to wizard with template pre-selected
    // This would typically redirect to /admin/conversion-jobs/new?templateId=id
    window.location.href = `/admin/conversion-jobs/new?templateId=${id}`
  }

  const handleEditTemplate = (id: string) => {
    const template = templates.find((t) => t.id === id)
    if (template) {
      setEditingTemplate(template)
    }
  }

  const handleDuplicate = async (id: string) => {
    await duplicateTemplate(id)
  }

  if (isLoading) {
    return (
      <div className="templates-page">
        <div className="loading-state">Loading templates...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="templates-page">
        <div className="error-state">
          <p>Failed to load templates</p>
          <button onClick={refetch}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="templates-page">
      <header className="page-header">
        <div className="header-content">
          <h1>Conversion Templates</h1>
          <p className="page-description">
            Templates save your conversion settings (prompts, segment size, exercise types, review
            mode) for reuse. Create a template from successful conversions or configure one
            manually, then apply it to new conversions for consistent results.
          </p>
          <details className="template-help">
            <summary>What can I save in a template?</summary>
            <ul>
              <li>
                <strong>Prompts:</strong> Extractor and verifier prompts used for exercise
                generation
              </li>
              <li>
                <strong>Segmentation:</strong> Pages per segment and custom boundaries
              </li>
              <li>
                <strong>Exercise Types:</strong> MCQ, free response, fill-in-blank, matching, and
                more
              </li>
              <li>
                <strong>Review Mode:</strong> Auto-approve, per-segment review, or manual approval
              </li>
              <li>
                <strong>Additional Rounds:</strong> Extra AI enrichment steps for generated
                exercises
              </li>
            </ul>
          </details>
        </div>
        <button className="btn-create" onClick={() => setShowCreateForm(true)}>
          Create Template
        </button>
      </header>

      {templates.length === 0 ? (
        <div className="empty-state">
          <h2>No Templates Yet</h2>
          <p>Create your first template to save conversion settings for reuse</p>
          <button className="btn-create-large" onClick={() => setShowCreateForm(true)}>
            Create First Template
          </button>
        </div>
      ) : (
        <div className="templates-grid">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={handleUseTemplate}
              onEdit={handleEditTemplate}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              isDeleting={deletingId === template.id}
            />
          ))}
        </div>
      )}

      {showCreateForm && (
        <TemplateForm
          onClose={() => setShowCreateForm(false)}
          onSave={async (data) => {
            await createTemplate(data as Parameters<typeof createTemplate>[0])
            setShowCreateForm(false)
          }}
        />
      )}

      {editingTemplate && (
        <TemplateForm
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={async (data) => {
            await updateTemplate(editingTemplate.id, data)
            setEditingTemplate(null)
          }}
        />
      )}

      <style>{`
        .templates-page { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }
        .page-header h1 { font-size: 1.75rem; font-weight: 600; margin: 0; }
        .page-description { color: var(--theme-elevation-500); margin-top: 0.5rem; }
        .btn-create {
          padding: 0.625rem 1rem;
          background: var(--theme-primary);
          color: white;
          border: none;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
        }
        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
        }
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          background: var(--theme-elevation-50);
          border-radius: 8px;
        }
        .empty-state h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
        .empty-state p { color: var(--theme-elevation-500); margin-bottom: 1.5rem; }
        .btn-create-large {
          padding: 0.75rem 1.5rem;
          background: var(--theme-primary);
          color: white;
          border: none;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
        }
        .loading-state, .error-state {
          text-align: center;
          padding: 4rem;
          color: var(--theme-elevation-500);
        }
        .error-state button {
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          border: 1px solid var(--theme-elevation-200);
          background: white;
          border-radius: 4px;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}

interface TemplateFormProps {
  template?: ConversionTemplate
  onClose: () => void
  onSave: (data: Partial<ConversionTemplate>) => Promise<void>
}

function TemplateForm({ template, onClose, onSave }: TemplateFormProps) {
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [reviewMode, setReviewMode] = useState(template?.config.reviewMode || 'segment')
  const [pagesPerSegment, setPagesPerSegment] = useState(
    template?.config.segmentation?.pagesPerSegment?.toString() || '2',
  )
  const [exerciseTypes, setExerciseTypes] = useState(
    template?.config.extraction?.exerciseTypes?.join(', ') || 'mcq, free_response, select',
  )
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({
        name,
        description,
        config: {
          reviewMode: reviewMode as 'auto' | 'segment' | 'batch' | 'manual',
          segmentation: { pagesPerSegment: parseInt(pagesPerSegment) || 2 },
          extraction: {
            mode: template?.config.extraction?.mode || 'structured',
            exerciseTypes: exerciseTypes
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          },
        },
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{template ? 'Edit Template' : 'Create Template'}</h2>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Template"
            />
          </div>

          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template"
              rows={2}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Review Mode</label>
              <select
                value={reviewMode}
                onChange={(e) =>
                  setReviewMode(e.target.value as 'auto' | 'segment' | 'batch' | 'manual')
                }
              >
                <option value="auto">Auto-Approve</option>
                <option value="segment">Segment Review</option>
                <option value="batch">Batch Review</option>
                <option value="manual">Manual Only</option>
              </select>
            </div>

            <div className="form-group">
              <label>Pages per Segment</label>
              <input
                type="number"
                min="1"
                max="20"
                value={pagesPerSegment}
                onChange={(e) => setPagesPerSegment(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Exercise Types (comma-separated)</label>
            <input
              type="text"
              value={exerciseTypes}
              onChange={(e) => setExerciseTypes(e.target.value)}
              placeholder="mcq, free_response, select"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-save" onClick={handleSave} disabled={!name || isSaving}>
            {isSaving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .modal-content {
          background: white;
          border-radius: 8px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--theme-elevation-200);
        }
        .modal-header h2 { font-size: 1.25rem; margin: 0; }
        .btn-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--theme-elevation-500);
        }
        .modal-body { padding: 1.5rem; }
        .form-group { margin-bottom: 1rem; }
        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
        }
        .form-group input, .form-group select, .form-group textarea {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid var(--theme-elevation-200);
          border-radius: 4px;
          font-size: 0.875rem;
        }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--theme-elevation-200);
        }
        .btn-cancel {
          padding: 0.5rem 1rem;
          border: 1px solid var(--theme-elevation-200);
          background: white;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-save {
          padding: 0.5rem 1rem;
          background: var(--theme-primary);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
