import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TransactionEditForm } from './TransactionEditForm'
import { TransactionEditHistory } from './TransactionEditHistory'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import * as transactionService from '@/services/transaction-edit.service'

interface TransactionEditModalProps {
  open: boolean
  onClose: () => void
  activityLogId: number
  onSuccess?: () => void
}

export function TransactionEditModal({ open, onClose, activityLogId, onSuccess }: TransactionEditModalProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'edit' | 'history'>('edit')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['transaction-details', activityLogId],
    queryFn: () => transactionService.getTransactionDetails(activityLogId),
    enabled: open && activityLogId > 0,
  })

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('transaction.edit.title', { defaultValue: 'Edit Transaction' })}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {isError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
            {resolveApiErrorMessage(error, t('error.failed_to_load', { defaultValue: 'Failed to load transaction details' }))}
          </div>
        )}

        {data && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'history')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">
                {t('transaction.edit.tab_edit', { defaultValue: 'Edit' })}
              </TabsTrigger>
              <TabsTrigger value="history">
                {t('transaction.edit.tab_history', { defaultValue: 'History' })}
                {data.edit_history.length > 0 && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {data.edit_history.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-4">
              <TransactionEditForm
                transaction={data.transaction}
                onClose={onClose}
                onSuccess={onSuccess}
              />
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {data.edit_history.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {t('transaction.edit.no_history', { defaultValue: 'No edit history' })}
                </div>
              ) : (
                <TransactionEditHistory edits={data.edit_history} />
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
