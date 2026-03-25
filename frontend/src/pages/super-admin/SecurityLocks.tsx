import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/shared/EmptyState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { securityService } from '@/services/security.service'
import { IpLocationCell } from '@/utils/countryFlag'
import { formatActivityActionLabel, formatDate } from '@/lib/utils'
import { useLanguage } from '@/hooks/useLanguage'
import type { SecurityAuditLog } from '@/types/super-admin.types'

export function SecurityLocksPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [tab, setTab] = useState<'locked' | 'blocked' | 'audit'>('locked')

  const locksQuery = useQuery({
    queryKey: ['super-admin', 'security-locks'],
    queryFn: () => securityService.getLocks(),
    refetchInterval: 30000,
  })

  const auditQuery = useQuery({
    queryKey: ['super-admin', 'security-audit-log'],
    queryFn: () => securityService.getAuditLog({ per_page: 50 }),
    refetchInterval: 30000,
  })

  const unblockEmailMutation = useMutation({
    mutationFn: (email: string) => securityService.unblockEmail(email),
    onSuccess: () => {
      toast.success(t('security.unblockedEmail'))
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'security-locks'] })
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'security-audit-log'] })
    },
  })

  const unblockIpMutation = useMutation({
    mutationFn: (ip: string) => securityService.unblockIp(ip),
    onSuccess: () => {
      toast.success(t('security.unblockedIp'))
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'security-locks'] })
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'security-audit-log'] })
    },
  })

  const lockedAccounts = locksQuery.data?.locked_accounts ?? []
  const blockedIps = locksQuery.data?.blocked_ips ?? []
  const auditRows = useMemo<SecurityAuditLog[]>(() => auditQuery.data?.data ?? [], [auditQuery.data?.data])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('superAdmin.pages.securityLocks.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.securityLocks.description')}</p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'locked' | 'blocked' | 'audit')}>
        <TabsList>
          <TabsTrigger value="locked">{t('security.lockedAccounts')}</TabsTrigger>
          <TabsTrigger value="blocked">{t('security.blockedIps')}</TabsTrigger>
          <TabsTrigger value="audit">{t('security.auditLog')}</TabsTrigger>
        </TabsList>

        <TabsContent value="locked">
          <Card>
            <CardHeader>
              <CardTitle>{t('security.lockedAccounts')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-start dark:border-slate-800">
                      <th className="p-2">{t('common.email')}</th>
                      <th className="p-2">{t('security.device')}</th>
                      <th className="p-2">{t('security.lastIp')}</th>
                      <th className="p-2">{t('security.country')}</th>
                      <th className="p-2">{t('security.isp')}</th>
                      <th className="p-2">{t('security.attempts')}</th>
                      <th className="p-2">{t('security.retryAfter')}</th>
                      <th className="p-2">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lockedAccounts.map((row) => (
                      <tr key={row.email} className="border-b border-slate-100 dark:border-slate-900">
                        <td className="p-2">{row.email}</td>
                        <td className="p-2">{row.device}</td>
                        <td className="p-2">{row.ip}</td>
                        <td className="p-2"><IpLocationCell country={row.country_name} city={row.city} countryCode={row.country_code ?? ''} /></td>
                        <td className="p-2">{row.isp || '-'}</td>
                        <td className="p-2">{row.attempt_count}</td>
                        <td className="p-2">{row.seconds_remaining}s</td>
                        <td className="p-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => unblockEmailMutation.mutate(row.email)}
                            disabled={unblockEmailMutation.isPending}
                          >
                            {t('security.unblock')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {lockedAccounts.length === 0 ? <EmptyState title={t('common.noData')} description={t('common.adjustFilters')} /> : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked">
          <Card>
            <CardHeader>
              <CardTitle>{t('security.blockedIps')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-start dark:border-slate-800">
                      <th className="p-2">{t('security.lastIp')}</th>
                      <th className="p-2">{t('security.device')}</th>
                      <th className="p-2">{t('security.country')}</th>
                      <th className="p-2">{t('security.isp')}</th>
                      <th className="p-2">{t('common.createdAt')}</th>
                      <th className="p-2">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedIps.map((row) => (
                      <tr key={row.ip} className="border-b border-slate-100 dark:border-slate-900">
                        <td className="p-2">{row.ip}</td>
                        <td className="p-2">{row.device}</td>
                        <td className="p-2"><IpLocationCell country={row.country_name} city={row.city} countryCode={row.country_code ?? ''} /></td>
                        <td className="p-2">{row.isp || '-'}</td>
                        <td className="p-2">{row.blocked_at ? formatDate(row.blocked_at, locale) : '-'}</td>
                        <td className="p-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => unblockIpMutation.mutate(row.ip)}
                            disabled={unblockIpMutation.isPending}
                          >
                            {t('security.unblock')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {blockedIps.length === 0 ? <EmptyState title={t('common.noData')} description={t('common.adjustFilters')} /> : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>{t('security.auditLog')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-start dark:border-slate-800">
                      <th className="p-2">{t('common.timestamp')}</th>
                      <th className="p-2">{t('common.user')}</th>
                      <th className="p-2">{t('common.action')}</th>
                      <th className="p-2">{t('security.target')}</th>
                      <th className="p-2">{t('security.adminIp')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.map((row) => {
                      const target = String((row.metadata.unblocked_ip as string | undefined) ?? (row.metadata.unblocked_email as string | undefined) ?? (row.metadata.blocked_ip as string | undefined) ?? '-')
                      return (
                        <tr key={row.id} className="border-b border-slate-100 dark:border-slate-900">
                          <td className="p-2">{row.created_at ? formatDate(row.created_at, locale) : '-'}</td>
                          <td className="p-2">{row.admin?.name ?? 'System'}</td>
                          <td className="p-2">{formatActivityActionLabel(row.action, t)}</td>
                          <td className="p-2">{target}</td>
                          <td className="p-2">{row.admin_ip ?? '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {auditRows.length === 0 ? <EmptyState title={t('common.noData')} description={t('common.adjustFilters')} /> : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
