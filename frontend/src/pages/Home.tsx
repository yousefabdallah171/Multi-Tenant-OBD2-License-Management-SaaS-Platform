import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/hooks/useLanguage'
import { healthCheck } from '@/services/api'

export function Home() {
  const { t } = useTranslation()
  const { lang, switchLanguage, isRtl } = useLanguage()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['api-health'],
    queryFn: healthCheck,
    retry: 0,
  })

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <section className={`mx-auto max-w-3xl px-6 py-20 ${isRtl ? 'text-right' : 'text-left'}`}>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{t('subtitle')}</p>

        <div className="mt-6 flex gap-2">
          <button
            className="rounded bg-slate-900 px-3 py-2 text-white dark:bg-slate-100 dark:text-slate-900"
            onClick={switchLanguage}
            type="button"
          >
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-medium">{t('health.label')}</p>
          {isLoading ? <p className="mt-2">{t('health.loading')}</p> : null}
          {isError ? <p className="mt-2 text-red-500">{t('health.error')}</p> : null}
          {data ? (
            <div className="mt-2 text-sm">
              <p>
                <strong>{t('health.status')}:</strong> {data.status}
              </p>
              <p>
                <strong>{t('health.language')}:</strong> {lang}
              </p>
              <p>
                <strong>{t('health.app')}:</strong> {data.app}
              </p>
              <p>
                <strong>{t('health.time')}:</strong> {data.timestamp}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
