# Team Network Diagram — Developer Tasks

> **Feature:** Team Network Diagram for Manager Parent
> **Plan Reference:** `docs/team-network-diagram-plan.md`
> **Total Phases:** 4
> **Route:** `/{lang}/team-network`
> **New Files to Create:** 7
> **Files to Modify:** 8

---

## Phase 1 — Backend API

> **Goal:** Create the `/team/network` endpoint that returns the full hierarchy tree (Manager Parent → Managers → Resellers) with all stats needed by the frontend.

---

### Task 1.1 — Create `NetworkController` in ManagerParent namespace
- [ ] Create file: `backend/app/Http/Controllers/ManagerParent/NetworkController.php`
- [ ] Extend `BaseManagerParentController`
- [ ] Add `public function index(Request $request): JsonResponse`
- [ ] Add this comment block at the top of the `index()` method:
  ```php
  // HIERARCHY NOTE: There is no manager_id column on users.
  // Reseller-to-manager grouping is derived at display time from users.created_by.
  // A reseller belongs to a manager only if its created_by value points to a user
  // with role=manager in the same tenant. This is not a durable assignment model.
  // If persistent manager assignment is needed in future, add a manager_id column.
  ```
- [ ] Compute root node fields:
  - `total_revenue` — `RevenueAnalytics::totalRevenue([], $tenantId)` (whole-tenant earned revenue)
  - `balance` — `$mp->balance?->pending_balance ?? 0` (the spendable wallet balance from `user_balances.pending_balance`, NOT `total_revenue`)
  - `managers_count` — `User::where('tenant_id', $tenantId)->where('role', 'manager')->count()`
  - `resellers_count` — `User::where('tenant_id', $tenantId)->where('role', 'reseller')->count()`
  - `total_customers` — `License::where('tenant_id', $tenantId)->distinct('customer_id')->count('customer_id')` — **do NOT count users with role=customer, that role was removed**

---

### Task 1.2 — Fetch Managers and Resellers with bulk queries (no N+1)
- [ ] Load all managers: `User::where('tenant_id', $tenantId)->where('role', 'manager')->get()`
- [ ] Load all resellers: `User::where('tenant_id', $tenantId)->where('role', 'reseller')->get()`
- [ ] Build `$managerIdSet` as a flip of manager IDs for O(1) lookup
- [ ] Group resellers by manager using `created_by` rule:
  ```php
  $resellersByManager = $resellers
      ->filter(fn($r) => isset($managerIdSet[$r->created_by]))
      ->groupBy('created_by');
  ```
- [ ] Compute license stats in **one query** for all resellers at once:
  ```php
  $licenseStats = License::query()
      ->whereIn('reseller_id', $resellers->pluck('id'))
      ->groupBy('reseller_id')
      ->selectRaw('reseller_id, COUNT(*) as activations, COUNT(DISTINCT customer_id) as customers')
      ->get()
      ->keyBy('reseller_id');
  ```
- [ ] Compute revenue for all managers in **one bulk call**:
  ```php
  $managerRevenues = RevenueAnalytics::revenueBySellerIds($managers->pluck('id')->all(), $tenantId);
  ```
- [ ] Compute revenue for all resellers in **one bulk call**:
  ```php
  $resellerRevenues = RevenueAnalytics::revenueBySellerIds($resellers->pluck('id')->all(), $tenantId);
  ```
- [ ] Map managers array: for each manager, sum `activations` and `customers` from `$licenseStats` for all resellers in `$resellersByManager[$manager->id]`
- [ ] Map resellers array: for each reseller, set `manager_id = $resellersByManager` lookup (null if orphan), pull revenue and license stats from the bulk results

---

### Task 1.3 — Serialize and validate output
- [ ] All money values (`total_revenue`, `balance`, `revenue`) must be `round((float)$value, 2)`
- [ ] All count values (`managers_count`, `resellers_count`, `total_customers`, `activations_count`, `customers_count`) must be cast to `(int)`
- [ ] `manager_id` on resellers must be `(int)` when set, `null` when orphan
- [ ] `role` field must be the string value (use `->value` on enum or cast): `'manager_parent'`, `'manager'`, `'reseller'`
- [ ] `status` field must be the string value of the user's status column

---

