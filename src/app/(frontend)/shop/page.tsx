'use client'

import { useState } from 'react'
import { ArrowRight, Telescope } from 'lucide-react'
import { PlanCard } from './_components/PlanCard'
import { CourseCard } from './_components/CourseCard'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { useTranslations } from '@/ui/web/providers/I18n'

export default function ShopPage() {
  const t = useTranslations('shop')
  const [activeCatalog, setActiveCatalog] = useState<'middle' | 'high'>('middle')

  const membershipPlans = [
    {
      title: t('plans.free.title'),
      subtitle: t('plans.free.subtitle'),
      price: 0,
      period: t('perMonth'),
      features: [
        { icon: 'x' as const, text: t('features.learningSystemNo'), style: 'disabled' as const },
        {
          icon: 'check' as const,
          text: t('features.practiceSystemFull'),
          style: 'enabled' as const,
        },
        { icon: 'help' as const, text: t('features.questionsLimited'), style: 'limited' as const },
        { icon: 'x' as const, text: t('features.examsNo'), style: 'disabled' as const },
      ],
      courseCount: {
        number: 1,
        text: t('plans.free.courseCount'),
        color: 'font-bold text-primary',
        icon: 'book' as const,
      },
      buttonText: t('plans.free.currentPlan'),
      buttonStyle: 'current' as const,
    },
    {
      title: t('plans.standard.title'),
      subtitle: t('plans.standard.subtitle'),
      price: 100,
      period: t('perMonth'),
      features: [
        { icon: 'x' as const, text: t('features.learningSystemNo'), style: 'disabled' as const },
        {
          icon: 'check' as const,
          text: t('features.practiceSystemFull'),
          style: 'enabled' as const,
        },
        { icon: 'help' as const, text: t('features.questionsLimited'), style: 'limited' as const },
        { icon: 'x' as const, text: t('features.examsNo'), style: 'disabled' as const },
      ],
      courseCount: {
        number: 1,
        text: t('plans.standard.courseCount'),
        color: 'font-bold text-primary',
        icon: 'book' as const,
      },
      buttonText: t('plans.standard.selectPlan'),
      buttonStyle: 'standard' as const,
      isBordered: true,
    },
    {
      title: t('plans.premium.title'),
      subtitle: t('plans.premium.subtitle'),
      price: 179,
      period: t('perMonth'),
      badge: t('plans.premium.badge'),
      badgeColor: 'bg-primary font-black text-primary-foreground',
      features: [
        {
          icon: 'check' as const,
          text: t('features.learningSystemFull'),
          style: 'enabled' as const,
        },
        {
          icon: 'check' as const,
          text: t('features.practiceSystemFull'),
          style: 'enabled' as const,
        },
        { icon: 'help' as const, text: t('features.questionsLimited'), style: 'limited' as const },
        { icon: 'help' as const, text: t('features.examsLimited'), style: 'limited' as const },
      ],
      courseCount: {
        number: 3,
        text: t('plans.premium.courseCount'),
        color: 'font-bold text-primary',
        icon: 'layers' as const,
      },
      buttonText: t('plans.premium.joinNow'),
      buttonStyle: 'premium' as const,
      isPremium: true,
    },
  ]

  const middleSchoolCourses = [
    {
      badge: t('courses.grade7'),
      badgeColor: 'text-primary',
      title: t('courses.mathBasics'),
      description: t('courses.grade7Description'),
      price: 149,
      icon: 'book' as const,
      iconBgColor: 'bg-primary/10',
      buttonText: t('courses.purchaseCourse'),
      buttonStyle: 'purchase' as const,
    },
    {
      badge: t('courses.grade8'),
      badgeColor: 'text-primary',
      title: t('courses.mathBasics'),
      description: t('courses.grade8Description'),
      price: 149,
      icon: 'check' as const,
      iconBgColor: 'bg-success/10',
      buttonText: t('courses.purchasedSuccessfully'),
      buttonStyle: 'owned' as const,
      isOwned: true,
    },
    {
      badge: t('courses.grade9'),
      badgeColor: 'text-primary',
      title: t('courses.mathBasics'),
      description: t('courses.grade9Description'),
      price: 159,
      icon: 'graduation' as const,
      iconBgColor: 'bg-primary/10',
      buttonText: t('courses.purchaseCourse'),
      buttonStyle: 'purchase' as const,
    },
  ]

  const highSchoolCourses = [
    {
      badge: 'כיתה י\' • 3 יח"ל',
      badgeColor: 'text-destructive',
      title: t('courses.questionnaire172'),
      description: t('courses.questionnaire172Description'),
      price: 199,
      icon: 'book' as const,
      iconBgColor: 'bg-destructive/10',
      buttonText: t('courses.purchaseCourse'),
      buttonStyle: 'purchase' as const,
    },
    {
      badge: 'כיתה י"א • 4 יח"ל',
      badgeColor: 'text-warning',
      title: t('courses.questionnaire471'),
      description: t('courses.questionnaire471Description'),
      price: 279,
      icon: 'book' as const,
      iconBgColor: 'bg-warning/10',
      buttonText: t('courses.purchaseCourse'),
      buttonStyle: 'purchase' as const,
    },
    {
      badge: 'כיתה י"ב • 5 יח"ל',
      badgeColor: 'text-accent',
      title: t('courses.questionnaire572'),
      description: t('courses.questionnaire572Description'),
      price: 299,
      icon: 'book' as const,
      iconBgColor: 'bg-accent/10',
      buttonText: t('courses.purchaseCourse'),
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
            <span>{t('backToLearning')}</span>
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
          <h1 className="text-foreground mb-4 text-4xl font-black">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">{t('subtitle')}</p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Membership Plans Section */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-foreground uppercase tracking-widest text-2xl font-black">
              {t('membershipPlans')}
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
              {t('courseCatalog')}
            </h2>
          </div>

          {/* Catalog Filter Tabs */}
          <div className="max-w-md mx-auto mb-12">
            <div className="bg-muted p-1.5 rounded-2xl flex items-center shadow-inner">
              <button
                onClick={() => setActiveCatalog('middle')}
                className={`flex-1 py-3 rounded-xl transition-all text-sm ${
                  activeCatalog === 'middle'
                    ? 'bg-card text-primary shadow-sm font-black'
                    : 'text-muted-foreground hover:text-foreground font-bold'
                }`}
              >
                {t('middleSchool')}
              </button>
              <button
                onClick={() => setActiveCatalog('high')}
                className={`flex-1 py-3 rounded-xl transition-all text-sm ${
                  activeCatalog === 'high'
                    ? 'bg-card text-primary shadow-sm font-black'
                    : 'text-muted-foreground hover:text-foreground font-bold'
                }`}
              >
                {t('highSchool')}
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
          <p className="text-muted-foreground/50 uppercase mb-6 text-xs font-bold tracking-widest">
            {t('footer.platform')}
          </p>
          <div className="flex justify-center gap-6 text-muted-foreground text-sm font-medium">
            <a href="#" className="hover:text-primary transition-colors">
              {t('footer.terms')}
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              {t('footer.privacy')}
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              {t('footer.contact')}
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
