'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Trash2, Plus, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { managerParentService } from '@/services/manager-parent.service'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { formatDate } from '@/lib/utils'

interface User {
  id: number
  name: string
  email: string
  role: string
}

interface OfferFormData {
  program_id: number
  user_id: number
  discount_percentage: number
  is_active: boolean
}

interface OfferFormState {
  programId: number | null
  userId: number | null
  selectedUser: User | null
  discountPercentage: number | null
  isActive: boolean
}

interface EditingOffer {
  id: number
  discountPercentage: number
  isActive: boolean
}

interface NetworkNode {
  id: number
  name: string
  email: string
  role: string
}

const INITIAL_FORM_STATE: OfferFormState = {
  programId: null,
  userId: null,
  selectedUser: null,
  discountPercentage: null,
  isActive: true,
}

export function OffersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingOffer, setEditingOffer] = useState<EditingOffer | null>(null)
  const [formState, setFormState] = useState<OfferFormState>(INITIAL_FORM_STATE)
  const [filterProgramId, setFilterProgramId] = useState<number | ''>('')
  const [filterUserId, setFilterUserId] = useState<number | ''>('')
  const [currentPage, setCurrentPage] = useState(1)

  const offersQuery = useQuery({
    queryKey: ['manager-parent:offers', { filterProgramId, filterUserId, page: currentPage }],
    queryFn: () => managerParentService.getOffers({
      program_id: filterProgramId ? Number(filterProgramId) : undefined,
      user_id: filterUserId ? Number(filterUserId) : undefined,
      page: currentPage,
      per_page: 10,
    }),
  })

  const programsQuery = useQuery({
    queryKey: ['manager-parent:programs-for-offers'],
    queryFn: () => managerParentService.getProgramsWithExternalApi(),
  })

  // Fetch team network to get available resellers and managers
  const teamNetworkQuery = useQuery({
    queryKey: ['manager-parent:team-network'],
    queryFn: () => managerParentService.getTeamNetwork(),
  })

  const availableUsers = useMemo(() => {
    if (!teamNetworkQuery.data) return []
    const payload = (teamNetworkQuery.data as any)?.data as any
    if (!payload) return []

    const users: NetworkNode[] = []

    if (payload.managers && Array.isArray(payload.managers)) {
      users.push(...payload.managers)
    }
    if (payload.resellers && Array.isArray(payload.resellers)) {
      users.push(...payload.resellers)
    }

    return users
  }, [teamNetworkQuery.data])

  const createOfferMutation = useMutation({
    mutationFn: (data: OfferFormData) => managerParentService.createOffer(data),
    onSuccess: () => {
      toast.success(t('offers.createSuccess') || 'Offer created successfully')
      queryClient.invalidateQueries({ queryKey: ['manager-parent:offers'] })
      setShowModal(false)
      setFormState(INITIAL_FORM_STATE)
    },
    onError: (error: any) => {
      toast.error(resolveApiErrorMessage(error, t('common.error')))
    },
  })

  const deleteOfferMutation = useMutation({
    mutationFn: (offerId: number) => managerParentService.deleteOffer(offerId),
    onSuccess: () => {
      toast.success(t('offers.deleteSuccess') || 'Offer deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['manager-parent:offers'] })
    },
    onError: (error: any) => {
      toast.error(resolveApiErrorMessage(error, t('common.error')))
    },
  })

  const updateOfferMutation = useMutation({
    mutationFn: (data: { offerId: number; discountPercentage: number; isActive: boolean }) =>
      managerParentService.updateOffer(data.offerId, {
        discount_percentage: data.discountPercentage,
        is_active: data.isActive,
      }),
    onSuccess: () => {
      toast.success(t('offers.updateSuccess') || 'Offer updated successfully')
      queryClient.invalidateQueries({ queryKey: ['manager-parent:offers'] })
      setEditingOffer(null)
    },
    onError: (error: any) => {
      toast.error(resolveApiErrorMessage(error, t('common.error')))
    },
  })

  const handleCreateOffer = () => {
    if (!formState.programId || !formState.userId || formState.discountPercentage === null) {
      toast.error(t('offers.validation.fillAllFields') || 'Please fill in all required fields')
      return
    }

    createOfferMutation.mutate({
      program_id: formState.programId,
      user_id: formState.userId,
      discount_percentage: formState.discountPercentage,
      is_active: formState.isActive,
    })
  }

  const offers = offersQuery.data?.data || []
  const programs = programsQuery.data || []

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {t('managerParent.pages.offers.title') || 'Custom Discount Offers'}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('managerParent.pages.offers.subtitle') || 'Manage custom discount offers for your resellers and managers'}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('managerParent.pages.offers.newOffer') || 'New Offer'}
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('managerParent.pages.offers.filterProgram') || 'Filter by Software'}</Label>
            <select
              value={filterProgramId}
              onChange={(e) => {
                setFilterProgramId(e.target.value ? Number(e.target.value) : '')
                setCurrentPage(1)
              }}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
            >
              <option value="">{t('common.all') || 'All'}</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t('managerParent.pages.offers.filterUser') || 'Filter by User'}</Label>
            <Input
              placeholder={t('common.searchByName') || 'Search by name or email'}
              value={filterUserId}
              onChange={(e) => {
                setFilterUserId(e.target.value ? Number(e.target.value) : '')
                setCurrentPage(1)
              }}
              type="text"
            />
          </div>
        </div>
      </div>

      {/* Offers Table */}
      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {offersQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center text-slate-500">
            {t('common.loading') || 'Loading...'}
          </div>
        ) : offers.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-slate-500">
            {t('managerParent.pages.offers.noOffers') || 'No offers found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    {t('common.software') || 'Software'}
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    {t('common.user') || 'User'}
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    {t('offers.discount') || 'Discount'}
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    {t('common.status') || 'Status'}
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    {t('common.createdBy') || 'Created By'}
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    {t('common.createdAt') || 'Created At'}
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                    {t('common.actions') || 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {offers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{offer.program_name}</div>
                      <div className="text-xs text-slate-500">{offer.program_status}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{offer.user_name}</div>
                      <div className="text-xs text-slate-500 capitalize">{(typeof offer.user_role === 'string' ? offer.user_role : (offer.user_role as any)?.value || '')?.replace('_', ' ')}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 dark:bg-emerald-950">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                          -{offer.discount_percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                          offer.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {offer.is_active ? (
                          <>
                            <Check className="h-3 w-3" />
                            {t('common.active') || 'Active'}
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3" />
                            {t('common.inactive') || 'Inactive'}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{offer.creator_name}</td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {formatDate(offer.created_at)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setEditingOffer({ id: offer.id, discountPercentage: offer.discount_percentage, isActive: offer.is_active })}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 dark:text-rose-400"
                          onClick={() => deleteOfferMutation.mutate(offer.id)}
                          disabled={deleteOfferMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {offersQuery.data && offersQuery.data.meta && offersQuery.data.meta.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {t('common.page') || 'Page'} {currentPage} {t('common.of') || 'of'} {offersQuery.data.meta.last_page}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                {t('common.previous') || 'Previous'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, offersQuery.data?.meta.last_page || prev))}
                disabled={currentPage === offersQuery.data?.meta.last_page}
              >
                {t('common.next') || 'Next'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Offer Modal - Single Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {t('managerParent.pages.offers.newOffer') || 'New Offer'}
              </h2>
            </div>

            <div className="space-y-4 px-6 py-4">
              {/* User Dropdown */}
              <div className="space-y-2">
                <Label>{t('managerParent.pages.offers.selectUser') || 'Select Reseller or Manager'}</Label>
                <select
                  value={formState.userId || ''}
                  onChange={(e) => {
                    const userId = e.target.value ? Number(e.target.value) : null
                    const user = availableUsers.find((u: any) => u.id === userId)
                    setFormState((prev) => ({
                      ...prev,
                      userId: userId,
                      selectedUser: user || null,
                    }))
                  }}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
                >
                  <option value="">-- Select User --</option>
                  {availableUsers.map((user: any) => {
                    const roleDisplay = typeof user.role === 'string' ? user.role : (user.role as any)?.value || 'user'
                    return (
                      <option key={user.id} value={user.id}>
                        {user.name} ({roleDisplay.replace('_', ' ')})
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Program/Software Dropdown */}
              <div className="space-y-2">
                <Label>{t('managerParent.pages.offers.selectProgram') || 'Select Software'}</Label>
                <select
                  value={formState.programId || ''}
                  onChange={(e) => setFormState((prev) => ({ ...prev, programId: e.target.value ? Number(e.target.value) : null }))}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
                >
                  <option value="">-- Select Software --</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Discount Percentage Input */}
              <div className="space-y-2">
                <Label>{t('managerParent.pages.offers.discount') || 'Discount Percentage'}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={formState.discountPercentage || ''}
                    onChange={(e) => {
                      let value = e.target.value ? parseFloat(e.target.value) : null
                      if (value !== null && value > 100) value = 100
                      if (value !== null && value < 0.01) value = 0.01
                      setFormState((prev) => ({
                        ...prev,
                        discountPercentage: value,
                      }))
                    }}
                    placeholder="e.g., 10.00"
                    className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
                  />
                  <span className="text-slate-600 dark:text-slate-400">%</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('managerParent.pages.offers.discountInfo') || 'Enter discount as percentage (0.01 - 100). 100% = Free'}
                </p>
              </div>

              {/* Active Checkbox */}
              <div className="space-y-2">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formState.isActive}
                    onChange={(e) => setFormState((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {t('managerParent.pages.offers.activeNow') || 'Active Now'}
                  </span>
                </label>
              </div>

              {/* Example Display */}
              {formState.discountPercentage && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {t('managerParent.pages.offers.example') || 'Example'}: $100 × (1 - {formState.discountPercentage}%) = $
                    {(100 * (1 - formState.discountPercentage / 100)).toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 border-t border-slate-200 px-6 py-3 dark:border-slate-700">
              <Button
                onClick={handleCreateOffer}
                disabled={createOfferMutation.isPending || !formState.userId || !formState.programId || formState.discountPercentage === null}
                className="flex-1"
              >
                {createOfferMutation.isPending ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    {t('common.creating') || 'Creating...'}
                  </>
                ) : (
                  t('common.create') || 'Create'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false)
                  setFormState(INITIAL_FORM_STATE)
                }}
                className="flex-1"
              >
                {t('common.cancel') || 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Offer Modal */}
      {editingOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {t('common.edit') || 'Edit Offer'}
              </h2>
            </div>

            <div className="space-y-4 px-6 py-4">
              {/* Discount Percentage Input */}
              <div className="space-y-2">
                <Label>{t('managerParent.pages.offers.discount') || 'Discount Percentage'}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={editingOffer.discountPercentage}
                    onChange={(e) => {
                      let value = parseFloat(e.target.value) || 0
                      if (value > 100) value = 100
                      if (value < 0.01) value = 0.01
                      setEditingOffer((prev) => prev ? { ...prev, discountPercentage: value } : null)
                    }}
                    className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
                  />
                  <span className="text-slate-600 dark:text-slate-400">%</span>
                </div>
              </div>

              {/* Active Checkbox */}
              <div className="space-y-2">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={editingOffer.isActive}
                    onChange={(e) =>
                      setEditingOffer((prev) => prev ? { ...prev, isActive: e.target.checked } : null)
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {t('common.active') || 'Active'}
                  </span>
                </label>
              </div>

              {/* Example Display */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {t('managerParent.pages.offers.example') || 'Example'}: $100 × (1 - {editingOffer.discountPercentage}%) = $
                  {(100 * (1 - editingOffer.discountPercentage / 100)).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 border-t border-slate-200 px-6 py-3 dark:border-slate-700">
              <Button
                onClick={() => {
                  updateOfferMutation.mutate({
                    offerId: editingOffer.id,
                    discountPercentage: editingOffer.discountPercentage,
                    isActive: editingOffer.isActive,
                  })
                }}
                disabled={updateOfferMutation.isPending}
                className="flex-1"
              >
                {updateOfferMutation.isPending ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    {t('common.saving') || 'Saving...'}
                  </>
                ) : (
                  t('common.save') || 'Save'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingOffer(null)}
                className="flex-1"
              >
                {t('common.cancel') || 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