### Task 1.4 — Build JSON response and cache
- [ ] Return `response()->json(['data' => [...]])` with shape:
  ```json
  {
    "data": {
      "root": { "id", "name", "role", "status", "total_revenue", "balance", "managers_count", "resellers_count", "total_customers" },
      "managers": [ { "id", "name", "role", "status", "revenue", "resellers_count", "customers_count", "activations_count" } ],
      "resellers": [ { "id", "name", "role", "status", "manager_id", "revenue", "activations_count", "customers_count" } ]
    }
  }
  ```
- [ ] Wrap the entire computation inside:
  ```php
  Cache::remember("team-network:{$tenantId}", now()->addSeconds(60), function() { ... })
  ```
- [ ] Total query budget must not exceed 6 database queries — no per-user loops that call the DB

---

### Task 1.5 — Register route in `api.php`
- [ ] Open `backend/routes/api.php`
- [ ] Add import: `use App\Http\Controllers\ManagerParent\NetworkController as ManagerParentNetworkController;`
- [ ] Inside the `role:manager_parent` middleware group (around line 131), add:
  ```php
  Route::get('/team/network', [ManagerParentNetworkController::class, 'index']);
  ```

---

## Phase 2 — Frontend Foundation

> **Goal:** Install required packages, add TypeScript types, register the route, add the service method, and set up the empty page shell.

---

### Task 2.1 — Install npm packages
- [ ] Open terminal in `frontend/` directory
- [ ] Run: `npm install @xyflow/react dagre @types/dagre`
- [ ] Verify packages appear in `frontend/package.json` under `dependencies`
- [ ] Run `npm run build` briefly to confirm no type errors from new packages

---

### Task 2.2 — Add TypeScript types
- [ ] Open `frontend/src/types/manager-parent.types.ts`
- [ ] Add the following interfaces at the bottom of the file:

```typescript
export interface NetworkRootNode {
  id: number
  name: string
  role: 'manager_parent'
  status: string
  total_revenue: number   // whole-tenant earned revenue
  balance: number         // pending_balance from user_balances (spendable wallet)
  managers_count: number
  resellers_count: number
  total_customers: number // distinct customer_id count from licenses table
}

export interface NetworkManagerNode {
  id: number
  name: string
  role: 'manager'
  status: string
  revenue: number
  resellers_count: number
  customers_count: number
  activations_count: number
}

export interface NetworkResellerNode {
  id: number
  name: string
  role: 'reseller'
  status: string
  manager_id: number | null
  revenue: number
  activations_count: number
  customers_count: number
}

export interface NetworkDiagramPayload {
  root: NetworkRootNode
  managers: NetworkManagerNode[]
  resellers: NetworkResellerNode[]
}
```

---

### Task 2.3 — Add service method
- [ ] Open `frontend/src/services/manager-parent.service.ts`
- [ ] Import `NetworkDiagramPayload` from types file
- [ ] Add the following method to `managerParentService` object:

```typescript
async getTeamNetwork() {
  const cacheKey = 'manager-parent:team-network'
  const cached = apiCache.get<{ data: NetworkDiagramPayload }>(cacheKey)
  if (cached) return cached

  const { data } = await api.get<{ data: NetworkDiagramPayload }>('/team/network')
  apiCache.set(cacheKey, data, 60 * 1000)
  return data
},
```

---

