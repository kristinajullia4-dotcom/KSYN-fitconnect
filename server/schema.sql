-- ============================================================================
-- KSYN FitConnect Enterprise Platform
-- PostgreSQL Production Database Schema with Native Row-Level Security (RLS)
-- Version: 1.0.0
-- Standard: ISO/IEC 25010, ISO/IEC 27001, RA 10173 (Philippine Data Privacy Act)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. MODULE 1: FRANCHISE & BRANCH MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    operating_hours VARCHAR(255) DEFAULT 'Monday to Sunday, 6:00 AM – 12:00 AM',
    royalty_percentage NUMERIC(5, 2) DEFAULT 7.50,
    franchise_agreement TEXT,
    fixed_monthly_dues NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Active',
    is_active BOOLEAN DEFAULT TRUE,
    is_flagship BOOLEAN DEFAULT FALSE,
    assigned_admin_id VARCHAR(50),
    assigned_admin_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(code);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(is_active);

-- ============================================================================
-- 2. MODULE 2: USER & ROLE MANAGEMENT (RBAC)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE SET NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'branch_admin', 'employee', 'staff', 'coach', 'trainer', 'member', 'branch_owner')),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    secondary_password_hash VARCHAR(255),
    supervisor_pin_hash VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned', 'pending_payment')),
    rfid_card_uid VARCHAR(50) UNIQUE,
    shift_role VARCHAR(100),
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_rfid ON users(rfid_card_uid);

-- ============================================================================
-- 3. MODULE 3: MEMBER & SUBSCRIPTION LIFECYCLE MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL,
    tier VARCHAR(50) NOT NULL CHECK (tier IN ('basic', 'pro', 'elite', '1_day')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending_payment', 'unpaid', 'past_due')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    access_fee NUMERIC(10, 2) DEFAULT 0.00,
    annual_fee NUMERIC(10, 2) DEFAULT 0.00,
    total_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_branch ON subscriptions(branch_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);

CREATE TABLE IF NOT EXISTS free_pass_applications (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    month_year VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'awarded', 'claimed', 'expired', 'rejected')),
    awarded_pass_code VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_free_pass_branch ON free_pass_applications(branch_id);
CREATE INDEX IF NOT EXISTS idx_free_pass_email ON free_pass_applications(email);

