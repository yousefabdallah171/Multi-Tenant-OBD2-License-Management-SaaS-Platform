import { memo, type ReactNode } from 'react'
import { Banknote, Users } from 'lucide-react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { formatCurrency, cn } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import type { NetworkResellerNode } from '@/types/manager-parent.types'

type ResellerNodeData = NetworkResellerNode & { lang: 'ar' | 'en' }

export const ResellerNode = memo(function ResellerNode({ data }: NodeProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const nodeData = data as unknown as ResellerNodeData
  const locale = nodeData.lang === 'ar' ? 'ar-EG' : 'en-US'

  const visit = (href: string) => {
    navigate(href)
  }

  return (
    <div className="w-56 rounded-2xl border-2 border-emerald-500 border-l-4 border-l-emerald-500 bg-white p-4 shadow-lg shadow-emerald-500/20 dark:bg-slate-800">
      <Handle type="target" position={Position.Left} className="size-3 border-2 border-white bg-emerald-500 dark:border-slate-900" />

      <button
        type="button"
        className="flex w-full items-start gap-3 text-start"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          visit(routePaths.managerParent.teamMemberDetail(nodeData.lang, nodeData.id))
        }}
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold uppercase text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
          {nodeData.name.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-base font-semibold text-slate-950 dark:text-white">{nodeData.name}</p>
            <StatusDot status={nodeData.status} />
          </div>
          <RoleBadge role="reseller" />
        </div>
      </button>

      <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <StatButton
          icon={<Banknote className="size-4 text-emerald-600 dark:text-emerald-300" />}
          label={t('managerParent.pages.teamNetwork.revenue')}
          value={formatCurrency(nodeData.revenue, 'USD', locale)}
          onClick={() => visit(routePaths.managerParent.resellerPaymentDetail(nodeData.lang, nodeData.id))}
        />
<StatButton
          icon={<Users className="size-4 text-emerald-600 dark:text-emerald-300" />}
          label={t('managerParent.pages.teamNetwork.customers')}
          value={String(nodeData.customers_count)}
          onClick={() => visit(buildScopedHref(routePaths.managerParent.customers(nodeData.lang), {
            reseller_id: nodeData.id,
            scope_name: nodeData.name,
            scope_role: 'reseller',
          }))}
        />
      </div>
    </div>
  )
})

function StatButton({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:hover:border-emerald-700 dark:hover:bg-slate-900"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
    >
      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-200">
        {icon}
        <span>{label}</span>
      </span>
      <span dir="ltr" className="tabular-nums font-semibold text-slate-950 dark:text-white">
        {value}
      </span>
    </button>
  )
}

function StatusDot({ status }: { status: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
      <span className={cn('size-2 rounded-full', status === 'active' ? 'bg-emerald-500' : 'bg-slate-400')} />
      {status}
    </span>
  )
}

function buildScopedHref(path: string, params: Record<string, string | number>) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    query.set(key, String(value))
  })

  return `${path}?${query.toString()}`
}