### Task 2.4 — Add route to `routes.ts`
- [ ] Open `frontend/src/router/routes.ts`
- [ ] Inside `managerParent` object, add after `teamMemberDetail`:
  ```typescript
  teamNetwork: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/team-network`,
  ```

---

### Task 2.5 — Register page route in router
- [ ] Open `frontend/src/router/index.tsx`
- [ ] Import: `import { TeamNetworkPage } from '@/pages/manager-parent/TeamNetwork'`
- [ ] Find the manager_parent routes section
- [ ] Add the new route inside the manager_parent layout:
  ```tsx
  { path: 'team-network', element: <TeamNetworkPage /> },
  ```

---

### Task 2.6 — Create empty page shell
- [ ] Create file: `frontend/src/pages/manager-parent/TeamNetwork.tsx`
- [ ] Export `TeamNetworkPage` function component
- [ ] Add basic structure:
  - Import `useTranslation`, `useLanguage`
  - Add `PageHeader` component with title and description
  - Add a placeholder `<div>Network diagram coming soon...</div>`
  - Use `useQuery` to call `managerParentService.getTeamNetwork()`
  - Log the response to confirm API connection works

---

## Phase 3 — Node Components

> **Goal:** Build the three node card components (ManagerParentNode, ManagerNode, ResellerNode) and the custom animated edge component. Each node card is fully styled and has all click handlers wired.

---

### Task 3.1 — Create `components/team-network/` directory structure
- [ ] Create directory: `frontend/src/components/team-network/`
- [ ] Create subdirectories: `nodes/`, `edges/`, `hooks/`

---

### Task 3.2 — Create `ManagerParentNode.tsx`
- [ ] Create file: `frontend/src/components/team-network/nodes/ManagerParentNode.tsx`
- [ ] This is a React Flow custom node — accept `data` prop typed as `NetworkRootNode & { lang: string }`
- [ ] Card layout (Tailwind only, no inline styles):
  - Outer wrapper: `w-72 rounded-xl border-2 border-purple-500 bg-white dark:bg-slate-800 shadow-lg shadow-purple-500/20`
  - Top section: avatar circle (initials) + name + `RoleBadge` component + status dot
  - Bottom section: 4 clickable stat rows
- [ ] Each stat row is a `<button>` with `onClick` using `useNavigate()`:
  - Revenue row: `💰 $X,XXX` → navigate to `routePaths.managerParent.financialReports(lang)`
  - Managers row: `👥 X Managers` → navigate to `routePaths.managerParent.teamManagement(lang) + '?role=manager'`
  - Customers row: `👥 X Customers` → navigate to `routePaths.managerParent.customers(lang)`
  - Balance row: `⚖️ $X Balance` → navigate to `routePaths.managerParent.resellerPayments(lang)`
- [ ] Use `formatCurrency()` from `@/lib/utils` for all money values
- [ ] Add `Handle` components from `@xyflow/react`: only a right-side source handle (no left handle for root)
- [ ] Purple left border accent: `border-l-4 border-l-purple-500`

---

### Task 3.3 — Create `ManagerNode.tsx`
- [ ] Create file: `frontend/src/components/team-network/nodes/ManagerNode.tsx`
- [ ] Accept `data` prop typed as `NetworkManagerNode & { lang: string }`
- [ ] Card layout:
  - Outer wrapper: `w-60 rounded-xl border-2 border-indigo-500 bg-white dark:bg-slate-800 shadow-lg shadow-indigo-500/20`
  - Indigo left accent: `border-l-4 border-l-indigo-500`
  - Top: avatar initials + name + `RoleBadge` for 'manager' + status dot
  - Stats: 3 clickable rows
- [ ] Click handlers:
  - Revenue: `💰 $X` → navigate to `routePaths.managerParent.financialReports(lang)`
  - Resellers: `👥 X Resellers` → navigate to `routePaths.managerParent.teamManagement(lang) + '?role=reseller'`
  - Customers: `👥 X Customers` → navigate to `routePaths.managerParent.customers(lang)`
- [ ] Name/avatar click: navigate to `routePaths.managerParent.teamMemberDetail(lang, data.id)`
- [ ] Add `Handle` left (target) + right (source) from `@xyflow/react`
- [ ] Use `formatCurrency()` for revenue

---

### Task 3.4 — Create `ResellerNode.tsx`
- [ ] Create file: `frontend/src/components/team-network/nodes/ResellerNode.tsx`
- [ ] Accept `data` prop typed as `NetworkResellerNode & { lang: string }`
- [ ] Card layout:
  - Outer wrapper: `w-56 rounded-xl border-2 border-emerald-500 bg-white dark:bg-slate-800 shadow-lg shadow-emerald-500/20`
  - Emerald left accent: `border-l-4 border-l-emerald-500`
  - Top: avatar initials + name + `RoleBadge` for 'reseller' + status dot
  - Stats: 3 clickable rows
- [ ] Click handlers:
  - Revenue: `💰 $X` → navigate to `routePaths.managerParent.resellerPayments(lang)` — **payments LIST, not detail page** (detail may be empty if no payment records exist)
  - Activations: `🔑 X Activations` → navigate to `routePaths.managerParent.customers(lang) + '?reseller_id=' + data.id`
  - Customers: `👥 X Customers` → navigate to `routePaths.managerParent.customers(lang) + '?reseller_id=' + data.id`
- [ ] Name/avatar click: navigate to `routePaths.managerParent.teamMemberDetail(lang, data.id)`
- [ ] Add `Handle` left (target) only from `@xyflow/react` (leaf node, no right handle)
- [ ] Use `formatCurrency()` for revenue

---

### Task 3.5 — Create `AnimatedEdge.tsx`
- [ ] Create file: `frontend/src/components/team-network/edges/AnimatedEdge.tsx`
- [ ] This is a React Flow custom edge component
- [ ] Accept standard React Flow edge props + `data: { color: string }`
- [ ] Use `getBezierPath` from `@xyflow/react` to compute the SVG path
- [ ] Render two SVG paths:
  1. Static base path: stroke color = `data.color`, opacity 0.3, strokeWidth 2
  2. Animated path: same color, strokeWidth 2, `strokeDasharray="8 12"` with CSS animation `animateDash`
- [ ] Add CSS keyframe `@keyframes animateDash` using `strokeDashoffset` from 0 to -20, duration 1s, `linear`, `infinite`
- [ ] Use Tailwind `animate-` class or add CSS module / inline `<style>` tag for the keyframe
- [ ] Export as default

---

### Task 3.6 — Create `useNetworkLayout.ts` hook
- [ ] Create file: `frontend/src/components/team-network/hooks/useNetworkLayout.ts`
- [ ] Import `dagre` from `dagre` package
- [ ] Accept `payload: NetworkDiagramPayload` and `lang: string` as parameters
- [ ] Build `nodes` array for React Flow:
  - Root node: `type: 'managerParent'`, position from dagre, `data: { ...payload.root, lang }`
  - Manager nodes: `type: 'manager'`, positions from dagre, `data: { ...manager, lang }`
  - Reseller nodes: `type: 'reseller'`, positions from dagre, `data: { ...reseller, lang }`
- [ ] Build `edges` array for React Flow:
  - Root → each Manager: `type: 'animated'`, `data: { color: '#818cf8' }` (indigo-400 — Manager Parent to Manager)
  - Manager → each of its Resellers: `type: 'animated'`, `data: { color: '#34d399' }` (emerald-400 — Manager to Reseller)
  - Root → Resellers where `manager_id === null` (orphans): `type: 'animated'`, `data: { color: '#a78bfa' }` (violet-400 — Manager Parent direct to orphan Reseller)
  - Edge `id` must be unique: use `"e-root-m-{managerId}"`, `"e-m-{managerId}-r-{resellerId}"`, `"e-root-r-{resellerId}"`
- [ ] Use `dagre.graphlib.Graph` with `rankdir: 'LR'`, `nodesep: 80`, `ranksep: 200`
- [ ] Set node sizes in dagre: root=`{width:288, height:200}`, manager=`{width:240, height:180}`, reseller=`{width:224, height:160}`
- [ ] Run `dagre.layout(g)` and extract `x, y` positions
- [ ] Return `{ nodes, edges }` — memoized with `useMemo`

---

## Phase 4 — Canvas, Integration & Polish

> **Goal:** Assemble everything into the final page. Wire React Flow canvas, add controls, mini-map, connect to API data, handle loading/error states, add to sidebar, add translations, and final polish.

---

### Task 4.1 — Create `NetworkCanvas.tsx`
- [ ] Create file: `frontend/src/components/team-network/NetworkCanvas.tsx`
- [ ] Import `ReactFlow`, `Background`, `Controls`, `MiniMap`, `useNodesState`, `useEdgesState` from `@xyflow/react`
- [ ] Import `@xyflow/react/dist/style.css`
- [ ] Register custom node types:
  ```typescript
  const nodeTypes = {
    managerParent: ManagerParentNode,
    manager: ManagerNode,
    reseller: ResellerNode,
  }
  ```
- [ ] Register custom edge types:
  ```typescript
  const edgeTypes = {
    animated: AnimatedEdge,
  }
  ```
- [ ] Accept `nodes` and `edges` as props (computed by `useNetworkLayout`)
- [ ] Use `useNodesState` and `useEdgesState` initialized from props
- [ ] Render `<ReactFlow>` with:
  - `nodeTypes`, `edgeTypes`
  - `fitView` prop for initial fit
  - `minZoom={0.2}`, `maxZoom={2}`
  - `<Background />` with dots pattern
  - `<Controls />` (zoom in/out/fit)
  - `<MiniMap />` with custom node colors:
    - `managerParent` → `#a855f7` (purple)
    - `manager` → `#6366f1` (indigo)
    - `reseller` → `#10b981` (emerald)
