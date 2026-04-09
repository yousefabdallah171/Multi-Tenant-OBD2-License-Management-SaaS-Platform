# Team Network Diagram — Feature Plan

> **Feature Name:** Team Network Diagram (`/team-network`)
> **Role:** Manager Parent only
> **Purpose:** Visual org-chart network diagram showing the full hierarchy: Manager Parent → Managers → Resellers with live stats, animated connections, and deep-link navigation.
> **Library:** `@xyflow/react` (React Flow v12)
> **Estimated Effort:** ~14 hours
> **Phases:** 4
> **Last reviewed:** 2026-04-09 — all review fixes locked in

---

## 1. What This Feature Does

The Team Network page renders an **interactive, animated network diagram** that visualizes the full team hierarchy in a left-to-right layout:

```
[Manager Parent] ──── [Manager A] ──── [Reseller 1]
                  ╲               ╲─── [Reseller 2]
                   ╲── [Manager B] ─── [Reseller 3]
                                   ╲── [Reseller 4]
                   ╲────────────────── [Reseller 5]  ← orphan (no manager)
```

Every node is a **rich card** showing live stats. Every badge and stat inside each card is **clickable** and navigates to the relevant existing page. The canvas supports **zoom, pan, and drag**. All connections are **animated with pulsing dots**.

---

## 2. Hierarchy Model — `created_by` Rule

> ⚠️ **Implementation note (locked):** There is no `manager_id` column in the `users` table. Reseller-to-manager grouping is derived from `users.created_by`. A reseller belongs to a manager if `reseller.created_by` points to a user with `role = manager` in the same tenant. If `created_by` is null, points to the manager parent, or points to another reseller, the reseller is treated as an **orphan** and connected directly to the root node.
>
> This is a **display-time grouping rule only**, not a durable manager-assignment model. A comment must be added in `NetworkController` explaining this. If the product later needs persistent manager assignment, a `manager_id` column should be added.

---

## 3. Current Codebase — What Already Exists

### 3.1 Pages (reuse for navigation targets)
| Click Target | Navigates To | Existing File |
|---|---|---|
| Manager Parent name/avatar | Team Member Detail (self) | `frontend/src/pages/manager-parent/TeamMemberDetail.tsx` |
| Manager name/avatar | Team Member Detail | same |
| Reseller name/avatar | Team Member Detail | same |
| `$X Revenue` (Manager Parent) | Financial Reports | `frontend/src/pages/manager-parent/FinancialReports.tsx` |
| `$X Revenue` (Manager) | Financial Reports | same |
| `$X Revenue` (Reseller) | **Reseller Payments list** | `frontend/src/pages/manager-parent/ResellerPayments.tsx` |
| `👥 X Managers` | Team Management (role=manager) | `frontend/src/pages/manager-parent/TeamManagement.tsx` |
| `👥 X Resellers` | Team Management (role=reseller) | same |
| `🔑 X Activations` (Reseller) | Customers filtered by reseller | `frontend/src/pages/manager-parent/Customers.tsx` |
| `👥 X Customers` (all roles) | Customers page | same |
| `⚖️ Balance` (Manager Parent) | Reseller Payments | `frontend/src/pages/manager-parent/ResellerPayments.tsx` |

### 3.2 Services (reuse for data fetching)
| Service | File | Methods Used |
|---|---|---|
| `managerParentService` | `frontend/src/services/manager-parent.service.ts` | add `getTeamNetwork()` |

### 3.3 Types (extend)
| File | What to Add |
|---|---|
| `frontend/src/types/manager-parent.types.ts` | `NetworkRootNode`, `NetworkManagerNode`, `NetworkResellerNode`, `NetworkDiagramPayload` |

### 3.4 Routes
| File | Change |
|---|---|
| `frontend/src/router/routes.ts` | Add `teamNetwork` under `managerParent` |
| `frontend/src/router/index.tsx` | Register route for `TeamNetworkPage` |

