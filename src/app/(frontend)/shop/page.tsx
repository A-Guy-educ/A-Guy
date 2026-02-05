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
        color: 'font-bold text-blue-600',
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
        color: 'font-bold text-blue-600',
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
      badgeColor: 'bg-[#8B1D25] font-black',
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
        color: 'font-bold text-[#8B1D25]',
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
      badgeColor: 'text-blue-500',
      title: t('courses.mathBasics'),
      description: t('courses.grade7Description'),
      price: 149,
      icon: 'book' as const,
      iconBgColor: 'bg-blue-50',
      buttonText: t('courses.purchaseCourse'),
      buttonStyle: 'purchase' as const,
    },
    {
      badge: t('courses.grade8'),
      badgeColor: 'text-blue-500',
      title: t('courses.mathBasics'),
      description: t('courses.grade8Description'),
      price: 149,
      icon: 'check' as const,
      iconBgColor: 'bg-green-50',
      buttonText: t('courses.purchasedSuccessfully'),
      buttonStyle: 'owned' as const,
      isOwned: true,
    },
    {
      badge: t('courses.grade9'),
      badgeColor: 'text-blue-500',
      title: t('courses.mathBasics'),
      description: t('courses.grade9Description'),
      price: 159,
      icon: 'graduation' as const,
      iconBgColor: 'bg-blue-50',
      buttonText: t('courses.purchaseCourse'),
      buttonStyle: 'purchase' as const,
    },
  ]

  const highSchoolCourses = [
    {
      badge: 'כיתה י\' • 3 יח"ל',
      badgeColor: 'text-red-500',
      title: t('courses.questionnaire172'),
      description: t('courses.questionnaire172Description'),
      price: 199,
      icon: 'book' as const,
      iconBgColor: 'bg-red-50',
      buttonText: t('courses.purchaseCourse'),
      buttonStyle: 'purchase' as const,
    },
    {
      badge: 'כיתה י"א • 4 יח"ל',
      badgeColor: 'text-orange-500',
      title: t('courses.questionnaire471'),
      description: t('courses.questionnaire471Description'),
      price: 279,
      icon: 'book' as const,
      iconBgColor: 'bg-orange-50',
      buttonText: t('courses.purchaseCourse'),
      buttonStyle: 'purchase' as const,
    },
    {
      badge: 'כיתה י"ב • 5 יח"ל',
      badgeColor: 'text-purple-500',
      title: t('courses.questionnaire572'),
      description: t('courses.questionnaire572Description'),
      price: 299,
      icon: 'book' as const,
      iconBgColor: 'bg-purple-50',
      buttonText: t('courses.purchaseCourse'),
      buttonStyle: 'purchase' as const,
    },
  ]

  return (
    <div className="min-h-screen text-gray-800 antialiased" dir="rtl">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 py-2 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <SystemLink
            href="/"
            className="flex items-center gap-2 text-gray-500 hover:text-[#8B1D25] transition-colors text-sm"
          >
            <ArrowRight className="w-4 h-4" />
            <span>{t('backToLearning')}</span>
          </SystemLink>
        </div>

        <div className="flex items-center gap-2 cursor-pointer">
          <span className="text-[#8B1D25]" style={{ fontSize: '24px', fontWeight: 900 }}>
            buyguy
          </span>
          <div className="w-8 h-8 bg-[#5A7D5B] rounded-full flex items-center justify-center shadow-sm">
            <Telescope className="w-5 h-5 text-white" />
          </div>
        </div>
      </nav>

      {/* Store Header */}
      <header className="bg-white border-b border-gray-100 pt-12 pb-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1
            className="text-gray-900 mb-4 whitespace-nowrap"
            style={{ fontSize: '40px', fontWeight: 900 }}
          >
            {t('title')}
          </h1>
          <p className="text-gray-500 max-w-2xl mx-auto" style={{ fontSize: '18px' }}>
            {t('subtitle')}
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Membership Plans Section */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <h2
              className="text-gray-800 uppercase tracking-widest"
              style={{ fontSize: '24px', fontWeight: 900 }}
            >
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
            <h2
              className="text-gray-800 uppercase tracking-widest"
              style={{ fontSize: '24px', fontWeight: 900 }}
            >
              {t('courseCatalog')}
            </h2>
          </div>

          {/* Catalog Filter Tabs */}
          <div className="max-w-md mx-auto mb-12">
            <div className="bg-gray-200/60 p-1.5 rounded-2xl flex items-center shadow-inner">
              <button
                onClick={() => setActiveCatalog('middle')}
                className={`flex-1 py-3 rounded-xl transition-all ${
                  activeCatalog === 'middle'
                    ? 'bg-white text-[#8B1D25] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                style={{
                  fontSize: '14px',
                  fontWeight: activeCatalog === 'middle' ? 900 : 700,
                }}
              >
                {t('middleSchool')}
              </button>
              <button
                onClick={() => setActiveCatalog('high')}
                className={`flex-1 py-3 rounded-xl transition-all ${
                  activeCatalog === 'high'
                    ? 'bg-white text-[#8B1D25] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                style={{
                  fontSize: '14px',
                  fontWeight: activeCatalog === 'high' ? 900 : 700,
                }}
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
        <footer className="mt-24 pt-12 border-t border-gray-100 text-center">
          <p
            className="text-gray-300 uppercase mb-6"
            style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.4em' }}
          >
            {t('footer.platform')}
          </p>
          <div
            className="flex justify-center gap-6 text-gray-400"
            style={{ fontSize: '14px', fontWeight: 500 }}
          >
            <a href="#" className="hover:text-[#8B1D25] transition-colors">
              {t('footer.terms')}
            </a>
            <a href="#" className="hover:text-[#8B1D25] transition-colors">
              {t('footer.privacy')}
            </a>
            <a href="#" className="hover:text-[#8B1D25] transition-colors">
              {t('footer.contact')}
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
