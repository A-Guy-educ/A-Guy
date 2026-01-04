import styles from './AIExerciseCreator.module.css'

interface ExerciseFormProps {
  onSubmit: (e: React.FormEvent) => Promise<void>
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  imagePreview: string | null
  prompt: string
  onPromptChange: (value: string) => void
  isProcessing: boolean
  imageFile: File | null
}

const samplePrompt =
  'Extract this exercise completely with all parts (א, ב, ג, etc.). Convert all math symbols to LaTeX format ($x^2$, $\\frac{a}{b}$). Return as JSON with question, options (if any), correct answer index, and explanation.'

export function ExerciseForm({
  onSubmit,
  onImageSelect,
  imagePreview,
  prompt,
  onPromptChange,
  isProcessing,
  imageFile,
}: ExerciseFormProps) {
  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={styles.formGroup}>
        <label className={styles.label}>Exercise Image</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={onImageSelect}
          className={styles.fileInput}
        />
      </div>

      {imagePreview && (
        <div className={styles.previewContainer}>
          <img src={imagePreview} alt="Preview" className={styles.preview} />
        </div>
      )}

      <div className={styles.formGroup}>
        <div className={styles.labelRow}>
          <label className={styles.label}>Prompt for AI</label>
          <button
            type="button"
            onClick={() => onPromptChange(samplePrompt)}
            className={styles.sampleButton}
          >
            Use Sample Prompt
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Example: Extract this math exercise and return it as JSON with question, options, and correct answer..."
          rows={4}
          className={styles.textarea}
        />
      </div>

      <button
        type="submit"
        disabled={isProcessing || !imageFile || !prompt.trim()}
        className={styles.submitButton}
      >
        {isProcessing ? 'Processing...' : 'Generate Exercise'}
      </button>
    </form>
  )
}
