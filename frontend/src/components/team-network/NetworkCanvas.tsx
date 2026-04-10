import { useCallback, useEffect } from 'react'
import {
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { TenantRootNode } from '@/components/team-network/nodes/TenantRootNode'
import { ManagerParentNode } from '@/components/team-network/nodes/ManagerParentNode'
import { ManagerNode } from '@/components/team-network/nodes/ManagerNode'
import { ResellerNode } from '@/components/team-network/nodes/ResellerNode'
import AnimatedEdge from '@/components/team-network/edges/AnimatedEdge'

const nodeTypes = {
  tenantRoot: TenantRootNode,
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
  storageKey,
}: {
  nodes: Node[]
  edges: Edge[]
  onInit?: (instance: ReactFlowInstance) => void
  storageKey?: string
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner nodes={nodes} edges={edges} onInit={onInit} storageKey={storageKey} />
    </ReactFlowProvider>
  )
}

function CanvasInner({
  nodes,
  edges,
  onInit,
  storageKey,
}: {
  nodes: Node[]
  edges: Edge[]
  onInit?: (instance: ReactFlowInstance) => void
  storageKey?: string
}) {
  const [flowNodes, setFlowNodes] = useNodesState(nodes)
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges)

  const persistNodePositions = useCallback((nextNodes: Node[]) => {
    if (!storageKey || typeof window === 'undefined') {
      return
    }

    const positions = Object.fromEntries(
      nextNodes.map((node) => [
        node.id,
        {
          x: node.position.x,
          y: node.position.y,
        },
      ]),
    )

    window.localStorage.setItem(storageKey, JSON.stringify(positions))
  }, [storageKey])

  const mergeStoredPositions = useCallback((nextNodes: Node[], currentNodes: Node[]) => {
    if (!storageKey || typeof window === 'undefined') {
      return nextNodes
    }

    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return nextNodes
    }

    try {
      const stored = JSON.parse(raw) as Record<string, { x: number; y: number }>
      const currentMap = new Map(currentNodes.map((node) => [node.id, node]))

      return nextNodes.map((node) => {
        const storedPosition = stored[node.id]
        const currentNode = currentMap.get(node.id)

        if (storedPosition) {
          return { ...node, position: storedPosition }
        }

        if (currentNode) {
          return { ...node, position: currentNode.position }
        }

        return node
      })
    } catch {
      return nextNodes
    }
  }, [storageKey])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setFlowNodes((currentNodes: Node[]) => {
      const nextNodes = applyNodeChanges(changes, currentNodes)
      const shouldPersist = changes.some((change) => change.type === 'position' && change.dragging === false)

      if (shouldPersist) {
        persistNodePositions(nextNodes)
      }

      return nextNodes
    })
  }, [persistNodePositions, setFlowNodes])

  useEffect(() => {
    setFlowNodes((currentNodes: Node[]) => mergeStoredPositions(nodes, currentNodes))
  }, [mergeStoredPositions, nodes, setFlowNodes])

  useEffect(() => {
    setFlowEdges(edges)
  }, [edges, setFlowEdges])

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
          nodeColor={(node: Node) => {
            if (node.type === 'tenantRoot') return '#0ea5e9'
            if (node.type === 'managerParent') return '#a855f7'
            if (node.type === 'manager') return '#6366f1'
            return '#10b981'
          }}
        />
      </ReactFlow>
    </div>
  )
}
