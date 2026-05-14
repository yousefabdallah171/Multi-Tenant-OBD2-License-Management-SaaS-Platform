'use client'

import { useState } from 'react'
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

interface OfferFormData {
  program_id: number
  user_id: number
  discount_percentage: number
  is_active: boolean
}

interface OfferFormState {
  step: 1 | 2 | 3
  programId: number | null
  userId: number | null
  discountPercentage: number | null
  isActive: boolean
}

const INITIAL_FORM_STATE: OfferFormState = {
  step: 1,
  programId: null,
  userId: null,
  discountPercentage: null,
  isActive: true,
}

export function OffersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [formState, setFormState] = useState<OfferFormState>(INITIAL_FORM_STATE)
  const [filterProgramId, setFilterProgramId] = useState<number | ''>('')
  const [filterUserId, setFilterUserId] = useState<number | ''>('')
  const [currentPage, setCurrentPage] = useState(1)

  const offersQuery = useQuery({
    queryKey: ['super-admin:offers', { filterProgramId, filterUserId, page: currentPage }],
    queryFn: () => managerParentService.getOffers({
      program_id: filterProgramId ? Number(filterProgramId) : undefined,
      user_id: filterUserId ? Number(filterUserId) : undefined,
      page: currentPage,
      per_page: 10,
    }),
  })

  const programsQuery = useQuery({
    queryKey: ['super-admin:programs-for-offers'],
    queryFn: () => managerParentService.getProgramsWithExternalApi(),
  })

  const createOfferMutation = useMutation({
    mutationFn: (data: OfferFormData) => managerParentService.createOffer(data),
    onSuccess: () => {
      toast.success(t('offers.createSuccess') || 'Offer created successfully')
      queryClient.invalidateQueries({ queryKey: ['super-admin:offers'] })
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
      queryClient.invalidateQueries({ queryKey: ['super-admin:offers'] })
    },
    onError: (error: any) => {
      toast.error(resolveApiErrorMessage(error, t('common.error')))
    },
  })

  const handleCreateOffer = () => {
    if (!formState.programId || !formState.userId || formState.discountPercentage === null) {
      toast.error('Please fill in all required fields')
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
            {t('offers.title') || 'Custom Discount Offers'}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('offers.subtitle') || 'Manage custom discount offers for resellers and managers'}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('offers.newOffer') || 'New Offer'}
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('offers.filterProgram') || 'Filter by Software'}</Label>
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
            <Label>{t('offers.filterUser') || 'Filter by User'}</Label>
            <Input
              placeholder={t('common.searchByName') || 'Search by name or ID'}
              value={filterUserId}
              onChange={(e) => {
                setFilterUserId(e.target.value ? Number(e.target.value) : '')
                setCurrentPage(1)
              }}
              type="number"
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
            {t('offers.noOffers') || 'No offers found'}
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
                      <div className="text-xs text-slate-500 capitalize">{offer.user_role.replace('_', ' ')}</div>
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
                          onClick={() => toast.info('Edit functionality coming soon')}
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {t('offers.newOffer') || 'New Offer'}
              </h2>
            </div>

            <div className="space-y-6 px-6 py-4">
              {/* Step 1: Select User */}
              {formState.step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('offers.selectUser') || 'Select User (Reseller/Manager)'}</Label>
                    <Input
                      placeholder={t('common.searchByName') || 'Search by name or email'}
                      type="text"
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('common.selectedUser') || 'Selected User'}</Label>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                      {formState.userId ? (
                        <div className="text-sm text-slate-900 dark:text-white">User ID: {formState.userId}</div>
                      ) : (
                        <div className="text-sm text-slate-500">No user selected</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Select Program */}
              {formState.step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('offers.selectProgram') || 'Select Software'}</Label>
                    <select
                      value={formState.programId || ''}
                      onChange={(e) => setFormState((prev) => ({ ...prev, programId: Number(e.target.value) }))}
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
                  {formState.programId && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                      <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        {programs.find((p) => p.id === formState.programId)?.name}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Set Discount */}
              {formState.step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('offers.discount') || 'Discount Percentage'}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0.01"
                        max="99.99"
                        step="0.01"
                        value={formState.discountPercentage || ''}
                        onChange={(e) =>
                          setFormState((prev) => ({
                            ...prev,
                            discountPercentage: e.target.value ? parseFloat(e.target.value) : null,
                          }))
                        }
                        placeholder="e.g., 10.00"
                        className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
                      />
                      <span className="text-slate-600 dark:text-slate-400">%</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('offers.discountInfo') || 'Enter discount as percentage (0.01 - 99.99)'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formState.isActive}
                        onChange={(e) => setFormState((prev) => ({ ...prev, isActive: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {t('offers.activeNow') || 'Active Now'}
                      </span>
                    </label>
                  </div>

                  {formState.discountPercentage && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        {t('offers.example') || 'Example'}: $100 × (1 - {formState.discountPercentage}%) = $
                        {(100 * (1 - formState.discountPercentage / 100)).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-2">
                {formState.step > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => setFormState((prev) => ({ ...prev, step: (prev.step - 1) as OfferFormState['step'] }))}
                  >
                    {t('common.previous') || 'Previous'}
                  </Button>
                )}

                {formState.step < 3 ? (
                  <Button
                    onClick={() => {
                      if (formState.step === 1 && !formState.userId) {
                        toast.error('Please select a user')
                        return
                      }
                      if (formState.step === 2 && !formState.programId) {
                        toast.error('Please select software')
                        return
                      }
                      setFormState((prev) => ({ ...prev, step: (prev.step + 1) as OfferFormState['step'] }))
                    }}
                    className="flex-1"
                  >
                    {t('common.next') || 'Next'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleCreateOffer}
                    disabled={createOfferMutation.isPending}
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
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-3 dark:border-slate-700">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false)
                  setFormState(INITIAL_FORM_STATE)
                }}
                className="w-full"
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
