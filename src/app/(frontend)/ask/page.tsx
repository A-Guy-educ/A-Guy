import { NavigationBar } from '@/ui/web/homepage/NavigationBar'

export default function AskPage() {
  return (
    <div>
      <NavigationBar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">שאלות</h1>
        <div className="text-center text-muted-foreground py-12">תכונה זו תגיע בקרוב</div>
      </div>
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'שאל - A-Guy',
    description: 'שאל שאלות',
  }
}
