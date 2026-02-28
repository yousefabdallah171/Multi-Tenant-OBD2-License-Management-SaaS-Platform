# PHASE 07: UI/UX Polish

**Duration:** Day 9-10
**Status:** Pending
**Tests Target:** 25 responsive tests
**Depends On:** Phases 01-06 (All pages and charts built)

---

## Goals

- Polish all 43 pages to professional quality (MANDIAG-inspired)
- Add animations and transitions
- Implement loading states, error boundaries, and empty states
- Complete mobile responsive design with hamburger menu
- Ensure consistent shadcn/ui usage across all components
- Accessibility audit (keyboard navigation, screen readers)

---

## Animation & Transitions

### Page Transitions
- Fade-in on route change using `framer-motion` or CSS transitions
- Duration: 200ms ease-in-out

### Component Animations
- Cards: slide-up on mount (stagger for grids)
- Tables: fade-in rows
- Modals: scale-up from center
- Sidebar: slide left/right with easing
- Toasts: slide-in from top-right (or top-left in RTL)
- Charts: animate on first render (Recharts built-in)

### Micro-interactions
- Button hover: subtle scale (1.02) + shadow
- Button active: scale (0.98)
- Card hover: shadow elevation increase
- Toggle switches: smooth slide
- Progress bars: animate fill on mount
- Badge pulse for new notifications

### Implementation
```bash
npm install framer-motion
```

```tsx
// Page wrapper
import { motion } from 'framer-motion';

const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.div>
);
```

---

## Loading States

### Full Page Loading
- Centered spinner with "Loading..." text
- Used when initial page data is fetching
- shadcn Skeleton for layout placeholders

### Component Loading
- Skeleton cards (pulse animation) for stats cards
- Skeleton rows for data tables
- Chart placeholder (gray rectangle with pulse)
- Button loading: spinner replaces text, disabled state

### Skeleton Patterns

```tsx
// Stats card skeleton
<Card className="animate-pulse">
  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
</Card>

// Table skeleton
{[1,2,3,4,5].map(i => (
  <TableRow key={i}>
    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
  </TableRow>
))}
```

---

## Error Boundaries

### Global Error Boundary
- Catches React render errors
- Displays friendly error page: "Something went wrong"
- "Try Again" button (re-mount component)
- "Go to Dashboard" button (navigate home)
- Logs error to console (and optionally to backend)

### API Error Handling
- 401: Redirect to login (token expired)
- 403: "Access Denied" page
- 404: "Page Not Found" page
- 500: "Server Error" with retry button
- Network error: "Connection lost" toast with retry

### Error Pages
```
frontend/src/pages/errors/
├── NotFound.tsx           # 404 page
├── AccessDenied.tsx       # 403 page
├── ServerError.tsx        # 500 page
└── ErrorBoundary.tsx      # React error boundary wrapper
```

---

## Empty States

Every data view needs an empty state:

| Page | Empty State Message (AR) | Icon |
|------|-------------------------|------|
| Tenants | لا يوجد شركاء | Building2 |
| Users | لا يوجد مستخدمين | Users |
| Programs | لا توجد برامج | Package |
| Licenses | لا توجد تراخيص | Key |
| Customers | لا يوجد عملاء | UserPlus |
| Logs | لا توجد سجلات | ScrollText |
| Activity | لا يوجد نشاط | Clock |
| Reports | لا توجد بيانات | BarChart3 |

Each empty state includes:
- Large icon (gray, centered)
- Title text
- Description text
- Action button (e.g., "Add first program")

---

## Mobile Responsive Polish

### Hamburger Menu
- Mobile (<768px): Sidebar hidden, hamburger icon in navbar
- Click hamburger: sidebar slides over content (overlay)
- Backdrop (semi-transparent black) closes sidebar on click
- Animated: slide-in from left (LTR) or right (RTL)

### Mobile-Specific Adjustments
- Tables: horizontal scroll wrapper with shadow indicators
- Stats cards: 2x2 grid on mobile (not 4x1)
- Charts: full width, reduced height (200px vs 300px)
- Forms: full-width inputs, stacked labels
- Dialogs: full-screen on mobile (not centered modal)
- Action buttons: full-width on mobile
- Date pickers: mobile-friendly calendar

### Tablet Adjustments
- Sidebar collapsed (icon-only) by default
- 2-column card grids
- Tables show fewer columns (hide less important)

---

## shadcn/ui Component Audit

Verify these components are used consistently:

- [ ] Button: all buttons use shadcn variant (default, outline, ghost, destructive)
- [ ] Card: all cards use shadcn Card + CardHeader + CardContent
- [ ] Table: all tables use shadcn Table components
- [ ] Dialog: all modals use shadcn Dialog
- [ ] DropdownMenu: all context menus use shadcn Dropdown
- [ ] Select: all dropdowns use shadcn Select
- [ ] Input: all text inputs use shadcn Input
- [ ] Label: all form labels use shadcn Label
- [ ] Badge: all status indicators use shadcn Badge
- [ ] Tabs: all tab layouts use shadcn Tabs
- [ ] Toast: all notifications use Sonner (shadcn toast)
- [ ] Switch: all toggles use shadcn Switch
- [ ] Separator: dividers use shadcn Separator
- [ ] Progress: progress bars use shadcn Progress
- [ ] AlertDialog: confirmations use shadcn AlertDialog

---

## Accessibility

- [ ] All interactive elements keyboard-focusable
- [ ] Focus rings visible (Tailwind `focus-visible:ring-2`)
- [ ] Tab order logical per page
- [ ] ARIA labels on icon-only buttons
- [ ] Screen reader text for status badges
- [ ] Color contrast ratio >= 4.5:1 (text) and 3:1 (large text)
- [ ] Form labels associated with inputs
- [ ] Error messages announced by screen readers
- [ ] Skip navigation link (hidden until focused)

---

## Acceptance Criteria

- [ ] All 43 pages look professional and consistent
- [ ] Page transitions smooth (no flash/jank)
- [ ] Loading skeletons appear on all data-fetching components
- [ ] Error boundary catches and displays errors gracefully
- [ ] 404, 403, 500 error pages exist
- [ ] Empty states on all data views
- [ ] Mobile hamburger menu works with animation
- [ ] All shadcn/ui components used consistently
- [ ] Dark mode looks correct on all pages
- [ ] RTL Arabic layout correct on all pages
- [ ] Keyboard navigation works throughout
- [ ] No console errors or warnings
- [ ] 25 responsive tests passing
