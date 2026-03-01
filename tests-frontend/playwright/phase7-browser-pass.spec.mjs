import { expect, test } from '@playwright/test'

const AUTH_STORAGE_KEY = 'license-auth'
const LANGUAGE_STORAGE_KEY = 'license-language'
const THEME_STORAGE_KEY = 'license-theme'

const tenant = {
  id: 1,
  name: 'OBD2SW Garage',
  slug: 'obd2sw-garage',
  status: 'active',
}

const teamMembers = [
  {
    id: 11,
    name: 'Reseller Alpha',
    email: 'alpha@obd2sw.com',
    phone: null,
    role: 'reseller',
    status: 'active',
    customers_count: 1,
    active_licenses_count: 2,
    revenue: 109.97,
    created_at: '2026-02-10T10:00:00Z',
  },
]

const programs = [
  {
    id: 201,
    name: 'OBD Master',
    description: 'Diagnostics and activation toolkit.',
    version: '4.2.1',
    download_link: 'https://example.com/download/obd-master',
    file_size: '145 MB',
    system_requirements: 'Windows 10+',
    installation_guide_url: 'https://example.com/install/obd-master',
    trial_days: 7,
    base_price: 99.99,
    icon: null,
    status: 'active',
    licenses_sold: 12,
    active_licenses_count: 8,
    revenue: 1299.88,
    created_at: '2026-01-12T09:00:00Z',
  },
]

const customers = [
  {
    id: 301,
    name: 'Ahmed Salem',
    email: 'ahmed@example.com',
    phone: '+20 100 000 0000',
    license_id: 401,
    bios_id: 'BIOS-AR-001',
    program: 'OBD Master',
    status: 'active',
    price: 109.97,
    expiry: '2026-08-01T00:00:00Z',
    license_count: 1,
  },
]

const managerCustomers = [
  {
    id: 301,
    name: 'Ahmed Salem',
    email: 'ahmed@example.com',
    bios_id: 'BIOS-AR-001',
    reseller: 'Reseller Alpha',
    reseller_id: 11,
    program: 'OBD Master',
    status: 'active',
    expiry: '2026-08-01T00:00:00Z',
    license_count: 1,
  },
]

const licenses = [
  {
    id: 401,
    customer_id: 301,
    customer_name: 'Ahmed Salem',
    customer_email: 'ahmed@example.com',
    bios_id: 'BIOS-AR-001',
    program: 'OBD Master',
    program_id: 201,
    duration_days: 365,
    price: 109.97,
    activated_at: '2026-02-01T00:00:00Z',
    expires_at: '2026-08-01T00:00:00Z',
    status: 'active',
  },
]

const superAdminUsers = [
  {
    id: 1,
    name: 'Super Admin',
    email: 'admin@obd2sw.com',
    username: 'admin',
    role: 'super_admin',
    status: 'active',
    username_locked: false,
    tenant: null,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Manager Parent',
    email: 'manager-parent@obd2sw.com',
    username: 'manager-parent',
    role: 'manager_parent',
    status: 'active',
    username_locked: false,
    tenant,
    created_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 3,
    name: 'Reseller Alpha',
    email: 'alpha@obd2sw.com',
    username: 'alpha',
    role: 'reseller',
    status: 'active',
    username_locked: false,
    tenant,
    created_at: '2026-01-03T00:00:00Z',
  },
  {
    id: 4,
    name: 'Ahmed Salem',
    email: 'ahmed@example.com',
    username: 'ahmed',
    role: 'customer',
    status: 'active',
    username_locked: false,
    tenant,
    created_at: '2026-01-04T00:00:00Z',
  },
]

const biosEntries = [
  {
    id: 1,
    bios_id: 'BIOS-AR-001',
    reason: 'Duplicate hardware fingerprint',
    status: 'active',
    added_by: 'Super Admin',
    created_at: '2026-02-10T00:00:00Z',
  },
]

const biosHistory = [
  {
    id: 'history-1',
    bios_id: 'BIOS-AR-001',
    tenant_id: 1,
    tenant: 'OBD2SW Garage',
    customer: 'Ahmed Salem',
    action: 'Activated',
    status: 'success',
    description: 'License activated for OBD Master',
    occurred_at: '2026-02-01T10:00:00Z',
  },
]

const usernameManagedUsers = [
  {
    id: 3,
    name: 'Reseller Alpha',
    username: 'alpha',
    email: 'alpha@obd2sw.com',
    role: 'reseller',
    status: 'active',
    username_locked: false,
    created_at: '2026-01-03T00:00:00Z',
  },
]

const activityEntries = [
  {
    id: 1,
    action: 'License activated',
    description: 'Ahmed Salem received an annual OBD Master license.',
    metadata: {},
    ip_address: '41.33.11.10',
    user: { id: 3, name: 'Reseller Alpha' },
    created_at: '2026-02-20T10:00:00Z',
  },
]

