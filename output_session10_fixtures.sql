SET @tenant_id := 1;
SET @reseller_self := 3;
SET @reseller_other := 111;
SET @program_id := 1;

INSERT IGNORE INTO bios_blacklist (tenant_id, bios_id, reason, is_active, created_at, updated_at)
VALUES (@tenant_id, 'TEST-BIOS-BLACKLISTED', 'Session 10 blacklist fixture', 1, NOW(), NOW());

INSERT INTO users (tenant_id, name, username, email, password, role, status, created_by, username_locked, created_at, updated_at)
SELECT @tenant_id, 'Session10 Active Other', 'session10_active_other', 'session10.active.other@obd2sw.local', '$2y$12$r05QfWteYrQakL7fPIvDTeum7qSmb4fyQvvX9BcUPn5LxcJ3Tq5eG', 'customer', 'active', @reseller_other, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'session10_active_other');
SET @cust_active_other := (SELECT id FROM users WHERE username = 'session10_active_other' LIMIT 1);
INSERT INTO licenses (tenant_id, customer_id, reseller_id, program_id, bios_id, external_username, external_activation_response, duration_days, price, activated_at, expires_at, status, is_scheduled, created_at, updated_at)
SELECT @tenant_id, @cust_active_other, @reseller_other, @program_id, 'TEST-ACTIVE-OTHER-001', 'session10_active_other', 'Session10 active other fixture', 30, 100, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 'active', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM licenses WHERE bios_id = 'TEST-ACTIVE-OTHER-001');

INSERT INTO users (tenant_id, name, username, email, password, role, status, created_by, username_locked, created_at, updated_at)
SELECT @tenant_id, 'Session10 Suspended', 'session10_suspended', 'session10.suspended@obd2sw.local', '$2y$12$r05QfWteYrQakL7fPIvDTeum7qSmb4fyQvvX9BcUPn5LxcJ3Tq5eG', 'customer', 'active', @reseller_other, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'session10_suspended');
SET @cust_suspended := (SELECT id FROM users WHERE username = 'session10_suspended' LIMIT 1);
INSERT INTO licenses (tenant_id, customer_id, reseller_id, program_id, bios_id, external_username, external_activation_response, duration_days, price, activated_at, expires_at, status, is_scheduled, created_at, updated_at)
SELECT @tenant_id, @cust_suspended, @reseller_other, @program_id, 'TEST-SUSPENDED-001', 'session10_suspended', 'Session10 suspended fixture', 30, 100, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 'suspended', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM licenses WHERE bios_id = 'TEST-SUSPENDED-001');

INSERT INTO users (tenant_id, name, username, email, password, role, status, created_by, username_locked, created_at, updated_at)
SELECT @tenant_id, 'Session10 Pending Other', 'session10_pending_other', 'session10.pending.other@obd2sw.local', '$2y$12$r05QfWteYrQakL7fPIvDTeum7qSmb4fyQvvX9BcUPn5LxcJ3Tq5eG', 'customer', 'active', @reseller_other, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'session10_pending_other');
SET @cust_pending_other := (SELECT id FROM users WHERE username = 'session10_pending_other' LIMIT 1);
INSERT INTO licenses (tenant_id, customer_id, reseller_id, program_id, bios_id, external_username, external_activation_response, duration_days, price, activated_at, expires_at, status, is_scheduled, created_at, updated_at)
SELECT @tenant_id, @cust_pending_other, @reseller_other, @program_id, 'TEST-PENDING-OTHER-001', 'session10_pending_other', 'Session10 pending other fixture', 0, 0, NOW(), NOW(), 'pending', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM licenses WHERE bios_id = 'TEST-PENDING-OTHER-001');

INSERT INTO users (tenant_id, name, username, email, password, role, status, created_by, username_locked, created_at, updated_at)
SELECT @tenant_id, 'John Doe Fixture', 'john_doe', 'john.doe.fixture@obd2sw.local', '$2y$12$r05QfWteYrQakL7fPIvDTeum7qSmb4fyQvvX9BcUPn5LxcJ3Tq5eG', 'customer', 'active', @reseller_self, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'john_doe');
SET @cust_john := (SELECT id FROM users WHERE username = 'john_doe' LIMIT 1);
INSERT INTO licenses (tenant_id, customer_id, reseller_id, program_id, bios_id, external_username, external_activation_response, duration_days, price, activated_at, expires_at, status, is_scheduled, created_at, updated_at)
SELECT @tenant_id, @cust_john, @reseller_self, @program_id, 'TEST-JOHN-ACTIVE-001', 'john_doe', 'Session10 john_doe active fixture', 30, 100, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 'active', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM licenses WHERE bios_id = 'TEST-JOHN-ACTIVE-001');
INSERT IGNORE INTO bios_username_links (tenant_id, bios_id, username, created_at, updated_at)
VALUES (@tenant_id, 'TEST-LINK-JOHN-001', 'john_doe', NOW(), NOW());

SET @source_license := (SELECT id FROM licenses WHERE bios_id = 'TEST-JOHN-ACTIVE-001' LIMIT 1);
INSERT INTO bios_change_requests (tenant_id, license_id, reseller_id, old_bios_id, new_bios_id, reason, status, created_at, updated_at)
SELECT @tenant_id, @source_license, @reseller_self, 'TEST-JOHN-ACTIVE-001', 'TEST-PENDING-BCR-001', 'Session10 pending BCR fixture', 'pending', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM bios_change_requests WHERE new_bios_id = 'TEST-PENDING-BCR-001' AND status = 'pending');
