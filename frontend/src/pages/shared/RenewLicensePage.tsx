import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { RenewLicenseForm } from '@/components/licenses/RenewLicenseForm'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { apiCache } from '@/lib/apiCache'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import { getLicenseDisplayStatus, isPausedPendingLicense, isPlainPendingLicense } from '@/lib/utils'
import { licenseService } from '@/services/license.service'
import { programService } from '@/services/program.service'
import type { RenewLicenseData } from '@/types/manager-reseller.types'

interface RenewLicensePageProps {
  defaultBackPath: (lang: 'ar' | 'en') => string
  invalidateQueryKey: readonly unknown[]
  eyebrow: string
  cachePattern?: RegExp
  activeLicenseTitle?: string
  presetOnly?: boolean
}

export function RenewLicensePage({
  defaultBackPath,
  invalidateQueryKey,
  eyebrow,
  cachePattern,
  activeLicenseTitle,
  presetOnly = false,
}: RenewLicensePageProps) {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const licenseId = Number(id)

  // Validate returnTo to prevent navigation to arbitrary paths
  const isValidPath = (path: string | null | undefined): path is string => {
    if (!path) return false
    return path.startsWith(`/${lang}/`)
  }

  const stateReturnTo = (location.state as { returnTo?: string } | null)?.returnTo
  const queryReturnTo = searchParams.get('returnTo')
  const returnTo: string = isValidPath(stateReturnTo) ? stateReturnTo : (isValidPath(queryReturnTo) ? queryReturnTo : defaultBackPath(lang))

  const licenseQuery = useQuery({
    queryKey: [...invalidateQueryKey, 'license-renew', licenseId],
    queryFn: () => licenseService.getById(licenseId),
    enabled: Number.isFinite(licenseId) && licenseId > 0,
    retry: false,
    ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_DETAIL),
  })

  const license = licenseQuery.data?.data
  const resellerProgramsQuery = useQuery({
    queryKey: ['license-renew', 'programs', license?.program_id],
    queryFn: () => programService.getAll({ per_page: 100, status: 'active' }),
    enabled: presetOnly && Boolean(license?.program_id),
    staleTime: 60_000,
  })
  const resellerPresetOptions = useMemo(() => {
    if (!presetOnly || !license?.program_id) {
      return []
    }

    const program = resellerProgramsQuery.data?.data.find((item) => item.id === license.program_id)
    return program?.duration_presets ?? []
  }, [license?.program_id, presetOnly, resellerProgramsQuery.data?.data])
  const displayStatus = license ? getLicenseDisplayStatus(license) : null
  const isScheduleEdit = displayStatus === 'scheduled' || displayStatus === 'scheduled_failed'
  const isPendingActivation = Boolean(license && isPlainPendingLicense(license))
  // Allow scheduling for: edit mode, pending activation, or renewing expired/cancelled licenses
  const allowScheduleControls = isScheduleEdit || isPendingActivation || (license && ['expired', 'cancelled'].includes(license.status))
  const title = displayStatus === 'active'
    ? (activeLicenseTitle ?? t('common.increaseDuration', { defaultValue: 'Increase Duration' }))
    : isScheduleEdit
      ? t('common.editSchedule', { defaultValue: 'Edit Schedule' })
      : license && isPausedPendingLicense(license)
        ? t('common.continue', { defaultValue: 'Continue' })
        : license && isPlainPendingLicense(license)
          ? t('common.activate', { defaultValue: 'Activate' })
          : t('common.renew')
  const description = license
    ? t('reseller.pages.licenses.renewDialog.description', {
        defaultValue: 'Renew {{program}} for BIOS ID {{biosId}}.',
        program: license.program ?? t('common.program'),
        biosId: license.bios_id ?? '-',
      })
    : t('reseller.pages.licenses.renewDialog.fallback', {
        defaultValue: 'Update the license schedule, duration, and price.',
      })

  const renewMutation = useMutation({
    mutationFn: (payload: RenewLicenseData) => licenseService.renew(licenseId, payload),
    onSuccess: (_data, payload) => {
      if (cachePattern) {
        apiCache.clearPattern(cachePattern)
      }

      void queryClient.invalidateQueries({ queryKey: invalidateQueryKey })
      toast.success(
        isScheduleEdit
          ? t('common.scheduleUpdatedSuccess', { defaultValue: 'Schedule updated successfully.' })
          : payload.is_scheduled
            ? t('common.activationScheduledSuccess', { defaultValue: 'Activation scheduled successfully.' })
          : t('common.licenseRenewedSuccess', { defaultValue: 'License renewed successfully.' }),
      )
      navigate(returnTo, { replace: true })
    },
    onError: (error: unknown) => {
      toast.error(resolveApiErrorMessage(error, t('common.error')))
    },
  })

  const autoPricePerDay = useMemo(() => {
    if (!license) {
      return 0
    }

    if (license.duration_days > 0) {
      return license.price / license.duration_days
    }

    return 0
  }, [license])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start">
        <Button type="button" variant="outline" onClick={() => navigate(returnTo)}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>

      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {licenseQuery.isLoading || (presetOnly && resellerProgramsQuery.isLoading) ? <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p> : null}
          {!licenseQuery.isLoading && licenseQuery.isError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {resolveApiErrorMessage(licenseQuery.error, t('common.noData'))}
            </p>
          ) : null}
          {presetOnly && !resellerProgramsQuery.isLoading && resellerProgramsQuery.isError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {resolveApiErrorMessage(resellerProgramsQuery.error, t('common.noData'))}
            </p>
          ) : null}
          {!licenseQuery.isLoading && !license ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{t('common.noData')}</p>
          ) : null}
          {license ? (
            <RenewLicenseForm
              confirmLabel={title}
              confirmLoadingLabel={t('common.loading')}
              cancelLabel={t('common.cancel')}
              onSubmit={(payload) => renewMutation.mutate(payload)}
              onCancel={() => navigate(returnTo)}
              isPending={renewMutation.isPending}
              anchorDate={license.expires_at}
              initialPrice={license.price ?? 0}
              autoPricePerDay={autoPricePerDay}
              initialScheduledAt={license.scheduled_at}
              initialScheduledTimezone={license.scheduled_timezone}
              initialExpiresAt={license.expires_at}
              resetKey={license.id}
              presetOnly={presetOnly}
              presetOptions={resellerPresetOptions}
              allowScheduleControls={allowScheduleControls}
              requireScheduled={isScheduleEdit}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