const routeSets = {
  superAdmin: [
    '/en/super-admin/dashboard',
    '/en/super-admin/tenants',
    '/en/super-admin/users',
    '/en/super-admin/admin-management',
    '/en/super-admin/bios-blacklist',
    '/en/super-admin/bios-history',
    '/en/super-admin/username-management',
    '/en/super-admin/financial-reports',
    '/en/super-admin/reports',
    '/en/super-admin/logs',
    '/en/super-admin/api-status',
    '/en/super-admin/settings',
    '/en/super-admin/profile',
  ],
  managerParent: [
    '/en/dashboard',
    '/en/team-management',
    '/en/reseller-pricing',
    '/en/software-management',
    '/en/bios-blacklist',
    '/en/bios-history',
    '/en/ip-analytics',
    '/en/username-management',
    '/en/financial-reports',
    '/en/reports',
    '/en/activity',
    '/en/customers',
    '/en/settings',
    '/en/profile',
  ],
  manager: [
    '/ar/manager/dashboard',
    '/ar/manager/team',
    '/ar/manager/username-management',
    '/ar/manager/customers',
    '/ar/manager/software',
    '/ar/manager/reports',
    '/ar/manager/activity',
    '/ar/manager/profile',
  ],
  reseller: [
    '/en/reseller/dashboard',
    '/en/reseller/customers',
    '/en/reseller/software',
    '/en/reseller/licenses',
    '/en/reseller/reports',
    '/en/reseller/activity',
    '/en/reseller/profile',
  ],
  customer: [
    '/en/customer/dashboard',
    '/en/customer/software',
    '/en/customer/download',
  ],
}

function paginated(data) {
  return {
    data,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: Math.max(data.length, 10),
      total: data.length,
      from: data.length ? 1 : null,
      to: data.length || null,
    },
  }
}

function buildUser(role, lang) {
  const names = {
    super_admin: 'Super Admin',
    manager_parent: lang === 'ar' ? 'المدير الرئيسي' : 'Manager Parent',
    manager: lang === 'ar' ? 'مدير' : 'Manager',
    reseller: lang === 'ar' ? 'موزع' : 'Reseller',
    customer: lang === 'ar' ? 'عميل' : 'Customer',
  }

  return {
    id: 99,
    tenant_id: role === 'super_admin' ? null : tenant.id,
    name: names[role],
    username: role,
    email: `${role}@obd2sw.com`,
    phone: null,
    role,
    status: 'active',
    created_by: 1,
    username_locked: false,
    tenant: role === 'super_admin' ? null : tenant,
  }
}

function buildMockPayloads(empty = false) {
  return {
    superAdminStats: {
      total_tenants: empty ? 0 : 3,
      total_revenue: empty ? 0 : 12450.35,
      active_licenses: empty ? 0 : 32,
      total_users: empty ? 0 : 27,
      ip_country_map: empty ? [] : [{ country: 'Egypt', count: 14 }, { country: 'Germany', count: 4 }],
    },
    managerParentStats: {
      users: empty ? 0 : 12,
      programs: empty ? 0 : 5,
      licenses: empty ? 0 : 21,
      active_licenses: empty ? 0 : 18,
      revenue: empty ? 0 : 9800,
      team_members: empty ? 0 : 4,
      total_customers: empty ? 0 : 12,
      monthly_revenue: empty ? 0 : 2100.25,
    },
    managerStats: {
      team_resellers: empty ? 0 : 1,
      team_customers: empty ? 0 : 1,
      active_licenses: empty ? 0 : 2,
      team_revenue: empty ? 0 : 109.97,
      monthly_activations: empty ? 0 : 3,
    },
    resellerStats: {
      customers: empty ? 0 : 2,
      active_licenses: empty ? 0 : 3,
      revenue: empty ? 0 : 240,
      monthly_activations: empty ? 0 : 2,
    },
    customerDashboard: {
      summary: {
        total_licenses: empty ? 0 : 2,
        active_licenses: empty ? 0 : 1,
        expired_licenses: empty ? 0 : 1,
      },
      licenses: empty
        ? []
        : [
            {
              id: 401,
              program_id: 201,
              program_name: 'OBD Master',
              program_description: 'Diagnostics and activation toolkit.',
              program_version: '4.2.1',
              program_icon: null,
              bios_id: 'BIOS-AR-001',
              status: 'active',
              activated_at: '2026-02-01T00:00:00Z',
              expires_at: '2026-08-01T00:00:00Z',
              days_remaining: 155,
              percentage_remaining: 72,
              download_link: 'https://example.com/download/obd-master',
              reseller_name: 'Reseller Alpha',
              reseller_email: 'alpha@obd2sw.com',
              can_download: true,
            },
          ],
    },
    series: empty
      ? []
      : [
          { month: 'Oct 2025', revenue: 80, count: 1, activations: 1 },
          { month: 'Dec 2025', revenue: 95, count: 2, activations: 2 },
          { month: 'Feb 2026', revenue: 109.97, count: 3, activations: 3 },
        ],
    teamMembers: empty ? [] : teamMembers,
    programs: empty ? [] : programs,
    customers: empty ? [] : customers,
    managerCustomers: empty ? [] : managerCustomers,
    licenses: empty ? [] : licenses,
    activity: empty ? [] : activityEntries,
    biosEntries: empty ? [] : biosEntries,
    biosHistory: empty ? [] : biosHistory,
    users: empty ? [] : superAdminUsers,
    usernameManagedUsers: empty ? [] : usernameManagedUsers,
  }
}

