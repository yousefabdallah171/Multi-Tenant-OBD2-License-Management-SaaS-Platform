import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { pricingService } from '@/services/pricing.service'
import type { PricingHistoryEntry, PricingRow } from '@/types/manager-parent.types'

interface BulkState {
  resellerIds: number[]
  mode: 'fixed' | 'markup'
  value: string
  commissionRate: string
}

export function ResellerPricingPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [selectedResellerId, setSelectedResellerId] = useState<number | null>(null)
  const [editingRowId, setEditingRowId] = useState<number | null>(null)
  const [editingPrice, setEditingPrice] = useState('')
  const [editingCommission, setEditingCommission] = useState('0')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulk, setBulk] = useState<BulkState>({
    resellerIds: [],
    mode: 'markup',
    value: '',
    commissionRate: '0',
  })

  const pricingQuery = useQuery({
    queryKey: ['manager-parent', 'pricing', selectedResellerId],
    queryFn: () => pricingService.getAll(selectedResellerId),
  })

  const historyQuery = useQuery({
    queryKey: ['manager-parent', 'pricing-history', selectedResellerId],
    queryFn: () => pricingService.history(selectedResellerId ? { reseller_id: selectedResellerId, limit: 20 } : { limit: 20 }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ programId, resellerId, resellerPrice, commissionRate }: { programId: number; resellerId: number; resellerPrice: number; commissionRate: number }) =>
      pricingService.update(programId, {
        reseller_id: resellerId,
        reseller_price: resellerPrice,
        commission_rate: commissionRate,
      }),
    onSuccess: () => {
      toast.success(t('managerParent.pages.resellerPricing.updateSuccess'))
      setEditingRowId(null)
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'pricing'] })
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'pricing-history'] })
    },
  })

  const bulkMutation = useMutation({
    mutationFn: () =>
      pricingService.bulk({
        reseller_ids: bulk.resellerIds,
        mode: bulk.mode,
        value: Number(bulk.value),
        commission_rate: Number(bulk.commissionRate || '0'),
      }),
    onSuccess: (data) => {
      toast.success(t('managerParent.pages.resellerPricing.bulkSuccess', { count: data.updated }))
      setBulkOpen(false)
      setBulk({
        resellerIds: [],
        mode: 'markup',
        value: '',
        commissionRate: '0',
      })
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'pricing'] })
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'pricing-history'] })
    },
  })

  const payload = pricingQuery.data?.data
  const selectedId = selectedResellerId ?? payload?.selected_reseller_id ?? null

  useEffect(() => {
    if (selectedResellerId === null && payload?.resellers?.length) {
      setSelectedResellerId(payload.resellers[0].id)
    }
  }, [payload?.resellers, selectedResellerId])

  const columns = useMemo<Array<DataTableColumn<PricingRow>>>(
    () => [
      {
        key: 'program',
        label: t('common.program'),
        sortable: true,
        sortValue: (row) => row.program_name,
        render: (row) => row.program_name,
      },
      {
        key: 'basePrice',
        label: t('managerParent.pages.resellerPricing.basePrice'),
        sortable: true,
        sortValue: (row) => row.base_price,
        render: (row) => formatCurrency(row.base_price, 'USD', locale),
      },
      {
        key: 'resellerPrice',
        label: t('managerParent.pages.resellerPricing.resellerPrice'),
        sortable: true,
        sortValue: (row) => row.reseller_price,
        render: (row) =>
          editingRowId === row.program_id ? (
            <Input value={editingPrice} onChange={(event) => setEditingPrice(event.target.value)} className="h-9 w-28" />
          ) : (
            formatCurrency(row.reseller_price, 'USD', locale)
          ),
      },
      {
        key: 'margin',
        label: t('managerParent.pages.resellerPricing.margin'),
        sortable: true,
        sortValue: (row) => row.base_price > 0 ? ((row.reseller_price - row.base_price) / row.base_price) * 100 : 0,
        render: (row) => `${row.base_price > 0 ? (((row.reseller_price - row.base_price) / row.base_price) * 100).toFixed(1) : '0.0'}%`,
      },
      {
        key: 'commission',
        label: t('managerParent.pages.resellerPricing.commission'),
        sortable: true,
        sortValue: (row) => row.commission_rate,
        render: (row) =>
          editingRowId === row.program_id ? (
            <Input value={editingCommission} onChange={(event) => setEditingCommission(event.target.value)} className="h-9 w-24" />
          ) : (
            `${row.commission_rate.toFixed(1)}%`
          ),
      },
      {
        key: 'actions',
        label: t('common.actions'),
        render: (row) =>
          editingRowId === row.program_id ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!selectedId) {
                    toast.error(t('managerParent.pages.resellerPricing.selectResellerFirst'))
                    return
                  }

                  updateMutation.mutate({
                    programId: row.program_id,
                    resellerId: selectedId,
                    resellerPrice: Number(editingPrice),
                    commissionRate: Number(editingCommission || '0'),
                  })
                }}
              >
                {t('common.save')}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingRowId(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingRowId(row.program_id)
                setEditingPrice(String(row.reseller_price))
                setEditingCommission(String(row.commission_rate))
              }}
            >
              {t('common.edit')}
            </Button>
          ),
      },
    ],
    [editingCommission, editingPrice, editingRowId, locale, selectedId, t, updateMutation],
  )

  const historyColumns = useMemo<Array<DataTableColumn<PricingHistoryEntry>>>(
    () => [
      { key: 'time', label: t('common.timestamp'), sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-') },
      { key: 'program', label: t('common.program'), sortable: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
      { key: 'oldPrice', label: t('managerParent.pages.resellerPricing.oldPrice'), sortable: true, sortValue: (row) => row.old_price ?? 0, render: (row) => formatCurrency(row.old_price ?? 0, 'USD', locale) },
      { key: 'newPrice', label: t('managerParent.pages.resellerPricing.newPrice'), sortable: true, sortValue: (row) => row.new_price, render: (row) => formatCurrency(row.new_price, 'USD', locale) },
      { key: 'changedBy', label: t('managerParent.pages.resellerPricing.changedBy'), sortable: true, sortValue: (row) => row.changed_by ?? '', render: (row) => row.changed_by ?? '-' },
    ],
    [locale, t],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('managerParent.pages.resellerPricing.title')}
        description={t('managerParent.pages.resellerPricing.description')}
        actions={
          <Button type="button" onClick={() => setBulkOpen(true)}>
            {t('managerParent.pages.resellerPricing.bulkUpdate')}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="space-y-2">
            <Label htmlFor="reseller-select">{t('common.reseller')}</Label>
            <select
              id="reseller-select"
              value={selectedId ?? ''}
              onChange={(event) => setSelectedResellerId(event.target.value ? Number(event.target.value) : null)}
              className="h-11 min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {(payload?.resellers ?? []).map((reseller) => (
                <option key={reseller.id} value={reseller.id}>
                  {reseller.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={payload?.programs ?? []} rowKey={(row) => row.program_id} isLoading={pricingQuery.isLoading} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('managerParent.pages.resellerPricing.pricingHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={historyColumns} data={historyQuery.data?.data ?? []} rowKey={(row) => row.id} isLoading={historyQuery.isLoading} />
        </CardContent>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('managerParent.pages.resellerPricing.bulkUpdateTitle')}</DialogTitle>
            <DialogDescription>{t('managerParent.pages.resellerPricing.bulkUpdateDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>{t('managerParent.pages.resellerPricing.resellers')}</Label>
              <div className="grid max-h-48 gap-2 overflow-y-auto rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                {(payload?.resellers ?? []).map((reseller) => {
                  const checked = bulk.resellerIds.includes(reseller.id)

                  return (
                    <label key={reseller.id} className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setBulk((current) => ({
                            ...current,
                            resellerIds: event.target.checked ? [...current.resellerIds, reseller.id] : current.resellerIds.filter((id) => id !== reseller.id),
                          }))
                        }
                      />
                      <span>{reseller.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bulk-mode">{t('managerParent.pages.resellerPricing.mode')}</Label>
                <select
                  id="bulk-mode"
                  value={bulk.mode}
                  onChange={(event) => setBulk((current) => ({ ...current, mode: event.target.value as 'fixed' | 'markup' }))}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="markup">{t('managerParent.pages.resellerPricing.markupMode')}</option>
                  <option value="fixed">{t('managerParent.pages.resellerPricing.fixedMode')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-value">{bulk.mode === 'markup' ? t('managerParent.pages.resellerPricing.markupValue') : t('managerParent.pages.resellerPricing.fixedValue')}</Label>
                <Input id="bulk-value" value={bulk.value} onChange={(event) => setBulk((current) => ({ ...current, value: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-commission">{t('managerParent.pages.resellerPricing.commission')}</Label>
                <Input id="bulk-commission" value={bulk.commissionRate} onChange={(event) => setBulk((current) => ({ ...current, commissionRate: event.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setBulkOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (bulk.resellerIds.length === 0 || Number.isNaN(Number(bulk.value))) {
                  toast.error(t('managerParent.pages.resellerPricing.bulkValidation'))
                  return
                }

                bulkMutation.mutate()
              }}
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending ? t('managerParent.pages.resellerPricing.applying') : t('managerParent.pages.resellerPricing.applyBulkUpdate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