### 3.5 Sidebar
| File | Change |
|---|---|
| `frontend/src/components/layout/Sidebar.tsx` | Add "Team Network" nav item for `manager_parent` role with `Network` icon |

### 3.6 Backend (new)
| File | What |
|---|---|
| `backend/app/Http/Controllers/ManagerParent/NetworkController.php` | New controller with `index()` method |
| `backend/routes/api.php` | Register `GET /team/network` inside `role:manager_parent` group |

### 3.7 Locales
| File | Keys |
|---|---|
| `frontend/src/locales/en.json` | `managerParent.pages.teamNetwork.*` + `managerParent.sidebar.teamNetwork` |
| `frontend/src/locales/ar.json` | same in Arabic |

---

## 4. Backend Endpoint Design

### `GET /team/network`
Protected by: `auth:sanctum` + `role:manager_parent` middleware.
Cached per tenant for **60 seconds** using key `team-network:{tenantId}`.

### 4.1 Root node computation
```
root.id                = auth()->id()
root.name              = auth()->user()->name
root.role              = 'manager_parent'
root.status            = auth()->user()->status
root.total_revenue     = RevenueAnalytics::totalRevenue([], $tenantId)
                         — whole-tenant earned revenue, all activity_logs for this tenant
root.balance           = auth()->user()->balance?->pending_balance ?? 0
                         — spendable wallet balance from user_balances.pending_balance
root.managers_count    = User::where(tenant_id, role=manager)->count()
root.resellers_count   = User::where(tenant_id, role=reseller)->count()
root.total_customers   = License::where(tenant_id)->distinct('customer_id')->count('customer_id')
                         — NOT users with role=customer (that role was removed in Phase 11)
```

### 4.2 Manager nodes computation (bulk, no N+1)
```
$managers = User::where(tenant_id, role=manager)->get()
$managerIds = $managers->pluck('id')

// Resellers grouped by manager (via created_by)
$resellersByManager = User::where(tenant_id, role=reseller)
    ->whereIn('created_by', $managerIds)
    ->get()
    ->groupBy('created_by')

// License counts grouped — one query for all managers
$licenseStats = License::whereIn('reseller_id', allResellerIds)
    ->groupBy('reseller_id')
    ->selectRaw('reseller_id, count(*) as activations, count(distinct customer_id) as customers')
    ->get()->keyBy('reseller_id')

// Bulk revenue for all managers — one query
$managerRevenues = RevenueAnalytics::revenueBySellerIds($managerIds->all(), $tenantId)

foreach $managers as $manager:
    revenue           = $managerRevenues[$manager->id] ?? 0
    resellers_count   = count($resellersByManager[$manager->id] ?? [])
    resellerIdsForMgr = $resellersByManager[$manager->id]->pluck('id')
    customers_count   = sum of $licenseStats[$rid]->customers for rid in resellerIdsForMgr
    activations_count = sum of $licenseStats[$rid]->activations for rid in resellerIdsForMgr
```

### 4.3 Reseller nodes computation (bulk, no N+1)
```
$resellers = User::where(tenant_id, role=reseller)->get()
$resellerIds = $resellers->pluck('id')

// manager_id derived from created_by rule
$managerIdSet = $managers->pluck('id')->flip()
foreach $reseller:
    manager_id = ($resellersByManager contains $reseller) ? $reseller->created_by : null

// Bulk revenue — one query
$resellerRevenues = RevenueAnalytics::revenueBySellerIds($resellerIds->all(), $tenantId)

// License counts — reuse $licenseStats from manager step (same query covers all resellers)

foreach $resellers as $reseller:
    revenue           = $resellerRevenues[$reseller->id] ?? 0
    activations_count = $licenseStats[$reseller->id]->activations ?? 0
    customers_count   = $licenseStats[$reseller->id]->customers ?? 0
    manager_id        = (created_by is a manager in tenant) ? created_by : null
```