function resolveMockResponse(path, empty = false) {
  const mock = buildMockPayloads(empty)

  if (path === '/health') {
    return { status: 'ok' }
  }

  if (path === '/super-admin/dashboard/stats') {
    return { data: { stats: mock.superAdminStats } }
  }

  if (path === '/super-admin/dashboard/revenue-trend') {
    return { data: mock.series.map(({ month, revenue }) => ({ month, revenue })) }
  }

  if (path === '/super-admin/dashboard/tenant-comparison') {
    return { data: (empty ? [] : [{ id: 1, name: tenant.name, revenue: 12450.35, active_licenses: 18 }]) }
  }

  if (path === '/super-admin/dashboard/license-timeline') {
    return { data: mock.series.map(({ month, count }) => ({ label: month, date: month, count })) }
  }

  if (path === '/super-admin/dashboard/recent-activity') {
    return { data: mock.activity.map((entry) => ({ id: entry.id, action: entry.action, description: entry.description, user: entry.user?.name ?? null, tenant: tenant.name, created_at: entry.created_at })) }
  }

  if (path === '/super-admin/tenants') {
    return paginated(
      empty
        ? []
        : [
            {
              id: 1,
              name: tenant.name,
              slug: tenant.slug,
              status: 'active',
              settings: null,
              managers_count: 1,
              resellers_count: 1,
              customers_count: 1,
              active_licenses_count: 2,
              revenue: 12450.35,
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
    )
  }

  if (/^\/super-admin\/tenants\/\d+\/stats$/.test(path)) {
    return { data: { users: 12, resellers: 4, customers: 9, licenses: 18, active_licenses: 14, revenue: 9800 } }
  }

  if (path === '/super-admin/users') {
    return {
      ...paginated(mock.users),
      role_counts: {
        super_admin: empty ? 0 : 1,
        manager_parent: empty ? 0 : 1,
        manager: 0,
        reseller: empty ? 0 : 1,
        customer: empty ? 0 : 1,
      },
    }
  }

  if (path === '/super-admin/admin-management') {
    return paginated(mock.users.filter((user) => user.role === 'super_admin' || user.role === 'manager_parent'))
  }

  if (path === '/super-admin/bios-blacklist') {
    return paginated(mock.biosEntries)
  }

  if (path === '/super-admin/bios-blacklist/stats') {
    return { data: empty ? [] : [{ month: 'Jan 2026', additions: 1, removals: 0 }, { month: 'Feb 2026', additions: 2, removals: 1 }] }
  }

  if (path === '/super-admin/bios-history') {
    return paginated(mock.biosHistory)
  }

  if (/^\/super-admin\/bios-history\/[^/]+$/.test(path)) {
    return { data: { bios_id: 'BIOS-AR-001', events: mock.biosHistory } }
  }

  if (path === '/super-admin/username-management') {
    return paginated(mock.usernameManagedUsers)
  }

  if (path === '/super-admin/financial-reports') {
    return {
      data: {
        summary: {
          total_platform_revenue: empty ? 0 : 12450.35,
          total_activations: empty ? 0 : 28,
          active_licenses: empty ? 0 : 18,
          avg_revenue_per_tenant: empty ? 0 : 4150.12,
        },
        revenue_by_tenant: empty ? [] : [{ tenant: tenant.name, revenue: 12450.35 }],
        revenue_by_program: empty ? [] : [{ program: 'OBD Master', revenue: 12450.35, activations: 28 }],
        revenue_breakdown: empty ? [] : [{ month: 'Feb 2026', 'OBD Master': 12450.35 }],
        revenue_breakdown_series: empty ? [] : ['OBD Master'],
        monthly_revenue: empty ? [] : [{ month: 'Dec 2025', revenue: 8600 }, { month: 'Feb 2026', revenue: 12450.35 }],
        reseller_balances: empty ? [] : [{ id: 1, reseller: 'Reseller Alpha', tenant: tenant.name, total_revenue: 12450.35, total_activations: 28, avg_price: 109.97, balance: 2400 }],
      },
    }
  }

  if (path === '/super-admin/reports/revenue') {
    return { data: empty ? [] : [{ tenant: tenant.name, revenue: 12450.35 }] }
  }

  if (path === '/super-admin/reports/activations') {
    return { data: empty ? [] : mock.series.map(({ month, count }) => ({ month, count })) }
  }

  if (path === '/super-admin/reports/growth') {
    return { data: empty ? [] : mock.series.map(({ month, revenue }) => ({ month, revenue })) }
  }

  if (path === '/super-admin/reports/top-resellers') {
    return { data: empty ? [] : [{ reseller: 'Reseller Alpha', tenant: tenant.name, activations: 3, revenue: 109.97 }] }
  }

  if (path === '/super-admin/logs') {
    return paginated(
      empty
        ? []
        : [
            {
              id: 1,
              tenant: tenant.name,
              user: 'Super Admin',
              endpoint: '/api/super-admin/users',
              method: 'GET',
              status_code: 200,
              response_time_ms: 120,
              request_body: null,
              response_body: { ok: true },
              created_at: '2026-02-28T09:00:00Z',
            },
          ],
    )
  }

  if (/^\/super-admin\/logs\/\d+$/.test(path)) {
    return {
      data: {
        id: 1,
        tenant: tenant.name,
        user: 'Super Admin',
        endpoint: '/api/super-admin/users',
        method: 'GET',
        status_code: 200,
        response_time_ms: 120,
        request_body: null,
        response_body: { ok: true },
        created_at: '2026-02-28T09:00:00Z',
      },
    }
  }

  if (path === '/super-admin/api-status') {
    return {
      data: {
        status: empty ? 'offline' : 'online',
        last_check_at: '2026-02-28T12:00:00Z',
        response_time_ms: empty ? 0 : 120,
        uptime: { '24h': empty ? 0 : 99.9, '7d': empty ? 0 : 99.7, '30d': empty ? 0 : 99.5 },
        endpoints: empty ? [] : [{ endpoint: '/api/health', status: 'online', status_code: 200, last_checked_at: '2026-02-28T12:00:00Z' }],
      },
    }
  }

  if (path === '/super-admin/api-status/history') {
    return { data: empty ? [] : [{ time: '12:00', response_time_ms: 120, status_code: 200 }] }
  }

  if (path === '/super-admin/settings') {
    return {
      data: {
        general: { platform_name: 'OBD2SW', default_trial_days: 7, maintenance_mode: false },
        api: { url: 'https://api.obd2sw.com', key: 'sk_live_demo', timeout: 30, retries: 3 },
        notifications: { email_enabled: true, pusher_enabled: false },
        security: { min_password_length: 8, session_timeout: 120 },
      },
    }
  }

  if (path === '/dashboard/stats') {
    return { stats: mock.managerParentStats }
  }

  if (path === '/dashboard/revenue-chart') {
    return { data: empty ? [] : mock.series.map(({ month, revenue }) => ({ month, revenue })) }
  }

  if (path === '/dashboard/expiry-forecast') {
    return { data: empty ? [] : [{ range: '0-30 days', count: 2 }, { range: '31-60 days', count: 1 }, { range: '61-90 days', count: 1 }] }
  }

  if (path === '/dashboard/team-performance') {
    return { data: empty ? [] : [{ id: 11, name: 'Reseller Alpha', role: 'reseller', activations: 3, revenue: 109.97, customers: 1 }] }
  }

  if (path === '/dashboard/conflict-rate') {
    return { data: empty ? [] : [{ month: 'Dec 2025', count: 1 }, { month: 'Feb 2026', count: 0 }] }
  }

  if (path === '/reports/revenue-by-reseller') {
    return { data: empty ? [] : [{ reseller: 'Reseller Alpha', revenue: 109.97, activations: 3 }] }
  }

  if (path === '/reports/revenue-by-program') {
    return { data: empty ? [] : [{ program: 'OBD Master', revenue: 109.97, activations: 3 }] }
  }

  if (path === '/reports/activation-rate') {
    return { data: empty ? [] : [{ label: 'Successful', count: 3, percentage: 100 }] }
  }

  if (path === '/reports/retention') {
    return { data: empty ? [] : [{ month: 'Feb 2026', customers: 1, activations: 3 }] }
  }

  if (path === '/settings') {
    return {
      data: {
        business: { company_name: tenant.name, email: 'team@obd2sw.com', phone: '+1 555 0100', address: 'Cairo' },
        defaults: { trial_days: 7, base_price: 99.99 },
        notifications: { new_activations: true, expiry_warnings: true },
        branding: { logo: null },
      },
    }
  }

  if (path === '/bios-history') {
    return paginated(mock.biosHistory)
  }

  if (path === '/bios-blacklist') {
    return paginated(mock.biosEntries)
  }

  if (/^\/bios-history\/[^/]+$/.test(path)) {
    return { data: { bios_id: 'BIOS-AR-001', events: mock.biosHistory } }
  }

  if (path === '/ip-analytics') {
    return paginated(
      empty
        ? []
        : [
            {
              id: 1,
              user: { id: 11, name: 'Reseller Alpha', email: 'alpha@obd2sw.com' },
              ip_address: '41.33.11.10',
              country: 'Egypt',
              city: 'Cairo',
              isp: 'ISP Demo',
              reputation_score: 'low',
              action: 'Activation',
              created_at: '2026-02-20T10:00:00Z',
            },
          ],
    )
  }

  if (path === '/ip-analytics/stats') {
    return {
      data: {
        countries: empty ? [] : [{ country: 'Egypt', count: 3 }],
        suspicious: empty ? [] : [{ id: 1, ip_address: '41.33.11.10', country: 'Egypt', user_id: 11, created_at: '2026-02-20T10:00:00Z' }],
      },
    }
  }

  if (path === '/username-management') {
    return paginated(mock.usernameManagedUsers)
  }

  if (path === '/financial-reports') {
    return {
      data: {
        summary: { total_revenue: empty ? 0 : 109.97, total_activations: empty ? 0 : 3, active_licenses: empty ? 0 : 2 },
        revenue_by_reseller: empty ? [] : [{ reseller: 'Reseller Alpha', revenue: 109.97, activations: 3 }],
        revenue_by_program: empty ? [] : [{ program: 'OBD Master', revenue: 109.97, activations: 3 }],
        monthly_revenue: empty ? [] : [{ month: 'Feb 2026', revenue: 109.97 }],
        reseller_balances: empty ? [] : [{ id: 1, reseller: 'Reseller Alpha', total_revenue: 109.97, total_activations: 3, avg_price: 109.97, commission: 21.99 }],
      },
    }
  }

  if (path === '/team') {
    return paginated(mock.teamMembers)
  }

  if (/^\/team\/\d+\/stats$/.test(path)) {
    return { data: { customers: 1, active_licenses: 2, revenue: 109.97 } }
  }

  if (path === '/pricing') {
    return {
      data: {
        resellers: empty ? [] : [{ id: 11, name: 'Reseller Alpha', email: 'alpha@obd2sw.com' }],
        selected_reseller_id: empty ? null : 11,
        programs: empty ? [] : [{ program_id: 201, program_name: 'OBD Master', base_price: 99.99, reseller_price: 79.99, commission_rate: 15, margin: 20 }],
      },
    }
  }

  if (path === '/pricing/history') {
    return { data: empty ? [] : [{ id: 1, reseller: 'Reseller Alpha', program: 'OBD Master', old_price: 74.99, new_price: 79.99, commission_rate: 15, change_type: 'single', changed_by: 'Manager Parent', created_at: '2026-02-14T12:00:00Z' }] }
  }

  if (path === '/programs') {
    return paginated(mock.programs)
  }

  if (/^\/programs\/\d+\/stats$/.test(path)) {
    return { data: { licenses_sold: 12, active_licenses: 8, expired_licenses: 2, revenue: 1299.88 } }
  }

  if (path === '/customers') {
    return paginated(
      empty
        ? []
        : mock.managerCustomers.map((customer) => ({
            id: customer.id,
            name: customer.name,
            email: customer.email,
            bios_id: customer.bios_id,
            reseller: customer.reseller,
            program: customer.program,
            status: customer.status,
            expiry: customer.expiry,
            license_count: customer.license_count,
          })),
    )
  }

  if (/^\/customers\/\d+$/.test(path)) {
    const customer = mock.managerCustomers[0]
    return {
      data: customer
        ? {
            ...customer,
            licenses: mock.licenses.map((license) => ({
              id: license.id,
              bios_id: license.bios_id,
              program: license.program,
              reseller: 'Reseller Alpha',
              status: license.status,
              price: license.price,
              activated_at: license.activated_at,
              expires_at: license.expires_at,
            })),
          }
        : null,
    }
  }

  if (path === '/activity') {
    return paginated(mock.activity)
  }

  if (path === '/manager/dashboard/stats') {
    return { stats: mock.managerStats }
  }

  if (path === '/manager/dashboard/activations-chart') {
    return { data: empty ? [] : mock.series.map(({ month, count }) => ({ month, count })) }
  }

  if (path === '/manager/dashboard/revenue-chart') {
    return { data: empty ? [] : [{ reseller: 'Reseller Alpha', revenue: 109.97 }] }
  }

  if (path === '/manager/dashboard/recent-activity') {
    return { data: mock.activity }
  }

  if (path === '/manager/team') {
    return paginated(
      empty
        ? []
        : mock.teamMembers.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            phone: member.phone,
            status: member.status,
            customers_count: member.customers_count,
            active_licenses_count: member.active_licenses_count,
            revenue: member.revenue,
            created_at: member.created_at,
          })),
    )
  }

  if (/^\/manager\/team\/\d+$/.test(path)) {
    return {
      data: empty
        ? null
        : {
            ...mock.teamMembers[0],
            recent_licenses: mock.licenses.map((license) => ({
              id: license.id,
              customer: { id: 301, name: 'Ahmed Salem', email: 'ahmed@example.com' },
              program: license.program,
              bios_id: license.bios_id,
              status: license.status,
              price: license.price,
              expires_at: license.expires_at,
            })),
          },
    }
  }

  if (path === '/manager/username-management') {
    return paginated(mock.usernameManagedUsers)
  }

  if (path === '/manager/customers') {
    return paginated(mock.managerCustomers)
  }

  if (/^\/manager\/customers\/\d+$/.test(path)) {
    const customer = mock.managerCustomers[0]
    return {
      data: customer
        ? {
            ...customer,
            licenses: mock.licenses.map((license) => ({
              id: license.id,
              bios_id: license.bios_id,
              program: license.program,
              reseller: 'Reseller Alpha',
              status: license.status,
              price: license.price,
              activated_at: license.activated_at,
              expires_at: license.expires_at,
            })),
          }
        : null,
    }
  }

  if (path === '/manager/reports/revenue') {
    return { data: empty ? [] : [{ reseller: 'Reseller Alpha', revenue: 109.97, activations: 3 }] }
  }

  if (path === '/manager/reports/activations') {
    return { data: empty ? [] : mock.series.map(({ month, count }) => ({ month, count })) }
  }

  if (path === '/manager/reports/top-resellers') {
    return { data: empty ? [] : [{ id: 11, reseller: 'Reseller Alpha', revenue: 109.97, activations: 3, customers: 1 }] }
  }

  if (path === '/manager/activity') {
    return paginated(mock.activity)
  }

  if (path === '/reseller/dashboard/stats') {
    return { stats: mock.resellerStats }
  }

  if (path === '/reseller/dashboard/activations-chart') {
    return { data: empty ? [] : mock.series.map(({ month, count }) => ({ month, count })) }
  }

  if (path === '/reseller/dashboard/revenue-chart') {
    return { data: empty ? [] : mock.series.map(({ month, revenue }) => ({ month, revenue })) }
  }

  if (path === '/reseller/dashboard/recent-activity') {
    return { data: mock.activity }
  }

  if (path === '/reseller/customers') {
    return paginated(mock.customers)
  }

  if (/^\/reseller\/customers\/\d+$/.test(path)) {
    const customer = mock.customers[0]
    return {
      data: customer
        ? {
            ...customer,
            licenses: mock.licenses.map((license) => ({
              id: license.id,
              bios_id: license.bios_id,
              program: license.program,
              status: license.status,
              price: license.price,
              activated_at: license.activated_at,
              expires_at: license.expires_at,
            })),
          }
        : null,
    }
  }

  if (path === '/reseller/licenses') {
    return paginated(mock.licenses)
  }

  if (/^\/reseller\/licenses\/\d+$/.test(path)) {
    const license = mock.licenses[0]
    return {
      data: license
        ? {
            ...license,
            customer: { id: 301, name: 'Ahmed Salem', email: 'ahmed@example.com', phone: '+20 100 000 0000' },
            program_version: '4.2.1',
            download_link: 'https://example.com/download/obd-master',
            activity: mock.activity.map((entry) => ({ id: entry.id, action: entry.action, description: entry.description, created_at: entry.created_at })),
          }
        : null,
    }
  }

  if (path === '/reseller/licenses/expiring') {
    return { data: mock.licenses }
  }

  if (path === '/reseller/reports/revenue') {
    return { data: empty ? [] : [{ period: 'Feb 2026', revenue: 240, count: 3 }] }
  }

  if (path === '/reseller/reports/activations') {
    return { data: empty ? [] : [{ period: 'Feb 2026', revenue: 240, count: 3 }] }
  }

  if (path === '/reseller/reports/top-programs') {
    return { data: empty ? [] : [{ program: 'OBD Master', count: 3, revenue: 240 }] }
  }

  if (path === '/reseller/activity') {
    return paginated(mock.activity)
  }

  if (path === '/customer/dashboard') {
    return { data: mock.customerDashboard }
  }

  if (path === '/customer/software') {
    return {
      data: empty
        ? []
        : mock.customerDashboard.licenses.map((license) => ({
            id: license.program_id,
            license_id: license.id,
            program_id: license.program_id,
            name: license.program_name,
            description: license.program_description,
            version: license.program_version,
            icon: null,
            status: license.status,
            download_link: license.download_link,
            file_size: '145 MB',
            system_requirements: 'Windows 10+',
            installation_guide_url: 'https://example.com/install/obd-master',
            expires_at: license.expires_at,
            days_remaining: license.days_remaining,
            can_download: license.can_download,
          })),
    }
  }

  if (path === '/customer/downloads') {
    return {
      data: empty
        ? []
        : mock.customerDashboard.licenses.map((license) => ({
            id: license.id,
            license_id: license.id,
            program_id: license.program_id,
            program_name: license.program_name,
            version: license.program_version,
            download_link: license.download_link,
            file_size: '145 MB',
            last_downloaded_at: '2026-02-20T10:00:00Z',
            system_requirements: 'Windows 10+',
            installation_guide_url: 'https://example.com/install/obd-master',
            status: license.status,
            days_remaining: license.days_remaining,
            can_download: license.can_download,
          })),
    }
  }

  if (path === '/auth/me') {
    return { user: buildUser('manager', 'en') }
  }

  if (path === '/auth/logout') {
    return { message: 'Logged out' }
  }

  return { data: [], meta: paginated([]).meta }
}