- [ ] Canvas background: `bg-slate-50 dark:bg-slate-950`
- [ ] Wrap in `<ReactFlowProvider>` if not already at app level

---

### Task 4.2 — Finish `TeamNetwork.tsx` page
- [ ] Open `frontend/src/pages/manager-parent/TeamNetwork.tsx`
- [ ] Replace the shell with full implementation:
  ```
  - useQuery for managerParentService.getTeamNetwork()
  - Pass payload to useNetworkLayout() hook → get { nodes, edges }
  - Render PageHeader with:
      title: t('managerParent.pages.teamNetwork.title')
      description: t('managerParent.pages.teamNetwork.description')
      + "Refresh" button (invalidates React Query cache)
      + "Reset View" button (calls reactFlowInstance.fitView())
  - Show loading skeleton while data loads (use SkeletonCard or custom)
  - Show error state if query fails
  - Render <NetworkCanvas nodes={nodes} edges={edges} /> in a h-[calc(100vh-200px)] container
  ```
- [ ] Use `useRef` to hold `ReactFlowInstance` for the "Reset View" button
- [ ] Wrap canvas in a `<Card>` with no padding: `p-0 overflow-hidden rounded-xl`

---

### Task 4.3 — Add loading skeleton for canvas
- [ ] While `isLoading` is true, show a placeholder canvas:
  - Grey rounded rectangle taking same height as canvas
  - 3 columns of fake node shapes (purple, indigo, emerald rectangles)
  - Subtle pulse animation via `animate-pulse`
  - Text: "Loading team network..."

