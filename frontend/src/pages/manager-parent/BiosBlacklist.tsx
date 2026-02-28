import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { tenantBiosService } from '@/services/tenant-bios.service'
import type { BiosBlacklistEntry } from '@/types/super-admin.types'

export function BiosBlacklistPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ bios_id: '', reason: '' })

  const blacklistQuery = useQuery({
    queryKey: ['manager-parent', 'bios-blacklist', page, perPage, search, status],
    queryFn: () => tenantBiosService.getBlacklist({ page, per_page: perPage, search, status }),
  })

  const addMutation = useMutation({
    mutationFn: () => tenantBiosService.addToBlacklist(form),
    onSuccess: () => {
      toast.success('BIOS added to blacklist.')
      setFormOpen(false)
      setForm({ bios_id: '', reason: '' })
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'bios-blacklist'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => tenantBiosService.removeFromBlacklist(id),
    onSuccess: () => {
      toast.success('Blacklist entry removed.')
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'bios-blacklist'] })
    },
  })

  const columns = useMemo<Array<DataTableColumn<BiosBlacklistEntry>>>(
    () => [
      { key: 'bios', label: 'BIOS ID', sortable: true, sortValue: (row) => row.bios_id, render: (row) => <code>{row.bios_id}</code> },
      { key: 'addedBy', label: 'Added By', sortable: true, sortValue: (row) => row.added_by ?? '', render: (row) => row.added_by ?? '-' },
      { key: 'reason', label: 'Reason', sortable: true, sortValue: (row) => row.reason, render: (row) => row.reason },
      { key: 'status', label: 'Status', sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
      { key: 'createdAt', label: 'Date Added', sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-') },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => navigate(`${routePaths.managerParent.biosHistory(lang)}?bios=${encodeURIComponent(row.bios_id)}`)}>
              History
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={row.status === 'removed'} onClick={() => removeMutation.mutate(row.id)}>
              Remove
            </Button>
          </div>
        ),
      },
    ],
    [lang, locale, navigate, removeMutation],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="BIOS Blacklist"
        description="Manage tenant-level blocked BIOS identifiers and keep the list scoped to this organization."
        actions={
          <Button type="button" onClick={() => setFormOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            Add to Blacklist
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search BIOS ID"
            className="min-w-[220px] flex-1"
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="removed">Removed</option>
          </select>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={blacklistQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={blacklistQuery.isLoading}
        pagination={{
          page: blacklistQuery.data?.meta.current_page ?? 1,
          lastPage: blacklistQuery.data?.meta.last_page ?? 1,
          total: blacklistQuery.data?.meta.total ?? 0,
          perPage: blacklistQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPerPage(size)
          setPage(1)
        }}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Blacklist</DialogTitle>
            <DialogDescription>Store a BIOS identifier and a required reason for the tenant blacklist.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="blacklist-bios-id">BIOS ID</Label>
              <Input id="blacklist-bios-id" value={form.bios_id} onChange={(event) => setForm((current) => ({ ...current, bios_id: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blacklist-reason">Reason</Label>
              <Textarea id="blacklist-reason" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!form.bios_id.trim() || !form.reason.trim()) {
                  toast.error('BIOS ID and reason are required.')
                  return
                }

                addMutation.mutate()
              }}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
