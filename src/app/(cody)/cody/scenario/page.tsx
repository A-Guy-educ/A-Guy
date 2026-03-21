/**
 * @fileType page
 * @domain cody
 * @pattern scenario-editor-page
 * @ai-summary Scenario Editor page - IDE for building scenarios with prototypes and design system
 */
import { ScenarioEditor } from './components/ScenarioEditor'

export const metadata = {
  title: 'Scenario Editor',
  description: 'Create and manage scenarios for scenario-first development',
  path: '/cody/scenario',
}

export default async function ScenarioPage() {
  return <ScenarioEditor />
}