async function seedSession(page, { role, lang = 'en', theme = 'light' }) {
  const user = buildUser(role, lang)
  await page.addInitScript(
    ({ authStorageKey, languageStorageKey, themeStorageKey, sessionUser, sessionLang, sessionTheme }) => {
      window.localStorage.setItem(authStorageKey, JSON.stringify({ token: 'phase7-token', user: sessionUser }))
      window.localStorage.setItem(languageStorageKey, sessionLang)

      if (!window.localStorage.getItem(themeStorageKey)) {
        window.localStorage.setItem(themeStorageKey, sessionTheme)
      }
    },
    {
      authStorageKey: AUTH_STORAGE_KEY,
      languageStorageKey: LANGUAGE_STORAGE_KEY,
      themeStorageKey: THEME_STORAGE_KEY,
      sessionUser: user,
      sessionLang: lang,
      sessionTheme: theme,
    },
  )
}

async function mockApi(page, { empty = false, delayedPaths = [] } = {}) {
  const delayed = new Set(delayedPaths)

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^\/api/, '')

    if (delayed.has(path)) {
      await new Promise((resolve) => setTimeout(resolve, 900))
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(resolveMockResponse(path, empty)),
    })
  })
}

function collectRuntimeErrors(page) {
  const pageErrors = []
  const consoleErrors = []

  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text()

      if (!text.includes('favicon') && !text.includes('Failed to load resource') && !text.includes('[vite] Failed to reload')) {
        consoleErrors.push(text)
      }
    }
  })

  return { pageErrors, consoleErrors }
}

