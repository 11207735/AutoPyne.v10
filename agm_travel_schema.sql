-- ========================================================================
-- AGM TRAVEL EMBEDDED SQLITE DATABASE SCHEMA (agm_travel.db)
-- ========================================================================

-- 1. Daily Logged Trips Table & Indexes
CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY,
  van_type TEXT NOT NULL DEFAULT 'Big van',
  guide TEXT NOT NULL DEFAULT '',
  driver TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT 'AGM',
  pax TEXT NOT NULL DEFAULT '0',
  quads TEXT NOT NULL DEFAULT '0',
  camels TEXT NOT NULL DEFAULT '0',
  person_extra TEXT DEFAULT 'None',
  quad_extra TEXT DEFAULT 'None',
  camel_extra TEXT DEFAULT 'None',
  extra_payment TEXT DEFAULT '0 DH',
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  drivers_list TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date);
CREATE INDEX IF NOT EXISTS idx_trips_guide ON trips(guide);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver);
CREATE INDEX IF NOT EXISTS idx_trips_company ON trips(company);
CREATE INDEX IF NOT EXISTS idx_trips_date_time ON trips(date, time);

-- 2. Registered Tour Guides Table & Index
CREATE TABLE IF NOT EXISTS registered_guides (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nickname TEXT,
  phone TEXT,
  dates_worked TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guides_name ON registered_guides(name);

-- 3. Registered Drivers Table & Indexes
CREATE TABLE IF NOT EXISTS registered_drivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  van_type TEXT DEFAULT 'Big van',
  company_name TEXT DEFAULT 'AGM',
  phone TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_drivers_name ON registered_drivers(name);
CREATE INDEX IF NOT EXISTS idx_drivers_company ON registered_drivers(company_name);

-- 4. Managers & Operations Staff Table
CREATE TABLE IF NOT EXISTS managers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lastname TEXT,
  school_level TEXT,
  skill TEXT,
  started_from TEXT,
  email TEXT,
  employee_id TEXT,
  pin TEXT,
  status TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 5. Payment Rates Configuration Key-Value Table
CREATE TABLE IF NOT EXISTS payment_rates (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 6. Settled Payments & Payout History Table & Indexes
CREATE TABLE IF NOT EXISTS settled_payments (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  period_key TEXT NOT NULL,
  amount_dh REAL NOT NULL,
  trips_count INTEGER DEFAULT 0,
  settled_at TEXT NOT NULL,
  settled_by TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_settled_entity ON settled_payments(entity_type, entity_name);
CREATE INDEX IF NOT EXISTS idx_settled_period ON settled_payments(period_key);

-- 7. Schema Migrations Audit Tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT DEFAULT (datetime('now'))
);
