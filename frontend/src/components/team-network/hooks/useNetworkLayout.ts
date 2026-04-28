import { useMemo } from 'react'
import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'
import type { NetworkDiagramPayload, NetworkManagerNode, NetworkManagerParentNode, NetworkResellerNode, NetworkTenantRootNode } from '@/types/manager-parent.types'

type Lang = 'ar' | 'en'
type NetworkNodeData = (NetworkTenantRootNode | NetworkManagerParentNode | NetworkManagerNode | NetworkResellerNode) & { lang: Lang } & Record<string, unknown>

export function useNetworkLayout(payload: NetworkDiagramPayload | undefined, lang: Lang) {
  return useMemo(() => {
    if (!payload) {
      return { nodes: [] as Node<NetworkNodeData>[], edges: [] as Edge[] }
    }

    const graph = new dagre.graphlib.Graph()
    graph.setDefaultEdgeLabel(() => ({}))
    graph.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 200 })

    const rootId = `tenant-${payload.root.id}`
    graph.setNode(rootId, { width: 288, height: 200 })

    payload.manager_parents.forEach((managerParent) => {
      const managerParentNodeId = `manager-parent-${managerParent.id}`
      graph.setNode(managerParentNodeId, { width: 288, height: 200 })
      graph.setEdge(rootId, managerParentNodeId)
    })

    payload.managers.forEach((manager) => {
      const managerNodeId = `manager-${manager.id}`
      graph.setNode(managerNodeId, { width: 240, height: 180 })

      if (manager.manager_parent_id) {
        graph.setEdge(`manager-parent-${manager.manager_parent_id}`, managerNodeId)
        return
      }

      graph.setEdge(rootId, managerNodeId)
    })

    payload.resellers.forEach((reseller) => {
      const resellerNodeId = `reseller-${reseller.id}`
      graph.setNode(resellerNodeId, { width: 224, height: 160 })

      if (reseller.manager_id) {
        graph.setEdge(`manager-${reseller.manager_id}`, resellerNodeId)
        return
      }

      if (reseller.manager_parent_id) {
        graph.setEdge(`manager-parent-${reseller.manager_parent_id}`, resellerNodeId)
        return
      }

      graph.setEdge(rootId, resellerNodeId)
    })

    dagre.layout(graph)

    const nodes: Node<NetworkNodeData>[] = [
      {
        id: rootId,
        type: 'tenantRoot',
        position: resolvePosition(graph.node(rootId)),
        data: { ...payload.root, lang },
        draggable: true,
      },
      ...payload.manager_parents.map((managerParent) => ({
        id: `manager-parent-${managerParent.id}`,
        type: 'managerParent' as const,
        position: resolvePosition(graph.node(`manager-parent-${managerParent.id}`)),
        data: { ...managerParent, lang },
        draggable: true,
      })),
      ...payload.managers.map((manager) => ({
        id: `manager-${manager.id}`,
        type: 'manager' as const,
        position: resolvePosition(graph.node(`manager-${manager.id}`)),
        data: { ...manager, lang },
        draggable: true,
      })),
      ...payload.resellers.map((reseller) => ({
        id: `reseller-${reseller.id}`,
        type: 'reseller' as const,
        position: resolvePosition(graph.node(`reseller-${reseller.id}`)),
        data: { ...reseller, lang },
        draggable: true,
      })),
    ]

    const edges: Edge[] = [
      ...payload.manager_parents.map((managerParent) => ({
        id: `e-root-mp-${managerParent.id}`,
        source: rootId,
        target: `manager-parent-${managerParent.id}`,
        type: 'animated',
        data: { color: '#a855f7' },
      })),
      ...payload.managers.map((manager) => ({
        id: manager.manager_parent_id ? `e-mp-${manager.manager_parent_id}-m-${manager.id}` : `e-root-m-${manager.id}`,
        source: manager.manager_parent_id ? `manager-parent-${manager.manager_parent_id}` : rootId,
        target: `manager-${manager.id}`,
        type: 'animated',
        data: { color: '#818cf8' },
      })),
      ...payload.resellers.map((reseller) => (
        reseller.manager_id
          ? {
              id: `e-m-${reseller.manager_id}-r-${reseller.id}`,
              source: `manager-${reseller.manager_id}`,
              target: `reseller-${reseller.id}`,
              type: 'animated',
              data: { color: '#34d399' },
            }
          : reseller.manager_parent_id
            ? {
                id: `e-mp-${reseller.manager_parent_id}-r-${reseller.id}`,
                source: `manager-parent-${reseller.manager_parent_id}`,
                target: `reseller-${reseller.id}`,
                type: 'animated',
                data: { color: '#a78bfa' },
              }
          : {
              id: `e-root-r-${reseller.id}`,
              source: rootId,
              target: `reseller-${reseller.id}`,
              type: 'animated',
              data: { color: '#a78bfa' },
            }
      )),
    ]

    return { nodes, edges }
  }, [lang, payload])
}

function resolvePosition(node: { x: number; y: number; width?: number; height?: number }) {
  return {
    x: node.x - (node.width ?? 0) / 2,
    y: node.y - (node.height ?? 0) / 2,
  }
}
