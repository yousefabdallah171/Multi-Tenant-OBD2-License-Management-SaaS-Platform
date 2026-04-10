import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import './AnimatedEdge.css'

type AnimatedEdgeData = { color?: string }

export default function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  const color = (data as AnimatedEdgeData | undefined)?.color ?? '#818cf8'

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: color, strokeOpacity: 0.28, strokeWidth: 2 }} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray="8 12"
        strokeLinecap="round"
        style={{ animation: 'team-network-dash 1s linear infinite' }}
      />
    </>
  )
}
