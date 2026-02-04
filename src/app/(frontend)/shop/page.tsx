'use client'

import { useState } from 'react'
import { ArrowRight, Telescope } from 'lucide-react'
import { PlanCard } from './_components/PlanCard'
import { CourseCard } from './_components/CourseCard'
import { SystemLink } from '@/infra/loading/components/SystemLink'

export default function ShopPage() {
  const [activeCatalog, setActiveCatalog] = useState<'middle' | 'high'>('middle')

  const membershipPlans = [
    {
      title: 'חינמי',
      subtitle: 'מסלול בסיסי',
      price: 0,
      period: 'חודשי',
      features: [
        { icon: 'x' as const, text: 'מערכת לימוד - ללא', style: 'disabled' as const },
        { icon: 'check' as const, text: 'מערכת תרגול - מלא', style: 'enabled' as const },
        { icon: 'help' as const, text: 'שאלות - מוגבל', style: 'limited' as const },
        { icon: 'x' as const, text: 'בחינות - ללא', style: 'disabled' as const },
      ],
      courseCount: {
        number: 1,
        text: '1 קורס',
        color: 'font-bold text-blue-600',
        icon: 'book' as const,
      },
      buttonText: 'המסלול הנוכחי',
      buttonStyle: 'current' as const,
    },
    {
      title: 'סטנדרט',
      subtitle: 'מסלול מורחב',
      price: 100,
      period: 'חודשי',
      features: [
        { icon: 'x' as const, text: 'מערכת לימוד - ללא', style: 'disabled' as const },
        { icon: 'check' as const, text: 'מערכת תרגול - מלא', style: 'enabled' as const },
        { icon: 'help' as const, text: 'שאלות - מוגבל', style: 'limited' as const },
        { icon: 'x' as const, text: 'בחינות - ללא', style: 'disabled' as const },
      ],
      courseCount: {
        number: 1,
        text: '1 קורס',
        color: 'font-bold text-blue-600',
        icon: 'book' as const,
      },
      buttonText: 'בחר מסלול',
      buttonStyle: 'standard' as const,
      isBordered: true,
    },
    {
      title: 'פרימיום',
      subtitle: 'מסלול פרימיום',
      price: 179,
      period: 'חודשי',
      badge: 'הכי משתלם',
      badgeColor: 'bg-primary font-black text-primary-foreground',
      features: [
        { icon: 'check' as const, text: 'מערכת לימוד - מלא', style: 'enabled' as const },
        { icon: 'check' as const, text: 'מערכת תרגול - מלא', style: 'enabled' as const },
        { icon: 'help' as const, text: 'שאלות - מוגבל', style: 'limited' as const },
        { icon: 'help' as const, text: 'בחינות - מוגבל', style: 'limited' as const },
      ],
      courseCount: {
        number: 3,
        text: '3 קורסים לבחירה',
        color: 'font-bold text-primary',
        icon: 'layers' as const,
      },
      buttonText: 'הצטרף עכשיו',
      buttonStyle: 'premium' as const,
      isPremium: true,
    },
  ]

  const middleSchoolCourses = [
    {
      badge: "כיתה ז'",
      badgeColor: 'text-blue-500',
      title: 'מתמטיקה - בסיס',
      description: 'יסודות החשבון, אלגברה וגיאומטריה',
      price: 149,
      icon: 'book' as const,
      iconBgColor: 'bg-blue-50',
      buttonText: 'רכישת קורס',
      buttonStyle: 'purchase' as const,
    },
    {
      badge: "כיתה ח'",
      badgeColor: 'text-blue-500',
      title: 'מתמטיקה - בסיס',
      description: 'הקורס הפעיל שלך במערכת',
      price: 149,
      icon: 'check' as const,
      iconBgColor: 'bg-green-50',
      buttonText: 'רכוש בהצלחה',
      buttonStyle: 'owned' as const,
      isOwned: true,
    },
    {
      badge: "כיתה ט'",
      badgeColor: 'text-blue-500',
      title: 'מתמטיקה - בסיס',
      description: 'הכנה למבחני המפמ"ר והתיכון',
      price: 159,
      icon: 'graduation' as const,
      iconBgColor: 'bg-blue-50',
      buttonText: 'רכישת קורס',
      buttonStyle: 'purchase' as const,
    },
  ]

  const highSchoolCourses = [
    {
      badge: 'כיתה י\' • 3 יח"ל',
      badgeColor: 'text-red-500',
      title: 'שאלון 172',
      description: 'הכנה מלאה לשאלון הבגרות הראשון',
      price: 199,
      icon: 'book' as const,
      iconBgColor: 'bg-red-50',
      buttonText: 'רכישת קורס',
      buttonStyle: 'purchase' as const,
    },
    {
      badge: 'כיתה י"א • 4 יח"ל',
      badgeColor: 'text-orange-500',
      title: 'שאלון 471',
      description: 'אנליזה, גיאומטריה וטריגונומטריה',
      price: 279,
      icon: 'book' as const,
      iconBgColor: 'bg-orange-50',
      buttonText: 'רכישת קורס',
      buttonStyle: 'purchase' as const,
    },
    {
      badge: 'כיתה י"ב • 5 יח"ל',
      badgeColor: 'text-purple-500',
      title: 'שאלון 572',
      description: 'וקטורים, מרוכבים ולוגריתמים',
      price: 299,
      icon: 'book' as const,
      iconBgColor: 'bg-purple-50',
      buttonText: 'רכישת קורס',
      buttonStyle: 'purchase' as const,
    },
  ]

  return (
    <div className="min-h-screen text-foreground antialiased" dir="rtl">
      {/* Navbar */}
      <nav className="bg-card border-b border-border py-2 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <SystemLink
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm"
          >
            <ArrowRight className="w-4 h-4" />
            <span>חזרה ללמידה</span>
          </SystemLink>
        </div>

        <div className="flex items-center gap-2 cursor-pointer">
          <span className="text-primary text-2xl font-black">buyguy</span>
          <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center shadow-sm">
            <Telescope className="w-5 h-5 text-white" />
          </div>
        </div>
      </nav>

      {/* Store Header */}
      <header className="bg-card border-b border-border pt-12 pb-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-foreground mb-4 text-4xl font-black">חנות הקורסים</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            בחרו את המסלול שמתאים לכם והתקדמו להצלחה במתמטיקה.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Membership Plans Section */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-foreground uppercase tracking-widest text-2xl font-black">
              מסלולי הצטרפות
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {membershipPlans.map((plan, index) => (
              <PlanCard key={index} {...plan} />
            ))}
          </div>
        </section>

        {/* Course Catalog Section */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-foreground uppercase tracking-widest text-2xl font-black">
              קטלוג הקורסים
            </h2>
          </div>

          {/* Catalog Filter Tabs */}
          <div className="max-w-md mx-auto mb-12">
            <div className="bg-gray-200/60 p-1.5 rounded-2xl flex items-center shadow-inner">
              <button
                onClick={() => setActiveCatalog('middle')}
                className={`flex-1 py-3 rounded-xl transition-all text-sm ${
                  activeCatalog === 'middle'
                    ? 'bg-white text-primary shadow-sm font-black'
                    : 'text-gray-500 hover:text-gray-700 font-bold'
                }`}
              >
                חטיבת ביניים
              </button>
              <button
                onClick={() => setActiveCatalog('high')}
                className={`flex-1 py-3 rounded-xl transition-all text-sm ${
                  activeCatalog === 'high'
                    ? 'bg-white text-primary shadow-sm font-black'
                    : 'text-gray-500 hover:text-gray-700 font-bold'
                }`}
              >
                תיכון
              </button>
            </div>
          </div>

          {/* Middle School Courses */}
          {activeCatalog === 'middle' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
              {middleSchoolCourses.map((course, index) => (
                <CourseCard key={index} {...course} />
              ))}
            </div>
          )}

          {/* High School Courses */}
          {activeCatalog === 'high' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
              {highSchoolCourses.map((course, index) => (
                <CourseCard key={index} {...course} />
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-24 pt-12 border-t border-border text-center">
          <p className="text-gray-300 uppercase mb-6 text-xs font-bold tracking-widest">
            buyguy Learning Platform
          </p>
          <div className="flex justify-center gap-6 text-muted-foreground text-sm font-medium">
            <a href="#" className="hover:text-primary transition-colors">
              תנאי שימוש
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              מדיניות פרטיות
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              צור קשר
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
