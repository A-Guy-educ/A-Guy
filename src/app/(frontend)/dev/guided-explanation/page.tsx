import { GuidedExplanationRunner } from '@/ui/web/GuidedExplanationRunner'
import { triangleProofFixture } from '@/ui/web/GuidedExplanationRunner/__fixtures__/triangle-proof'

/**
 * Demo route for the GuidedExplanationRunner.
 *
 * Renders the hand-converted triangle-proof fixture so we can verify
 * visually that the trusted renderer reproduces the manager's reference
 * animation from pure data. Unlinked — reachable only via direct URL.
 */
export default function GuidedExplanationDemoPage() {
  return (
    <main className="min-h-screen py-section-md px-4">
      <GuidedExplanationRunner payload={triangleProofFixture} />
    </main>
  )
}