---

### Task 4.4 — Add empty state
- [ ] If API returns `managers: []` and `resellers: []`, show:
  - Centered message: "No team members yet"
  - Sub-text: "Add managers and resellers from Team Management to see them here"
  - Button: "Go to Team Management" → navigates to `routePaths.managerParent.teamManagement(lang)`

---

### Task 4.5 — Add sidebar navigation item
- [ ] Open `frontend/src/components/layout/Sidebar.tsx`
- [ ] Find the manager_parent navigation items section
- [ ] Add new nav item after "Team Management":
  ```tsx
  {
    label: t('managerParent.sidebar.teamNetwork'),
    href: routePaths.managerParent.teamNetwork(lang),
    icon: Network,  // from lucide-react
    roles: ['manager_parent'],
  }
  ```
- [ ] Import `Network` from `lucide-react`

---

### Task 4.6 — Add English translations
- [ ] Open `frontend/src/locales/en.json`
- [ ] Find the `managerParent.pages` section
- [ ] Add:
  ```json
  "teamNetwork": {
    "title": "Team Network",
    "description": "Visual hierarchy of your team — click any node to view details.",
    "refreshBtn": "Refresh",
    "resetViewBtn": "Reset View",
    "loading": "Loading team network...",
    "empty": "No team members yet",
    "emptyDescription": "Add managers and resellers from Team Management to see them here.",
    "goToTeam": "Go to Team Management",
    "revenue": "Revenue",
    "balance": "Balance",
    "managers": "Managers",
    "resellers": "Resellers",
    "customers": "Customers",
    "activations": "Activations"
  }
  ```
- [ ] Also add to `managerParent.sidebar`:
  ```json
  "teamNetwork": "Team Network"
  ```

---

### Task 4.7 — Add Arabic translations
- [ ] Open `frontend/src/locales/ar.json`
- [ ] Find the `managerParent.pages` section
- [ ] Add same keys with Arabic values:
  ```json
  "teamNetwork": {
    "title": "شبكة الفريق",
    "description": "التسلسل الهرمي المرئي لفريقك — انقر على أي عقدة لعرض التفاصيل.",
    "refreshBtn": "تحديث",
    "resetViewBtn": "إعادة العرض",
    "loading": "جارٍ تحميل شبكة الفريق...",
    "empty": "لا يوجد أعضاء في الفريق بعد",
    "emptyDescription": "أضف مدراء وموزعين من إدارة الفريق لرؤيتهم هنا.",
    "goToTeam": "الذهاب إلى إدارة الفريق",
    "revenue": "الإيرادات",
    "balance": "الرصيد",
    "managers": "المدراء",
    "resellers": "الموزعون",
    "customers": "العملاء",
    "activations": "التفعيلات"
  }
  ```
