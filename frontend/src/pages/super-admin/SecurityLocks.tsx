import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [manualEmail, setManualEmail] = useState('')
  const [manualIp, setManualIp] = useState('')

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
      setManualEmail('')
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'security-locks'] })
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'security-audit-log'] })
    },
  })

  const unblockIpMutation = useMutation({
    mutationFn: (ip: string) => securityService.unblockIp(ip),
    onSuccess: () => {
      toast.success(t('security.unblockedIp'))
      setManualIp('')
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'security-locks'] })
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'security-audit-log'] })
    },
  })

  const lockedAccounts = locksQuery.data?.locked_accounts ?? []
  const blockedIps = locksQuery.data?.blocked_ips ?? []
  const auditRows = useMemo<SecurityAuditLog[]>(() => auditQuery.data?.data ?? [], [auditQuery.data?.data])
  const lockedColumns = useMemo<Array<DataTableColumn<(typeof lockedAccounts)[number]>>>(() => [
    { key: 'email', label: t('common.email'), sortable: true, sortValue: (row) => row.email, render: (row) => row.email },
    { key: 'device', label: t('security.device'), sortable: true, sortValue: (row) => row.device, render: (row) => row.device },
    { key: 'ip', label: t('security.lastIp'), sortable: true, sortValue: (row) => row.ip, render: (row) => row.ip },
    { key: 'country', label: t('security.country'), sortable: true, sortValue: (row) => `${row.country_name ?? ''}${row.city ?? ''}`, render: (row) => <IpLocationCell country={row.country_name} city={row.city} countryCode={row.country_code ?? ''} /> },
    { key: 'isp', label: t('security.isp'), sortable: true, sortValue: (row) => row.isp ?? '', render: (row) => row.isp || '-' },
    { key: 'attempts', label: t('security.attempts'), sortable: true, sortValue: (row) => row.attempt_count, render: (row) => row.attempt_count },
    { key: 'retry_after', label: t('security.retryAfter'), sortable: true, sortValue: (row) => row.seconds_remaining, render: (row) => `${row.seconds_remaining}s` },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => (
        <Button type="button" size="sm" onClick={() => unblockEmailMutation.mutate(row.email)} disabled={unblockEmailMutation.isPending}>
          {t('security.unblock')}
        </Button>
      ),
    },
  ], [t, unblockEmailMutation])
  const blockedColumns = useMemo<Array<DataTableColumn<(typeof blockedIps)[number]>>>(() => [
    { key: 'ip', label: t('security.lastIp'), sortable: true, sortValue: (row) => row.ip, render: (row) => row.ip },
    { key: 'device', label: t('security.device'), sortable: true, sortValue: (row) => row.device, render: (row) => row.device },
    { key: 'country', label: t('security.country'), sortable: true, sortValue: (row) => `${row.country_name ?? ''}${row.city ?? ''}`, render: (row) => <IpLocationCell country={row.country_name} city={row.city} countryCode={row.country_code ?? ''} /> },
    { key: 'isp', label: t('security.isp'), sortable: true, sortValue: (row) => row.isp ?? '', render: (row) => row.isp || '-' },
    { key: 'blocked_at', label: t('common.createdAt'), sortable: true, sortValue: (row) => row.blocked_at ?? '', render: (row) => row.blocked_at ? formatDate(row.blocked_at, locale) : '-' },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => (
        <Button type="button" size="sm" onClick={() => unblockIpMutation.mutate(row.ip)} disabled={unblockIpMutation.isPending}>
          {t('security.unblock')}
        </Button>
      ),
    },
  ], [locale, t, unblockIpMutation])
  const auditColumns = useMemo<Array<DataTableColumn<SecurityAuditLog>>>(() => [
    { key: 'created_at', label: t('common.timestamp'), sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => row.created_at ? formatDate(row.created_at, locale) : '-' },
    { key: 'admin', label: t('common.user'), sortable: true, sortValue: (row) => row.admin?.name ?? 'System', render: (row) => row.admin?.name ?? 'System' },
    { key: 'action', label: t('common.action'), sortable: true, sortValue: (row) => row.action, render: (row) => formatActivityActionLabel(row.action, t) },
    {
      key: 'target',
      label: t('security.target'),
      sortable: true,
      sortValue: (row) => String((row.metadata.unblocked_ip as string | undefined) ?? (row.metadata.unblocked_email as string | undefined) ?? (row.metadata.blocked_ip as string | undefined) ?? '-'),
      render: (row) => String((row.metadata.unblocked_ip as string | undefined) ?? (row.metadata.unblocked_email as string | undefined) ?? (row.metadata.blocked_ip as string | undefined) ?? '-'),
    },
    { key: 'admin_ip', label: t('security.adminIp'), sortable: true, sortValue: (row) => row.admin_ip ?? '', render: (row) => row.admin_ip ?? '-' },
  ], [locale, t])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('superAdmin.pages.securityLocks.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.securityLocks.description')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('security.quickResetAccount', { defaultValue: 'Quick Reset Account Lock' })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('security.quickResetAccountHint', { defaultValue: 'Clear a locked login immediately by email, even if the row is not visible yet.' })}
            </p>
            <Input
              type="email"
              value={manualEmail}
              onChange={(event) => setManualEmail(event.target.value)}
              placeholder={t('security.emailPlaceholder', { defaultValue: 'user@example.com' })}
            />
            <Button
              type="button"
              onClick={() => unblockEmailMutation.mutate(manualEmail.trim())}
              disabled={unblockEmailMutation.isPending || manualEmail.trim().length === 0}
            >
              {t('security.unblockAccountNow', { defaultValue: 'Reset Account Lock Now' })}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('security.quickResetIp', { defaultValue: 'Quick Reset IP Block' })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('security.quickResetIpHint', { defaultValue: 'Remove an IP or device block immediately if repeated login attempts triggered a wait.' })}
            </p>
            <Input
              value={manualIp}
              onChange={(event) => setManualIp(event.target.value)}
              placeholder={t('security.ipPlaceholder', { defaultValue: '127.0.0.1' })}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => unblockIpMutation.mutate(manualIp.trim())}
              disabled={unblockIpMutation.isPending || manualIp.trim().length === 0}
            >
              {t('security.unblockIpNow', { defaultValue: 'Reset IP Block Now' })}
            </Button>
          </CardContent>
        </Card>
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
              <DataTable
                tableKey="super_admin_security_locks_locked_accounts"
                columns={lockedColumns}
                data={lockedAccounts}
                rowKey={(row) => row.email}
                emptyMessage={t('common.noData')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked">
          <Card>
            <CardHeader>
              <CardTitle>{t('security.blockedIps')}</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                tableKey="super_admin_security_locks_blocked_ips"
                columns={blockedColumns}
                data={blockedIps}
                rowKey={(row) => row.ip}
                emptyMessage={t('common.noData')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>{t('security.auditLog')}</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                tableKey="super_admin_security_locks_audit"
                columns={auditColumns}
                data={auditRows}
                rowKey={(row) => row.id}
                emptyMessage={t('common.noData')}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
