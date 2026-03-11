import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { resellerService } from '@/services/reseller.service'

export function CustomerDetailPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)

  const query = useQuery({
    queryKey: ['reseller', 'customer-detail', customerId],
    queryFn: () => resellerService.getCustomer(customerId),
    enabled: Number.isFinite(customerId),
    ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_DETAIL),
  })

  const customer = query.data?.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start">
        <Button type="button" variant="outline" onClick={() => navigate(routePaths.reseller.customers(lang))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>
      <PageHeader
        eyebrow={t('roles.reseller')}
        title={customer?.name ?? t('reseller.pages.customers.title')}
        description={resolveCustomerDetailUsername(customer) ?? customer?.phone ?? t('reseller.pages.customers.description')}
      />

      {customer ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('common.customer')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Info label={t('common.name')} value={customer.name} />
              <Info label={t('common.email')} value={customer.email ?? '-'} />
              <Info label={t('common.phone')} value={customer.phone ?? '-'} />
              <Info label={t('common.username')} value={resolveCustomerDetailUsername(customer) ?? '-'} />
              <Info label={t('reseller.pages.customers.table.bios')} value={customer.bios_id ?? '-'} />
              <Info
                label={t('common.status')}
                value={<StatusBadge status={customer.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'cancelled'} />}
              />
              <Info label={t('common.program')} value={customer.program ?? '-'} />
              <Info label={t('common.price')} value={formatCurrency(customer.price, 'USD', locale)} />
              <Info label={t('common.expiry')} value={customer.expiry ? formatDate(customer.expiry, locale) : '-'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('reseller.pages.customers.detail.activationHistory')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(customer.licenses ?? []).map((license) => (
                <div key={license.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="grid gap-4 md:grid-cols-5">
                    <Info label={t('common.program')} value={license.program ?? '-'} />
                    <Info label={t('reseller.pages.customers.detail.bios')} value={license.bios_id} />
                    <Info label={t('common.username')} value={resolveLicenseUsername(customer) ?? '-'} />
                    <Info
                      label={t('common.status')}
                      value={<StatusBadge status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'cancelled'} />}
                    />
                    <Info label={t('common.price')} value={formatCurrency(license.price, 'USD', locale)} />
                    <Info label={t('common.expiry')} value={license.expires_at ? formatDate(license.expires_at, locale) : '-'} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function resolveCustomerDetailUsername(customer: { external_username?: string | null; username?: string | null } | undefined) {
  return customer?.external_username || customer?.username || null
}

function resolveLicenseUsername(customer: { name?: string | null; client_name?: string | null; external_username?: string | null; username?: string | null } | undefined) {
  const candidate = customer?.external_username?.trim()
  const storedUsername = customer?.username?.trim()

  if (candidate && candidate !== customer?.name && candidate !== customer?.client_name) {
    return candidate
  }

  return storedUsername || candidate || null
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-line font-medium">{value}</p>
    </div>
  )
}
