import { useEffect } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ManagerParentNode } from '@/components/team-network/nodes/ManagerParentNode'
import { ManagerNode } from '@/components/team-network/nodes/ManagerNode'
import { ResellerNode } from '@/components/team-network/nodes/ResellerNode'
import AnimatedEdge from '@/components/team-network/edges/AnimatedEdge'

const nodeTypes = {
  managerParent: ManagerParentNode,
  manager: ManagerNode,
  reseller: ResellerNode,
}

const edgeTypes = {
  animated: AnimatedEdge,
}

export function NetworkCanvas({
  nodes,
  edges,
  onInit,
}: {
  nodes: Node[]
  edges: Edge[]
  onInit?: (instance: ReactFlowInstance) => void
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner nodes={nodes} edges={edges} onInit={onInit} />
    </ReactFlowProvider>
  )
}

function CanvasInner({
  nodes,
  edges,
  onInit,
}: {
  nodes: Node[]
  edges: Edge[]
  onInit?: (instance: ReactFlowInstance) => void
}) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes)
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges)

  useEffect(() => {
    setFlowNodes(nodes)
  }, [nodes, setFlowNodes])

  useEffect(() => {
    setFlowEdges(edges)
  }, [edges, setFlowEdges])

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        onInit={onInit}
      >
        <Background gap={18} size={1} color="#cbd5e1" />
        <Controls showInteractive={false} className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" />
        <MiniMap
          pannable
          zoomable
          className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          nodeColor={(node) => {
            if (node.type === 'managerParent') return '#a855f7'
            if (node.type === 'manager') return '#6366f1'
            return '#10b981'
          }}
        />
      </ReactFlow>
    </div>
  )
}