- [ ] Also add to `managerParent.sidebar`:
  ```json
  "teamNetwork": "شبكة الفريق"
  ```

---

### Task 4.8 — Dark mode verification
- [ ] Toggle dark mode and verify:
  - Canvas background: dark slate
  - Node cards: `dark:bg-slate-800` with proper text contrast
  - Edge colors visible on dark background
  - Mini-map readable in dark mode
  - Controls (zoom buttons) styled for dark mode

---

### Task 4.9 — RTL layout verification
- [ ] Switch to Arabic (`/ar/team-network`)
- [ ] Verify:
  - Page header text is right-aligned
  - Page description is right-aligned
  - Buttons are in correct RTL position
  - Node card text (name, role badge) reads RTL
  - Currency values remain LTR (numbers always left-to-right)
  - Canvas diagram itself remains LTR (left→right flow direction is intentional)

---

### Task 4.10 — Final integration test checklist
- [ ] Page loads without errors
- [ ] API call to `/team/network` returns 200
- [ ] Manager Parent node shows correct name, revenue, balance, counts
- [ ] Manager nodes show correct revenue, reseller count
- [ ] Reseller nodes show correct revenue, activation count, customer count
- [ ] Click Manager Parent revenue → navigates to `/reports`
- [ ] Click Manager Parent managers badge → navigates to `/team-management?role=manager`
- [ ] Click Manager name → navigates to `/team-management/{id}`
- [ ] Click Reseller revenue → navigates to `/reseller-payments` (payments list, not detail)
- [ ] Click Reseller activations → navigates to `/customers?reseller_id={id}`
- [ ] Click Reseller customers → navigates to `/customers?reseller_id={id}`
- [ ] Zoom in/out works with mouse wheel
- [ ] Pan works with click + drag
- [ ] Mini-map shows correct node positions
- [ ] "Reset View" button fits all nodes back to screen
- [ ] Loading state shows skeleton
- [ ] Error state shows error message
- [ ] Empty state shows correct message with link

---

## File Creation Summary

| # | Action | File |
|---|---|---|
| CREATE | New | `backend/app/Http/Controllers/ManagerParent/NetworkController.php` |
| MODIFY | Add route | `backend/routes/api.php` |
| MODIFY | Add types | `frontend/src/types/manager-parent.types.ts` |
| MODIFY | Add service method | `frontend/src/services/manager-parent.service.ts` |
| MODIFY | Add route path | `frontend/src/router/routes.ts` |
| MODIFY | Register route | `frontend/src/router/index.tsx` |
| CREATE | New page | `frontend/src/pages/manager-parent/TeamNetwork.tsx` |
| CREATE | Canvas wrapper | `frontend/src/components/team-network/NetworkCanvas.tsx` |
| CREATE | Root node card | `frontend/src/components/team-network/nodes/ManagerParentNode.tsx` |
| CREATE | Manager node card | `frontend/src/components/team-network/nodes/ManagerNode.tsx` |
| CREATE | Reseller node card | `frontend/src/components/team-network/nodes/ResellerNode.tsx` |
| CREATE | Animated edge | `frontend/src/components/team-network/edges/AnimatedEdge.tsx` |
| CREATE | Layout hook | `frontend/src/components/team-network/hooks/useNetworkLayout.ts` |
| MODIFY | Add sidebar item | `frontend/src/components/layout/Sidebar.tsx` |
| MODIFY | English strings | `frontend/src/locales/en.json` |
| MODIFY | Arabic strings | `frontend/src/locales/ar.json` |

---

## Definition of Done

- [ ] All 10 tasks in Phase 4.10 integration checklist pass
- [ ] No TypeScript errors (`npx tsc --noEmit -p tsconfig.app.json` — there is no `npm run type-check` script in this repo)
- [ ] No Tailwind inline styles — all classes only
- [ ] Dark mode works on all nodes and canvas
- [ ] Arabic RTL layout correct on page header and nodes
- [ ] All click targets navigate to correct existing pages
- [ ] Page appears in sidebar under manager_parent navigation
- [ ] API endpoint is protected by `role:manager_parent` middleware
