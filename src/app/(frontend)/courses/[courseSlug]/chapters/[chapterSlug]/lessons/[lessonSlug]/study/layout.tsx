import { ThemeProvider } from '@/ui/web/providers/Theme'

/**
 * @fileType layout
 * @domain study-mode
 * @pattern route-layout
 * @ai-summary Layout for the new study variant route
 */

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