-- ============================================================================
-- 4. MODULE 4: STAFF & COACHING ADMINISTRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_shifts (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    shift_start VARCHAR(10) NOT NULL,
    shift_end VARCHAR(10) NOT NULL,
    day_of_week VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_branch ON staff_shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_user ON staff_shifts(user_id);

CREATE TABLE IF NOT EXISTS pt_clients (
    id VARCHAR(50) PRIMARY KEY,
    coach_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    package_name VARCHAR(100) NOT NULL,
    sessions_total INT NOT NULL DEFAULT 12,
    sessions_completed INT NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pt_clients_coach ON pt_clients(coach_id);
CREATE INDEX IF NOT EXISTS idx_pt_clients_client ON pt_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_pt_clients_branch ON pt_clients(branch_id);

CREATE TABLE IF NOT EXISTS pt_sessions (
    id VARCHAR(50) PRIMARY KEY,
    coach_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    duration_mins INT DEFAULT 60,
    focus VARCHAR(255),
    rpe_intensity VARCHAR(20),
    notes TEXT,
    session_rate NUMERIC(10, 2) DEFAULT 850.00,
    commission_earned NUMERIC(10, 2) DEFAULT 510.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pt_sessions_coach ON pt_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_client ON pt_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_branch ON pt_sessions(branch_id);

CREATE TABLE IF NOT EXISTS coach_payslips (
    id VARCHAR(50) PRIMARY KEY,
    coach_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    gross_earnings NUMERIC(10, 2) NOT NULL,
    withholding_tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    net_payout NUMERIC(10, 2) NOT NULL,
    sessions_count INT NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'processed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coach_payslips_coach ON coach_payslips(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_payslips_branch ON coach_payslips(branch_id);

CREATE TABLE IF NOT EXISTS workout_plans (
    id VARCHAR(50) PRIMARY KEY,
    client_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coach_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    goal VARCHAR(255),
    exercises JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workout_plans_client ON workout_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_coach ON workout_plans(coach_id);

-- ============================================================================
-- 5. MODULE 5: INVENTORY CONTROL & EQUIPMENT MAINTENANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 5,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    supplier VARCHAR(255),
    status VARCHAR(50) DEFAULT 'In Stock',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);

CREATE TABLE IF NOT EXISTS inventory_restock_requests (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    inventory_id VARCHAR(50) REFERENCES inventory(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    requested_qty INT NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Fulfilled')),
    requested_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restock_branch ON inventory_restock_requests(branch_id);

CREATE TABLE IF NOT EXISTS equipment_registry (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    asset_tag VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Operational' CHECK (status IN ('Operational', 'Maintenance Required', 'Out of Service', 'Decommissioned')),
    installed_at DATE,
    last_serviced_at DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipment_branch ON equipment_registry(branch_id);

CREATE TABLE IF NOT EXISTS maintenance_work_orders (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    equipment_id VARCHAR(50) REFERENCES equipment_registry(id) ON DELETE SET NULL,
    reported_issue TEXT NOT NULL,
    urgency VARCHAR(50) DEFAULT 'Medium' CHECK (urgency IN ('Low', 'Medium', 'High', 'Critical')),
    technician_name VARCHAR(255),
    checklist JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Completed', 'Cancelled')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_orders_branch ON maintenance_work_orders(branch_id);

CREATE TABLE IF NOT EXISTS equipment_iot_telemetry (
    id VARCHAR(50) PRIMARY KEY,
    equipment_id VARCHAR(50) NOT NULL REFERENCES equipment_registry(id) ON DELETE CASCADE,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    vibration_hz NUMERIC(8, 2),
    motor_temp_c NUMERIC(8, 2),
    cumulative_cycles BIGINT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Normal',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telemetry_equipment ON equipment_iot_telemetry(equipment_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_branch ON equipment_iot_telemetry(branch_id);

-- ============================================================================
-- 6. MODULE 6: FINANCIAL, POS & ROYALTY MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    amount NUMERIC(12, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'card', 'gcash', 'maya', 'qrph', 'bank_transfer', 'online')),
    reference_no VARCHAR(100) UNIQUE,
    pos_shift_id VARCHAR(50),
    items JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_category ON sales(category);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

CREATE TABLE IF NOT EXISTS pos_shifts (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    cashier_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opening_float NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    closing_cash NUMERIC(10, 2),
    expected_cash NUMERIC(10, 2),
    variance NUMERIC(10, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_pos_shifts_branch ON pos_shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_cashier ON pos_shifts(cashier_id);

CREATE TABLE IF NOT EXISTS petty_expenses (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    recorded_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    voucher_no VARCHAR(100) NOT NULL,
    payee VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    purpose TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'Supplies',
    receipt_attached BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_petty_expenses_branch ON petty_expenses(branch_id);

CREATE TABLE IF NOT EXISTS remittances (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    period_label VARCHAR(100) NOT NULL,
    gross_sales NUMERIC(12, 2) NOT NULL,
    royalty_percentage NUMERIC(5, 2) DEFAULT 7.50,
    royalty_due NUMERIC(12, 2) NOT NULL,
    amount_paid NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'overdue')),
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_remittances_branch ON remittances(branch_id);

CREATE TABLE IF NOT EXISTS payment_methods (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    gateway_token VARCHAR(255) NOT NULL,
    masked_identifier VARCHAR(100) NOT NULL,
    brand_or_provider VARCHAR(50),
    issuing_bank VARCHAR(100),
    expiry_month VARCHAR(10),
    expiry_year VARCHAR(10),
    billing_day INT DEFAULT 1,
    is_default BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_branch ON payment_methods(branch_id);

CREATE TABLE IF NOT EXISTS payment_invoices (
    id VARCHAR(50) PRIMARY KEY,
    invoice_no VARCHAR(100) NOT NULL UNIQUE,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    description VARCHAR(255),
    payment_rail VARCHAR(50) NOT NULL,
    gateway_ref VARCHAR(255),
    qr_payload TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'failed')),
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_invoices_status ON payment_invoices(status);
CREATE INDEX IF NOT EXISTS idx_payment_invoices_branch ON payment_invoices(branch_id);

-- ============================================================================
-- 7. MODULE 7: CLASSES & BOOKINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    coach_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    capacity INT NOT NULL DEFAULT 20,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    room VARCHAR(100),
    status VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classes_branch ON classes(branch_id);
CREATE INDEX IF NOT EXISTS idx_classes_coach ON classes(coach_id);

CREATE TABLE IF NOT EXISTS class_bookings (
    id VARCHAR(50) PRIMARY KEY,
    class_id VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'booked' CHECK (status IN ('booked', 'waitlist', 'checked_in', 'cancelled', 'no_show')),
    waitlist_position INT,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_class_bookings_class ON class_bookings(class_id);
CREATE INDEX IF NOT EXISTS idx_class_bookings_user ON class_bookings(user_id);

-- ============================================================================
-- 8. MODULE 8: ACCESS VERIFICATION & CRYPTOGRAPHIC AUDIT LOGGING
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_logs (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL CHECK (method IN ('qr_turnstile', 'rfid_turnstile', 'manual_admin', 'kiosk_scanner')),
    check_in_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    check_out_time TIMESTAMP WITH TIME ZONE,
    verified_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'Admitted'
);

CREATE INDEX IF NOT EXISTS idx_attendance_branch ON attendance_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_time ON attendance_logs(check_in_time);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE SET NULL,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50) DEFAULT '127.0.0.1',
    details JSONB DEFAULT '{}'::jsonb,
    prev_hash VARCHAR(64) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_branch ON audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES & MULTI-TENANT BOUNDARY GUARDS
-- ============================================================================

-- Enable RLS across all operational multi-tenant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE free_pass_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_restock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_iot_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Super Admin Corporate Bypass
CREATE OR REPLACE FUNCTION app_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('app.current_role', true) = 'super_admin';
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Current Tenant Branch ID
CREATE OR REPLACE FUNCTION app_tenant_branch_id()
RETURNS VARCHAR AS $$
BEGIN
    RETURN current_setting('app.current_branch_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Current Authenticated User ID
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS VARCHAR AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- 1. USERS Policy: Super Admin sees all; Branch Admin sees branch; Members see self
DROP POLICY IF EXISTS users_isolation_policy ON users;
CREATE POLICY users_isolation_policy ON users
    FOR ALL
    USING (
        app_is_super_admin()
        OR branch_id = app_tenant_branch_id()
        OR id = app_current_user_id()
    );

-- 2. SUBSCRIPTIONS Policy: Super Admin sees all; Branch Admin sees branch; Member sees self
DROP POLICY IF EXISTS subscriptions_isolation_policy ON subscriptions;
CREATE POLICY subscriptions_isolation_policy ON subscriptions
    FOR ALL
    USING (
        app_is_super_admin()
        OR branch_id = app_tenant_branch_id()
        OR user_id = app_current_user_id()
    );

-- 3. ATTENDANCE LOGS Policy: Super Admin sees all; Branch Admin / Employee sees branch; Member sees self
DROP POLICY IF EXISTS attendance_isolation_policy ON attendance_logs;
CREATE POLICY attendance_isolation_policy ON attendance_logs
    FOR ALL
    USING (
        app_is_super_admin()
        OR branch_id = app_tenant_branch_id()
        OR user_id = app_current_user_id()
    );

-- 4. SALES Policy: Super Admin sees all; Branch Admin / Cashier sees own branch; No Member direct access
DROP POLICY IF EXISTS sales_isolation_policy ON sales;
CREATE POLICY sales_isolation_policy ON sales
    FOR ALL
    USING (
        app_is_super_admin()
        OR (branch_id = app_tenant_branch_id() AND current_setting('app.current_role', true) IN ('branch_admin', 'branch_owner', 'employee', 'staff'))
    );

-- 5. INVENTORY & EQUIPMENT Policies: Isolated by branch_id
DROP POLICY IF EXISTS inventory_isolation_policy ON inventory;
CREATE POLICY inventory_isolation_policy ON inventory
    FOR ALL
    USING (app_is_super_admin() OR branch_id = app_tenant_branch_id());

DROP POLICY IF EXISTS equipment_isolation_policy ON equipment_registry;
CREATE POLICY equipment_isolation_policy ON equipment_registry
    FOR ALL
    USING (app_is_super_admin() OR branch_id = app_tenant_branch_id());

DROP POLICY IF EXISTS maintenance_isolation_policy ON maintenance_work_orders;
CREATE POLICY maintenance_isolation_policy ON maintenance_work_orders
    FOR ALL
    USING (app_is_super_admin() OR branch_id = app_tenant_branch_id());

-- 6. COACHING & PT Policies: Super Admin or Branch Admin or Coach assigned or Client assigned
DROP POLICY IF EXISTS pt_clients_isolation_policy ON pt_clients;
CREATE POLICY pt_clients_isolation_policy ON pt_clients
    FOR ALL
    USING (
        app_is_super_admin()
        OR branch_id = app_tenant_branch_id()
        OR coach_id = app_current_user_id()
        OR client_id = app_current_user_id()
    );

DROP POLICY IF EXISTS pt_sessions_isolation_policy ON pt_sessions;
CREATE POLICY pt_sessions_isolation_policy ON pt_sessions
    FOR ALL
    USING (
        app_is_super_admin()
        OR branch_id = app_tenant_branch_id()
        OR coach_id = app_current_user_id()
        OR client_id = app_current_user_id()
    );

-- 7. AUDIT LOGS Policy: Super Admin sees all; Branch Admin sees own branch logs; Append-only for others
DROP POLICY IF EXISTS audit_isolation_policy ON audit_logs;
CREATE POLICY audit_isolation_policy ON audit_logs
    FOR ALL
    USING (
        app_is_super_admin()
        OR branch_id = app_tenant_branch_id()
    );