### 4.4 Final response shape
```json
{
  "data": {
    "root": {
      "id": 1,
      "name": "yousef",
      "role": "manager_parent",
      "status": "active",
      "total_revenue": 2362.22,
      "balance": 500.00,
      "managers_count": 4,
      "resellers_count": 12,
      "total_customers": 21
    },
    "managers": [
      {
        "id": 5,
        "name": "Manager A",
        "role": "manager",
        "status": "active",
        "revenue": 800.00,
        "resellers_count": 3,
        "customers_count": 10,
        "activations_count": 15
      }
    ],
    "resellers": [
      {
        "id": 12,
        "name": "youe",
        "role": "reseller",
        "status": "active",
        "manager_id": 5,
        "revenue": 1403.03,
        "activations_count": 9,
        "customers_count": 12
      }
    ]
  }
}
```

**Query budget:** 6 total queries (managers, resellers, license stats, manager revenues, reseller revenues, balance). No loops that query the database.

---

## 5. Frontend Architecture

### 5.1 New Files to Create
```
frontend/src/
├── pages/manager-parent/
│   └── TeamNetwork.tsx                     ← Main page component
├── components/team-network/
│   ├── NetworkCanvas.tsx                   ← React Flow canvas wrapper
│   ├── nodes/
│   │   ├── ManagerParentNode.tsx           ← Root node card (purple)
│   │   ├── ManagerNode.tsx                 ← Manager node card (indigo)
│   │   └── ResellerNode.tsx                ← Reseller node card (emerald)
│   ├── edges/
│   │   └── AnimatedEdge.tsx               ← Custom pulsing animated edge
│   └── hooks/
│       └── useNetworkLayout.ts            ← dagre auto-layout logic
```

### 5.2 Node Visual Specs

#### Manager Parent Node (leftmost, largest — ~280px wide)
```
┌─────────────────────────────────┐
│  🟣  yousef           [active]  │  ← purple left-border accent
│      Manager Parent             │     Manager Parent role badge
├─────────────────────────────────┤
│  💰 $2,362.22  ── → Reports     │  ← total_revenue (whole tenant)
│  👥 4 Managers ── → Team/mgr    │  ← managers_count
│  👥 21 Customers── → Customers  │  ← total_customers (distinct licenses)
│  ⚖️ $500.00    ── → Payments    │  ← balance (pending_balance)
└─────────────────────────────────┘
  border: border-purple-500
  glow:   shadow-purple-500/20
```

#### Manager Node (middle — ~240px wide)
```
┌──────────────────────────┐
│  🔵  Manager A  [active] │  ← indigo left-border accent
│      Manager             │
├──────────────────────────┤
│  💰 $800.00  ── → Reports│
│  👥 3 Resellers → Team   │
│  👥 10 Customers→ Custs  │
└──────────────────────────┘
  border: border-indigo-500
  glow:   shadow-indigo-500/20
```

#### Reseller Node (rightmost — ~220px wide)
```
┌────────────────────────┐
│  🟢  youe   [active]   │  ← emerald left-border accent
│      Reseller          │
├────────────────────────┤
│  💰 $1,403  → Payments │  ← revenue → resellerPayments list (NOT detail)
│  🔑 9 Acts  → Customers│  ← activations_count → customers?reseller_id=
│  👥 12 Cx   → Customers│  ← customers_count  → customers?reseller_id=
└────────────────────────┘
  border: border-emerald-500
  glow:   shadow-emerald-500/20
```

### 5.3 Edge (Wire) Specs
| Connection | Color | Hex |
|---|---|---|
| Manager Parent → Manager | `indigo-400` | `#818cf8` |
| Manager → Reseller | `emerald-400` | `#34d399` |
| Manager Parent → Orphan Reseller | `violet-400` | `#a78bfa` |

All edges use custom `AnimatedEdge` component with `stroke-dasharray` CSS animation — dots travel left→right at constant speed.

### 5.4 Canvas Controls
- Zoom: mouse wheel / pinch / buttons
- Pan: click + drag on empty canvas
- Mini-map: bottom-right corner with role-color node dots
- Fit View / Reset View: wired to `reactFlowInstance.fitView()`
- `fitView` runs automatically on first load

