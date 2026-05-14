import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import * as transactionService from '@/services/transaction-edit.service'

interface TransactionEditFormProps {
  transaction: {
    license_id: number
    tenant_id: number
    tenant_name: string
    reseller_id: number
    reseller_name: string
    customer_id: number | null
    customer_name: string | null
    bios_id: string
    program_id: number
    program_name: string
    price: number
    duration_days: number
    activated_at: string
    expires_at: string
    status: string
  }
  onClose: () => void
  onSuccess?: () => void
}

interface FormState {
  price: string | null
  activated_at: string | null
  duration_days: string | null
  reason: string
}

export function TransactionEditForm({
  transaction,
  onClose,
  onSuccess,
}: TransactionEditFormProps) {
  const { t } = useTranslation()
  const [formState, setFormState] = useState<FormState>({
    price: null,
    activated_at: null,
    duration_days: null,
    reason: '',
  })

  const editMutation = useMutation({
    mutationFn: (data: FormState) =>
      transactionService.editTransaction(transaction.license_id, {
        price: data.price ? parseFloat(data.price) : undefined,
        activated_at: data.activated_at || undefined,
        duration_days: data.duration_days ? parseFloat(data.duration_days) : undefined,
        reason: data.reason || undefined,
      }),
    onSuccess: (result) => {
      toast.success(
        t('transaction.edit.success', { defaultValue: 'Transaction edited successfully' })
      )

      // Show affected items
      if (result.affected) {
        const affectedMsg = [
          result.affected.caches_invalidated > 0 &&
            `${result.affected.caches_invalidated} cache(s) invalidated`,
          result.affected.balances_recalculated &&
            Array.isArray(result.affected.balances_recalculated) &&
            `${result.affected.balances_recalculated.length} balance(s) recalculated`,
        ]
          .filter(Boolean)
          .join(', ')

        if (affectedMsg) {
          toast.info(affectedMsg)
        }
      }

      onSuccess?.()
      onClose()
    },
    onError: (error) => {
      toast.error(
        resolveApiErrorMessage(error, t('error.edit_failed', { defaultValue: 'Failed to edit transaction' }))
      )
    },
  })

  const hasChanges =
    formState.price !== null ||
    formState.activated_at !== null ||
    formState.duration_days !== null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasChanges) {
      toast.warning(t('transaction.edit.no_changes', { defaultValue: 'No changes to save' }))
      return
    }
    editMutation.mutate(formState)
  }

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toISOString().split('T')[0]
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Transaction Info */}
      <div className="bg-gray-50 p-4 rounded space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600 font-medium">
              {t('transaction.field.reseller', { defaultValue: 'Reseller' })}
            </div>
            <div className="text-gray-900">{transaction.reseller_name}</div>
          </div>
          <div>
            <div className="text-gray-600 font-medium">
              {t('transaction.field.bios_id', { defaultValue: 'BIOS ID' })}
            </div>
            <div className="text-gray-900 font-mono">{transaction.bios_id}</div>
          </div>
          <div>
            <div className="text-gray-600 font-medium">
              {t('transaction.field.program', { defaultValue: 'Program' })}
            </div>
            <div className="text-gray-900">{transaction.program_name}</div>
          </div>
          <div>
            <div className="text-gray-600 font-medium">
              {t('transaction.field.status', { defaultValue: 'Status' })}
            </div>
            <div className="text-gray-900 capitalize">{transaction.status}</div>
          </div>
        </div>
      </div>

      {/* Editable Fields */}
      <div className="space-y-4 border-t pt-4">
        <div>
          <Label htmlFor="price">
            {t('transaction.field.price', { defaultValue: 'Price (USD)' })}
          </Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            placeholder={String(transaction.price)}
            value={formState.price ?? ''}
            onChange={(e) => setFormState({ ...formState, price: e.target.value || null })}
            className="mt-1"
          />
          {formState.price !== null && (
            <div className="text-xs text-gray-600 mt-1">
              {t('transaction.edit.current_value', { defaultValue: 'Current: ' })}
              ${transaction.price.toFixed(2)} → ${parseFloat(formState.price).toFixed(2)}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="activated_at">
            {t('transaction.field.activated_at', { defaultValue: 'Activation Date' })}
          </Label>
          <Input
            id="activated_at"
            type="date"
            placeholder={formatDateTime(transaction.activated_at)}
            value={formState.activated_at ?? ''}
            onChange={(e) => setFormState({ ...formState, activated_at: e.target.value || null })}
            className="mt-1"
          />
          {formState.activated_at !== null && (
            <div className="text-xs text-gray-600 mt-1">
              {t('transaction.edit.current_value', { defaultValue: 'Current: ' })}
              {formatDateTime(transaction.activated_at)} → {formState.activated_at}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="duration_days">
            {t('transaction.field.duration_days', { defaultValue: 'Duration (days)' })}
          </Label>
          <Input
            id="duration_days"
            type="number"
            step="0.1"
            min="0"
            placeholder={String(transaction.duration_days)}
            value={formState.duration_days ?? ''}
            onChange={(e) =>
              setFormState({ ...formState, duration_days: e.target.value || null })
            }
            className="mt-1"
          />
          {formState.duration_days !== null && (
            <div className="text-xs text-gray-600 mt-1">
              {t('transaction.edit.current_value', { defaultValue: 'Current: ' })}
              {transaction.duration_days} → {parseFloat(formState.duration_days)} days
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="reason">
            {t('transaction.edit.reason_label', { defaultValue: 'Reason for change' })}
          </Label>
          <Textarea
            id="reason"
            placeholder={t('transaction.edit.reason_placeholder', {
              defaultValue: 'Why are you making this change?',
            })}
            value={formState.reason}
            onChange={(e) => setFormState({ ...formState, reason: e.target.value })}
            className="mt-1"
            rows={3}
          />
        </div>
      </div>

      {/* Impact Info */}
      {hasChanges && (
        <div className="flex gap-2 bg-blue-50 border border-blue-200 rounded p-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-blue-800 text-sm">
            {t('transaction.edit.impact_warning', {
              defaultValue:
                'This change will be immediately reflected in all reseller, manager, and manager parent reports. Edit history will be maintained.',
            })}
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 justify-end border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={editMutation.isPending}
        >
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button
          type="submit"
          disabled={!hasChanges || editMutation.isPending}
          className="gap-2"
        >
          {editMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('transaction.edit.save_changes', { defaultValue: 'Save Changes' })}
        </Button>
      </div>
    </form>
  )
}
