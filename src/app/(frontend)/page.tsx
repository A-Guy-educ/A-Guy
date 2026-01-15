import { HomePage } from './_components/HomePage'

export default function HomepagePage() {
  return <HomePage />
}

export async function generateMetadata() {
  return {
    title: 'דף הבית - A-Guy',
    description: 'המורה הדיגיטלי שלך - לימוד, תרגול, שאלות ומבחנים',
  }
}
