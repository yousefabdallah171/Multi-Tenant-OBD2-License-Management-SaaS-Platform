import { memo, type ReactNode } from 'react'
import { Banknote, Building2, Users } from 'lucide-react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import type { NetworkTenantRootNode } from '@/types/manager-parent.types'

type TenantRootNodeData = NetworkTenantRootNode & { lang: 'ar' | 'en' }

export const TenantRootNode = memo(function TenantRootNode({ data }: NodeProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const nodeData = data as unknown as TenantRootNodeData
  const locale = nodeData.lang === 'ar' ? 'ar-EG' : 'en-US'

  const visit = (href: string) => {
    navigate(href)
  }

  return (
    <div className="w-72 rounded-2xl border-2 border-sky-500 border-l-4 border-l-sky-500 bg-white p-4 shadow-lg shadow-sky-500/20 dark:bg-slate-800">
      <Handle type="source" position={Position.Right} className="size-3 border-2 border-white bg-sky-500 dark:border-slate-900" />

      <div className="flex items-start gap-3 text-start">
        <div className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200">
          <Building2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-base font-semibold text-slate-950 dark:text-white">{nodeData.name}</p>
          </div>
          <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-200">
            {t('common.tenant')}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <StatButton
          icon={<Banknote className="size-4 text-sky-600 dark:text-sky-300" />}
          label={t('managerParent.pages.teamNetwork.revenue')}
          value={formatCurrency(nodeData.total_revenue, 'USD', locale)}
          onClick={() => visit(routePaths.managerParent.financialReports(nodeData.lang))}
        />
        <StatButton
          icon={<Users className="size-4 text-sky-600 dark:text-sky-300" />}
          label={t('managerParent.pages.teamNetwork.managerParents', { defaultValue: 'Manager Parents' })}
          value={String(nodeData.manager_parents_count)}
          onClick={() => visit(`${routePaths.managerParent.teamManagement(nodeData.lang)}?role=manager`)}
        />
        <StatButton
          icon={<Users className="size-4 text-sky-600 dark:text-sky-300" />}
          label={t('managerParent.pages.teamNetwork.customers')}
          value={String(nodeData.total_customers)}
          onClick={() => visit(routePaths.managerParent.customers(nodeData.lang))}
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
      className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm transition-colors hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:hover:border-sky-700 dark:hover:bg-slate-900"
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
