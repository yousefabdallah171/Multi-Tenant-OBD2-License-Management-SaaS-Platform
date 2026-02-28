import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
      toast.success('Pricing updated successfully.')
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
      toast.success(`Bulk pricing applied to ${data.updated} rows.`)
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

  const columns = useMemo<Array<DataTableColumn<PricingRow>>>(
    () => [
      {
        key: 'program',
        label: 'Program',
        sortable: true,
        sortValue: (row) => row.program_name,
        render: (row) => row.program_name,
      },
      {
        key: 'basePrice',
        label: 'Base Price',
        sortable: true,
        sortValue: (row) => row.base_price,
        render: (row) => formatCurrency(row.base_price, 'USD', locale),
      },
      {
        key: 'resellerPrice',
        label: 'Reseller Price',
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
        label: 'Margin %',
        sortable: true,
        sortValue: (row) => row.base_price > 0 ? ((row.reseller_price - row.base_price) / row.base_price) * 100 : 0,
        render: (row) => `${row.base_price > 0 ? (((row.reseller_price - row.base_price) / row.base_price) * 100).toFixed(1) : '0.0'}%`,
      },
      {
        key: 'commission',
        label: 'Commission %',
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
        label: 'Actions',
        render: (row) =>
          editingRowId === row.program_id ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!selectedId) {
                    toast.error('Select a reseller first.')
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
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingRowId(null)}>
                Cancel
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
              Edit
            </Button>
          ),
      },
    ],
    [editingCommission, editingPrice, editingRowId, locale, selectedId, updateMutation],
  )

  const historyColumns = useMemo<Array<DataTableColumn<PricingHistoryEntry>>>(
    () => [
      { key: 'time', label: 'Timestamp', sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-') },
      { key: 'program', label: 'Program', sortable: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
      { key: 'oldPrice', label: 'Old Price', sortable: true, sortValue: (row) => row.old_price ?? 0, render: (row) => formatCurrency(row.old_price ?? 0, 'USD', locale) },
      { key: 'newPrice', label: 'New Price', sortable: true, sortValue: (row) => row.new_price, render: (row) => formatCurrency(row.new_price, 'USD', locale) },
      { key: 'changedBy', label: 'Changed By', sortable: true, sortValue: (row) => row.changed_by ?? '', render: (row) => row.changed_by ?? '-' },
    ],
    [locale],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reseller Pricing"
        description="Set reseller-specific program prices, adjust commission rates, and review pricing history."
        actions={
          <Button type="button" onClick={() => setBulkOpen(true)}>
            Bulk Update
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="space-y-2">
            <Label htmlFor="reseller-select">Reseller</Label>
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
          <CardTitle className="text-lg">Pricing History</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={historyColumns} data={historyQuery.data?.data ?? []} rowKey={(row) => row.id} isLoading={historyQuery.isLoading} />
        </CardContent>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update Pricing</DialogTitle>
            <DialogDescription>Select reseller accounts and apply either a markup percentage or a fixed price across all programs.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Resellers</Label>
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
                <Label htmlFor="bulk-mode">Mode</Label>
                <select
                  id="bulk-mode"
                  value={bulk.mode}
                  onChange={(event) => setBulk((current) => ({ ...current, mode: event.target.value as 'fixed' | 'markup' }))}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="markup">Percentage markup</option>
                  <option value="fixed">Fixed price</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-value">{bulk.mode === 'markup' ? 'Markup %' : 'Fixed price'}</Label>
                <Input id="bulk-value" value={bulk.value} onChange={(event) => setBulk((current) => ({ ...current, value: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-commission">Commission %</Label>
                <Input id="bulk-commission" value={bulk.commissionRate} onChange={(event) => setBulk((current) => ({ ...current, commissionRate: event.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (bulk.resellerIds.length === 0 || Number.isNaN(Number(bulk.value))) {
                  toast.error('Select at least one reseller and enter a valid value.')
                  return
                }

                bulkMutation.mutate()
              }}
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending ? 'Applying...' : 'Apply Bulk Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
