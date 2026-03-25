# Complete Theming System Documentation

## 3-Level Color Customization Hierarchy

The application now supports a **3-level color override hierarchy** giving users maximum customization flexibility:

```
┌─────────────────────────────────────────────────────┐
│ 1. USER COLOR (Highest Priority) - Personal Override │
│    Set in: User Profile → Branding Settings         │
│    Overrides: Tenant & Role colors                  │
│    Who can set: Any user (all roles)               │
└─────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│ 2. TENANT COLOR (Medium Priority) - Organization  │
│    Set in: Manager-Parent Settings → Primary Color  │
│    Overrides: Role colors (for whole tenant)       │
│    Who can set: Manager-Parent users                │
└─────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│ 3. ROLE COLOR (Lowest Priority) - Defaults         │
│    Set in: Code (ROLE_DEFAULT_COLORS)              │
│    Applied when: No user or tenant override        │
│    Values:                                          │
│    - Super Admin: Rose (#dc2626)                   │
│    - Manager Parent: Sky (#0284c7)                 │
│    - Manager: Violet (#7c3aed)                     │
│    - Reseller: Emerald (#059669)                   │
│    - Customer: Slate (#64748b)                     │
└─────────────────────────────────────────────────────┘
```

## Implementation Details

### useBranding Hook (frontend/src/hooks/useBranding.ts)
```typescript
// Color resolution order:
primaryColor = userColor ?? tenantColor ?? roleDefaultColor ?? '#0284c7'
```

### Color Ramp Generation
Once the effective color is determined, `generateColorRamp()` creates 11 shades (50-950):
```
User sets: #f97316 (orange)
         ↓
generateColorRamp('#f97316')
         ↓
CSS Variables: --brand-50 through --brand-950
         ↓
All UI elements update: buttons, tabs, sidebar, navbar, charts
```

### User Type Configuration

**User Model (user.types.ts)**
```typescript
interface User {
  branding?: {
    primary_color?: string | null  // Individual user override
  }
}
```

## Visual Indicators

Every role displays **distinct visual indicators**:

- **Navbar Top Bar** — 1px colored bar (role/user/tenant color)
- **Navbar Bottom Border** — Colored border line
- **Sidebar Border** — 4px left/right border (role/user/tenant color)
- **Role Logo** — Different SVG icon per role in navbar
- **Interactive Elements**:
  - Buttons: brand-600 background
  - Tabs: brand-100/700 active state
  - Sidebar Links: brand-100/700 active state
  - Input Focus Ring: brand-500
  - Charts: Primary color + variations

## Scenarios

### Scenario 1: User with No Overrides
```
User: Manager
└─ User Color: None
└─ Tenant Color: None
└─ Result: Manager default (Violet #7c3aed)
```

### Scenario 2: Tenant Custom Color
```
User: Manager at MyCompany (Manager-Parent sets orange)
├─ User Color: None
├─ Tenant Color: #f97316 (orange)
└─ Result: Orange theme (even though user is Manager role)
```

### Scenario 3: User Personal Override
```
User: Manager at MyCompany (Tenant set orange)
├─ User Color: #8b5cf6 (personal purple preference)
├─ Tenant Color: #f97316 (orange) [ignored]
├─ Role Color: #7c3aed (violet) [ignored]
└─ Result: Purple theme (user's personal choice)
```

## API Requirements

To fully implement user-level customization, the backend needs:

### POST /api/users/{id}/branding
Update a user's personal color
```json
{
  "primary_color": "#8b5cf6"
}
```

### GET /api/users/profile
Include in user response:
```json
{
  "id": 1,
  "name": "John",
  "role": "manager",
  "branding": {
    "primary_color": "#8b5cf6"
  }
}
```

## UI Implementation

### Profile Page Color Picker
Add to all user profile pages:
```tsx
<div className="space-y-2">
  <Label htmlFor="user-primary-color">
    {t('common.personalColor')}
  </Label>
  <p className="text-xs text-slate-500">
    {t('common.personalColorHint')}
  </p>
  <div className="flex items-center gap-2">
    <input
      id="user-primary-color"
      type="color"
      value={form.branding.primary_color ?? '#0284c7'}
      onChange={(e) => setForm({
        ...form,
        branding: { primary_color: e.target.value }
      })}
      className="h-10 w-16 cursor-pointer rounded-lg border"
    />
    <span className="text-sm font-mono">
      {form.branding.primary_color ?? '#0284c7'}
    </span>
  </div>
</div>
```

## Benefits

✅ **Maximum Flexibility** — Users, tenants, and roles all have customization points
✅ **Clear Hierarchy** — Intuitive override system
✅ **Backward Compatible** — Existing tenants work unchanged
✅ **Role-Based Defaults** — Each role has distinct, recognizable color
✅ **Immediate Feedback** — All UI updates when color changes
✅ **No Page Reload** — useBranding hook applies changes in real-time

## Testing Checklist

- [ ] Login as Super Admin → See rose-red theme
- [ ] Login as Manager → See violet theme
- [ ] Login as Reseller → See emerald theme
- [ ] Manager-Parent sets tenant color → All roles in tenant change color
- [ ] User sets personal color → Only that user's dashboard changes
- [ ] Set color, switch dark mode → Color persists, charts update
- [ ] Upload custom logo → Replaces role SVG, color indicators remain