### 5.5 Auto Layout (dagre)
```
rankdir: 'LR'
nodesep: 80       ← vertical gap between sibling nodes
ranksep: 200      ← horizontal gap between columns

Node sizes fed to dagre:
  managerParent:  { width: 288, height: 200 }
  manager:        { width: 240, height: 180 }
  reseller:       { width: 224, height: 160 }
```

---

## 6. Click Navigation Map (Final — Locked)

### Manager Parent Node
| Element | Destination | Route |
|---|---|---|
| Name / Avatar | Team Member Detail (self) | `routePaths.managerParent.teamMemberDetail(lang, id)` |
| `$X Revenue` | Financial Reports | `routePaths.managerParent.financialReports(lang)` |
| `👥 X Managers` | Team Management role=manager | `routePaths.managerParent.teamManagement(lang) + '?role=manager'` |
| `👥 X Customers` | Customers page | `routePaths.managerParent.customers(lang)` |
| `⚖️ Balance` | Reseller Payments | `routePaths.managerParent.resellerPayments(lang)` |

### Manager Node
| Element | Destination | Route |
|---|---|---|
| Name / Avatar | Team Member Detail | `routePaths.managerParent.teamMemberDetail(lang, id)` |
| `$X Revenue` | Financial Reports | `routePaths.managerParent.financialReports(lang)` |
| `👥 X Resellers` | Team Management role=reseller | `routePaths.managerParent.teamManagement(lang) + '?role=reseller'` |
| `👥 X Customers` | Customers page | `routePaths.managerParent.customers(lang)` |

### Reseller Node
| Element | Destination | Route |
|---|---|---|
| Name / Avatar | Team Member Detail | `routePaths.managerParent.teamMemberDetail(lang, id)` |
| `$X Revenue` | **Reseller Payments list** | `routePaths.managerParent.resellerPayments(lang)` |
| `🔑 X Activations` | Customers filtered | `routePaths.managerParent.customers(lang) + '?reseller_id=' + id` |
| `👥 X Customers` | Customers filtered | `routePaths.managerParent.customers(lang) + '?reseller_id=' + id` |

---

## 7. RTL / Dark Mode / i18n

- Canvas direction is always LTR (left→right flow is intentional for a hierarchy diagram)
- Page header, buttons, node text alignment follow RTL when `lang === 'ar'`
- Currency and numeric values always rendered `dir="ltr"` inside node cards
- All text strings go through `t()` — no hardcoded English strings
- Dark mode: node cards `dark:bg-slate-800`, canvas `dark:bg-slate-950`
- Edge colors are visible on both light and dark backgrounds at chosen opacity

---

## 8. Performance

| Concern | Solution |
|---|---|
| Backend N+1 | Bulk queries: `revenueBySellerIds()`, grouped license stats in one query |
| Total backend queries | 6 max, regardless of team size |
| Frontend re-renders | All node components wrapped in `React.memo` |
| Layout recalculation | `useMemo` in `useNetworkLayout` — only recalculates when API data changes |
| Large teams | React Flow virtualizes off-screen nodes natively |
| Cache | Backend: 60s `Cache::remember` per tenant. Frontend: React Query `staleTime: 60_000` |

---

## 9. Packages Required

| Package | Purpose |
|---|---|
| `@xyflow/react` | React Flow canvas, node system, edge system, controls, minimap |
| `dagre` | Hierarchical auto-layout (LR direction) |
| `@types/dagre` | TypeScript types for dagre |

---

## 10. Phase Breakdown

| Phase | Name | Goal |
|---|---|---|
| **Phase 1** | Backend API | `NetworkController`, bulk queries, route registration |
| **Phase 2** | Frontend Foundation | packages, types, service method, route, empty page shell |
| **Phase 3** | Node & Edge Components | 3 node cards + animated edge + dagre layout hook |
| **Phase 4** | Canvas Integration & Polish | Full page assembly, loading/empty/error states, sidebar, translations, dark mode, RTL, test checklist |