function assertRuntimeClean(runtime, routePath) {
  expect.soft(runtime.pageErrors, `page errors on ${routePath}`).toEqual([])
  expect.soft(runtime.consoleErrors, `console errors on ${routePath}`).toEqual([])
}

async function visitRoutes(page, routes) {
  const runtime = collectRuntimeErrors(page)

  for (const routePath of routes) {
    runtime.pageErrors.length = 0
    runtime.consoleErrors.length = 0

    await page.goto(routePath, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(new RegExp(`${routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/Something went wrong|حدث خطأ ما/)
    await page.keyboard.press('Tab')
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName ?? 'BODY')).not.toBe('BODY')

    assertRuntimeClean(runtime, routePath)
  }
}

test('renders guest routes', async ({ page }) => {
  await page.goto('/en/login')
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('body')).toContainText(/Sign in|Login/i)

  await page.goto('/en/forgot-password')
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('body')).toContainText(/Forgot password|Reset/i)
})

test('holds the expected responsive layout at 375, 768, 1024, and 1440', async ({ page }) => {
  await seedSession(page, { role: 'manager', lang: 'en' })
  await mockApi(page)

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/en/manager/dashboard')
  await page.waitForLoadState('networkidle')
  const mobileCards = await page.getByTestId('stats-card').evaluateAll((elements) =>
    elements.slice(0, 4).map((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width }
    }),
  )
  expect(Math.abs(mobileCards[0].y - mobileCards[1].y)).toBeLessThanOrEqual(4)
  expect(mobileCards[2].y).toBeGreaterThan(mobileCards[0].y + 8)
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeVisible()

  await page.setViewportSize({ width: 768, height: 1024 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeVisible()
  await expect(page.locator('[data-testid="desktop-sidebar-shell"]')).not.toBeVisible()

  await page.setViewportSize({ width: 1024, height: 900 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[data-testid="desktop-sidebar-shell"]')).toBeVisible()

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  const desktopCards = await page.getByTestId('stats-card').evaluateAll((elements) =>
    elements.slice(0, 4).map((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width }
    }),
  )
  expect(Math.abs(desktopCards[0].y - desktopCards[3].y)).toBeLessThanOrEqual(4)
  expect(desktopCards[3].x).toBeGreaterThan(desktopCards[0].x + desktopCards[0].width)
})

test('keeps the Arabic manager desktop sidebar on the right and removes hardcoded English shell copy', async ({ page }) => {
  await seedSession(page, { role: 'manager', lang: 'ar' })
  await mockApi(page)

  await page.goto('/ar/manager/dashboard')
  await page.waitForLoadState('networkidle')

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeVisible()
  await expect(page.locator('main')).toContainText('إجراءات المدير')
  await expect(page.locator('main')).toContainText('مراجعة موزعي الفريق')
  await expect(page.locator('main')).not.toContainText('Manager Actions')
  await expect(page.locator('main')).not.toContainText('Review Team Resellers')

  const [sidebarBox, mainBox] = await Promise.all([page.locator('[data-testid="desktop-sidebar"]').boundingBox(), page.locator('main').boundingBox()])
  expect(sidebarBox).not.toBeNull()
  expect(mainBox).not.toBeNull()
  expect(sidebarBox.x).toBeGreaterThan(mainBox.x)
})

test('opens the Arabic mobile sidebar from the right and keeps reseller mobile surfaces responsive', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await seedSession(page, { role: 'manager', lang: 'ar' })
  await mockApi(page)

  await page.goto('/ar/manager/dashboard')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'فتح قائمة التنقل' }).click()

  const mobileSidebar = page.locator('[data-testid="mobile-sidebar"]')
  await expect(mobileSidebar).toBeVisible()
  await expect(mobileSidebar).toHaveClass(/right-0/)
  await expect(mobileSidebar).not.toHaveClass(/left-0/)

  await page.mouse.click(20, 160)
  await expect(mobileSidebar).toHaveClass(/translate-x-full/)

  await page.unroute('**/api/**')
  await seedSession(page, { role: 'reseller', lang: 'en' })
  await mockApi(page)
  await page.goto('/en/reseller/customers')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /add customer/i }).click()

  const dialog = page.locator('[role="dialog"]')
  const dialogBox = await dialog.boundingBox()
  expect(dialogBox).not.toBeNull()
  expect(dialogBox.x).toBeLessThanOrEqual(2)
  expect(dialogBox.width).toBeGreaterThanOrEqual(370)

  await page.goto('/en/reseller/licenses')
  await page.waitForLoadState('networkidle')
  const overflowX = await page.locator('[data-testid="responsive-table"]').evaluate((element) => {
    const scrollRegion = element.querySelector('.overflow-x-auto')
    return scrollRegion ? window.getComputedStyle(scrollRegion).overflowX : ''
  })
  expect(overflowX).toBe('auto')
})

test('preserves dark mode across reloads and serves all error routes', async ({ page }) => {
  await seedSession(page, { role: 'super_admin', lang: 'en' })
  await mockApi(page)

  await page.goto('/en/super-admin/dashboard')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Toggle theme' }).click()

  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), THEME_STORAGE_KEY)).toBe('dark')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  await expect(page.locator('html')).toHaveClass(/dark/)

  for (const routePath of ['/en/not-found', '/en/access-denied', '/en/server-error', '/en/unknown-phase7-route']) {
    await page.goto(routePath, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
  }
})

test('shows delayed loading states on super admin dashboard', async ({ page }) => {
  await seedSession(page, { role: 'super_admin', lang: 'en' })
  await mockApi(page, {
    delayedPaths: ['/super-admin/dashboard/stats', '/super-admin/dashboard/revenue-trend', '/super-admin/dashboard/license-timeline'],
  })

  await page.goto('/en/super-admin/dashboard')
  await expect(page.getByTestId('skeleton-card').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('stats-card').first()).toBeVisible()
})

test('shows empty states on reseller and customer views when data is empty', async ({ page }) => {
  await seedSession(page, { role: 'reseller', lang: 'en' })
  await mockApi(page, { empty: true })

  await page.goto('/en/reseller/customers')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('body')).toContainText(/No customers yet|No data/i)
})

test('shows empty state on customer dashboard when no licenses are returned', async ({ page }) => {
  await seedSession(page, { role: 'customer', lang: 'en' })
  await mockApi(page, { empty: true })

  await page.goto('/en/customer/dashboard')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('main')).toContainText(/No active licenses|No data/i)
})

test('smoke-tests every super admin route', async ({ page }) => {
  await seedSession(page, { role: 'super_admin', lang: 'en' })
  await mockApi(page)
  await visitRoutes(page, routeSets.superAdmin)
})

test('smoke-tests every manager parent route', async ({ page }) => {
  await seedSession(page, { role: 'manager_parent', lang: 'en' })
  await mockApi(page)
  await visitRoutes(page, routeSets.managerParent)
})

test('smoke-tests every manager route in Arabic', async ({ page }) => {
  await seedSession(page, { role: 'manager', lang: 'ar' })
  await mockApi(page)
  await visitRoutes(page, routeSets.manager)
})

test('smoke-tests every reseller route', async ({ page }) => {
  await seedSession(page, { role: 'reseller', lang: 'en' })
  await mockApi(page)
  await visitRoutes(page, routeSets.reseller)
})

test('smoke-tests every customer route', async ({ page }) => {
  await seedSession(page, { role: 'customer', lang: 'en' })
  await mockApi(page)
  await visitRoutes(page, routeSets.customer)
})
