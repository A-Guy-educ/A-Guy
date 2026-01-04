import type { ImageToExerciseAPIResponse } from '@/types/ai'
import styles from './AIExerciseCreator.module.css'

interface ExerciseResultsProps {
  result: ImageToExerciseAPIResponse
}

export function ExerciseResults({ result }: ExerciseResultsProps) {
  if (!result.success || !result.data) {
    return null
  }

  return (
    <div className={styles.resultsSection}>
      <h2 className={styles.resultsTitle}>Exercise Created Successfully!</h2>

      <div className={styles.resultCard}>
        <div className={styles.resultHeader}>
          <span className={styles.resultLabel}>Question</span>
        </div>
        <p className={styles.resultValue}>{result.data.question}</p>
      </div>

      <div className={styles.resultCard}>
        <div className={styles.resultHeader}>
          <span className={styles.resultLabel}>Options</span>
        </div>
        <ul className={styles.resultValue}>
          {result.data.options.map((opt, i) => (
            <li
              key={i}
              style={{ fontWeight: i === result.data?.correctAnswer ? 'bold' : 'normal' }}
            >
              {opt} {i === result.data?.correctAnswer && '✓ (Correct)'}
            </li>
          ))}
        </ul>
      </div>

      {result.data.explanation && (
        <div className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <span className={styles.resultLabel}>Explanation</span>
          </div>
          <p className={styles.resultValue}>{result.data.explanation}</p>
        </div>
      )}

      <div className={styles.resultCard}>
        <div className={styles.resultHeader}>
          <span className={styles.resultLabel}>Full JSON Response</span>
          <button type="button" className={styles.jsonToggle}>
            View JSON
          </button>
        </div>
        <pre className={styles.jsonBlock}>{JSON.stringify(result, null, 2)}</pre>
      </div>

      <p className={styles.resultValue}>
        Processing time: {result.metadata?.processingTimeMs}ms | Model: {result.metadata?.model}
      </p>
    </div>
  )
}
