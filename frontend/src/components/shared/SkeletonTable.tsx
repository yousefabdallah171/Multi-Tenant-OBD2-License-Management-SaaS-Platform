import { Fragment } from 'react'

interface SkeletonTableProps {
  columnCount: number
  rowCount?: number
}

export function SkeletonTable({ columnCount, rowCount = 5 }: SkeletonTableProps) {
  return (
    <Fragment>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <tr key={`skeleton-row-${rowIndex}`}>
          {Array.from({ length: columnCount }).map((_, columnIndex) => (
            <td key={`skeleton-cell-${rowIndex}-${columnIndex}`} className="px-4 py-4">
              <div className="h-4 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            </td>
          ))}
        </tr>
      ))}
    </Fragment>
  )
}
