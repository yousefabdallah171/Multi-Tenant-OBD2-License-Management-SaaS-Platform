import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface EditRecord {
  id: number
  super_admin_name: string
  action: string
  previous_values: Record<string, any>
  new_values: Record<string, any>
  reason: string | null
  diffs: Record<string, any>
  created_at: string
}

interface TransactionEditHistoryProps {
  edits: EditRecord[]
}

const FIELD_LABELS: Record<string, string> = {
  price: 'Price (USD)',
  customer_id: 'Customer ID',
  activated_at: 'Activation Date',
  duration_days: 'Duration (days)',
  program_id: 'Program ID',
}

function formatValue(key: string, value: any): string {
  if (value === null || value === undefined) {
    return '(none)'
  }

  if (key === 'price') {
    return `$${parseFloat(value).toFixed(2)}`
  }

  if (key === 'activated_at') {
    const date = new Date(value)
    return date.toLocaleDateString()
  }

  if (key === 'duration_days') {
    return `${parseFloat(value)} days`
  }

  return String(value)
}

function EditItem({ edit, index }: { edit: EditRecord; index: number }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const fieldCount = Object.keys(edit.diffs || {}).length

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
      >
        <div className="flex items-center gap-3 text-left flex-1">
          <span className="text-sm font-semibold text-gray-900">
            #{index + 1} {t('transaction.edit.by', { defaultValue: 'by' })} {edit.super_admin_name}
          </span>
          <span className="text-xs text-gray-600">
            {new Date(edit.created_at).toLocaleString()}
          </span>
          {fieldCount > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
              {fieldCount} {t('transaction.edit.changes', { defaultValue: 'change(s)' })}
            </span>
          )}
          {edit.action === 'revert' && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
              {t('transaction.edit.reverted', { defaultValue: 'Reverted' })}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-600" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-600" />
        )}
      </button>

      {expanded && (
        <div className="px-4 py-4 space-y-4 bg-white border-t">
          {/* Changes */}
          {Object.keys(edit.diffs || {}).length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-gray-900">
                {t('transaction.edit.changes_made', { defaultValue: 'Changes Made' })}
              </h4>
              {Object.entries(edit.diffs || {}).map(([key, diff]: [string, any]) => (
                <div key={key} className="flex items-start gap-3 text-sm">
                  <div className="flex-1">
                    <div className="font-medium text-gray-700">
                      {FIELD_LABELS[key] || key}
                    </div>
                    <div className="mt-1 space-y-1">
                      <div className="text-gray-600">
                        {t('transaction.edit.from', { defaultValue: 'From:' })}{' '}
                        <span className="font-mono bg-red-50 px-2 py-1 rounded text-red-700">
                          {formatValue(key, diff.from)}
                        </span>
                      </div>
                      <div className="text-gray-600">
                        {t('transaction.edit.to', { defaultValue: 'To:' })}{' '}
                        <span className="font-mono bg-green-50 px-2 py-1 rounded text-green-700">
                          {formatValue(key, diff.to)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reason */}
          {edit.reason && (
            <div>
              <h4 className="font-semibold text-sm text-gray-900 mb-2">
                {t('transaction.edit.reason', { defaultValue: 'Reason' })}
              </h4>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded italic">
                "{edit.reason}"
              </p>
            </div>
          )}

          {/* Edit ID for reference */}
          <div className="text-xs text-gray-500 border-t pt-3">
            Edit ID: <span className="font-mono">#{edit.id}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function TransactionEditHistory({ edits }: TransactionEditHistoryProps) {
  const { t } = useTranslation()

  if (edits.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {t('transaction.edit.no_history', { defaultValue: 'No edit history' })}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-gray-900">
        {t('transaction.edit.edit_history', { defaultValue: 'Edit History' })} ({edits.length})
      </div>
      <div className="space-y-2">
        {edits.map((edit, index) => (
          <EditItem key={edit.id} edit={edit} index={index} />
        ))}
      </div>
    </div>
  )
}
