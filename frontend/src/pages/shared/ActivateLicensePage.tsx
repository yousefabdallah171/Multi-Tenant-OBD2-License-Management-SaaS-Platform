import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ActivateLicenseForm } from '@/components/activation/ActivateLicenseForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { programService } from '@/services/program.service'

interface ActivateLicensePageProps {
  defaultBackPath: (lang: 'ar' | 'en') => string
}

export function ActivateLicensePage({ defaultBackPath }: ActivateLicensePageProps) {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  const programId = Number(id)
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? defaultBackPath(lang)

  const programQuery = useQuery({
    queryKey: ['activation-program', programId],
    queryFn: () => programService.getById(programId),
    enabled: Number.isFinite(programId) && programId > 0,
  })

  const activationProgram = useMemo(() => {
    const program = programQuery.data?.data
    if (!program) {
      return null
    }

    return {
      id: program.id,
      name: program.name,
      price_per_day: program.base_price,
      has_external_api: program.has_external_api,
      external_software_id: program.external_software_id,
    }
  }, [programQuery.data?.data])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(returnTo)}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('activate.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {programQuery.isLoading ? <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p> : null}
          {!programQuery.isLoading && !activationProgram ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{t('common.noData')}</p>
          ) : null}
          {activationProgram ? (
            <ActivateLicenseForm
              program={activationProgram}
              onCancel={() => navigate(returnTo)}
              onSuccess={() => navigate(returnTo)}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

