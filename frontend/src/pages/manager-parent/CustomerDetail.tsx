import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { customerService } from '@/services/customer.service'
import { IpLocationCell } from '@/utils/countryFlag'

export function CustomerDetailPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)

  const query = useQuery({
    queryKey: ['manager-parent', 'customer-detail', customerId],
    queryFn: () => customerService.getOne(customerId),
    enabled: Number.isFinite(customerId),
  })

  const customer = query.data?.data

  return (
    <div className="space-y-6">
      <PageHeader title={customer?.name ?? t('managerParent.pages.customers.customerDetails')} description={customer?.email ?? t('managerParent.pages.customers.customerDetailsDescription')} />

      {customer ? (
        <>
          <Card>
            <CardHeader><CardTitle>{t('managerParent.pages.customers.customerDetails')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Info label={t('common.name')} value={customer.name} />
              <Info label={t('common.email')} value={customer.email} />
              <Info label={t('common.username')} value={customer.username ?? '-'} />
              <Info label={t('common.phone')} value={customer.phone ?? '-'} />
              <Info label={t('common.status')} value={customer.status ? <StatusBadge status={customer.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} /> : '-'} />
              <Info label={t('common.createdAt')} value={customer.created_at ? formatDate(customer.created_at, locale) : '-'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('managerParent.pages.customers.licenseHistory')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(customer.licenses ?? []).map((license) => (
                <div key={license.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="grid gap-2 md:grid-cols-4">
                    <Info label={t('common.program')} value={license.program ?? '-'} />
                    <Info label={t('managerParent.pages.customers.biosId')} value={`${license.bios_id}${license.external_username ? `\n@${license.external_username}` : ''}`} />
                    <Info label={t('common.reseller')} value={license.reseller ?? '-'} />
                    <Info label={t('common.status')} value={<StatusBadge status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} />} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('common.reseller')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(customer.resellers_summary ?? []).map((reseller) => (
                <div key={`${reseller.reseller_id}-${reseller.reseller_email}`} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                  <p className="font-medium">{reseller.reseller_name ?? '-'}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{reseller.reseller_email ?? '-'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{reseller.activations_count} activations</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('managerParent.pages.ipAnalytics.title')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(customer.ip_logs ?? []).map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                  <p className="font-medium">{log.ip_address}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400"><IpLocationCell country={log.country ?? 'Unknown'} city={log.city ?? ''} countryCode={log.country_code ?? ''} /></p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{log.created_at ? formatDate(log.created_at, locale) : '-'}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('managerParent.nav.activity')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(customer.activity ?? []).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                  <p className="font-medium">{entry.action}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{entry.description ?? '-'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-line font-medium">{value}</p>
    </div>
  )
}
