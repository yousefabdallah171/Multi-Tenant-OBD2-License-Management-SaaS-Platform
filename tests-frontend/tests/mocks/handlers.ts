import { rest } from 'msw'
import { mockSecurityLocks } from './security'

export const handlers = [
  rest.post('*/api/auth/login', async (req, res, ctx) => {
    const body = (await req.json()) as { email?: string; password?: string }

    if (body.email === 'locked@obd2sw.com') {
      return res(
        ctx.status(429),
        ctx.json({ locked: true, reason: 'account_locked', seconds_remaining: 60 }),
      )
    }

    if (body.email === 'blocked@obd2sw.com') {
      return res(
        ctx.status(429),
        ctx.json({ locked: true, reason: 'ip_blocked', unlocks_at: null }),
      )
    }

    if (body.email === 'admin@obd2sw.com' && body.password === 'password') {
      return res(
        ctx.json({
          token: 'token',
          user: {
            id: 1,
            name: 'Super Admin',
            email: 'admin@obd2sw.com',
            role: 'super_admin',
            status: 'active',
            tenant_id: null,
            username: 'super-admin',
            phone: null,
            created_by: null,
            username_locked: false,
            tenant: null,
          },
        }),
      )
    }

    return res(ctx.status(401), ctx.json({ message: 'Invalid credentials.' }))
  }),
  rest.get('*/api/super-admin/security/locks', (_, res, ctx) => {
    return res(ctx.json({ data: mockSecurityLocks }))
  }),
  rest.post('*/api/super-admin/security/unblock-email', (_, res, ctx) => {
    return res(ctx.json({ message: 'ok' }))
  }),
  rest.post('*/api/super-admin/security/unblock-ip', (_, res, ctx) => {
    return res(ctx.json({ message: 'ok' }))
  }),
  rest.get('*/api/super-admin/security/audit-log', (_, res, ctx) => {
    return res(
      ctx.json({
        data: mockSecurityLocks.audit_log,
        meta: { current_page: 1, last_page: 1, per_page: 50, total: 1 },
      }),
    )
  }),
  rest.get('*/api/super-admin/online-users', (_, res, ctx) => {
    return res(
      ctx.json({
        data: [
          { masked_name: 'Reseller #1', role: 'reseller' },
          { masked_name: 'Customer #7', role: 'customer' },
        ],
      }),
    )
  }),
  rest.get('https://ipapi.co/:ip/json/', (req, res, ctx) => {
    return res(
      ctx.json({
        ip: req.params.ip,
        country_name: 'Egypt',
        country_code: 'EG',
        city: 'Damanhour',
        org: 'TE Data',
      }),
    )
  }),
]
