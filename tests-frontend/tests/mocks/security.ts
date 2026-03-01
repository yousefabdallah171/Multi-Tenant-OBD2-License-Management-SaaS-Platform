export const mockSecurityLocks = {
  locked_accounts: [
    {
      email: 'locked@obd2sw.com',
      locked_since: '2026-03-01T10:00:00Z',
      unlocks_at: '2026-03-01T10:01:00Z',
      attempts: 5,
      ip: '197.55.1.2',
    },
  ],
  blocked_ips: [
    {
      ip: '197.55.1.2',
      country_code: 'EG',
      country_name: 'Egypt',
      city: 'Damanhour',
      blocked_since: '2026-03-01T10:00:00Z',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/122.0.0.0',
    },
  ],
  audit_log: [
    {
      id: 1,
      created_at: '2026-03-01T10:05:00Z',
      admin: 'Super Admin',
      action: 'security.unblock_ip',
      target: '197.55.1.2',
      admin_ip: '192.168.1.10',
    },
  ],
}
