#!/usr/bin/env python3
"""
========================================================================
AGM TRAVEL - SQLITE DATABASE INITIALIZATION & JSON DATA IMPORTER
========================================================================
Initializes the SQLite database (agm_travel.db) using agm_travel_schema.sql
and imports all existing records from:
  1. agm_daily_trips.json      -> trips table
  2. registered_drivers.json   -> registered_drivers table
  3. registered_guides.json    -> registered_guides table
  4. managers_list.json        -> managers table
  (Plus payment_rates.json and settled_payments.json if present)

Usage:
  python3 init_sqlite.py
  python3 init_sqlite.py --db AGM-AGAFAY/agm_travel.db --schema agm_travel_schema.sql
"""

import os
import sys
import json
import sqlite3
import argparse
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

DEFAULT_SCHEMA_FILE = "agm_travel_schema.sql"
DEFAULT_DB_NAME = "agm_travel.db"

POSSIBLE_DATA_DIRS = [
    Path("."),
    Path("database"),
    Path("AGM-AGAFAY"),
    Path("AGM-WorkSpace") / "database",
    Path("AutoPyne-AGM") / "database",
    Path.home() / "Desktop" / "AGM-WorkSpace" / "database",
    Path.home() / "Documents" / "AGM-WorkSpace" / "database",
]

def find_file(filename: str, custom_path: Optional[str] = None) -> Optional[Path]:
    """Finds a file by checking custom_path first, then scanning common workspace directories."""
    if custom_path:
        p = Path(custom_path)
        if p.exists() and p.is_file():
            return p
        # Check relative to cwd
        if (Path.cwd() / custom_path).is_file():
            return Path.cwd() / custom_path

    # Check search paths
    for base in POSSIBLE_DATA_DIRS:
        candidate = base / filename
        if candidate.exists() and candidate.is_file():
            return candidate

    return None

def load_json_file(filepath: Optional[Path]) -> Optional[Union[List[Any], Dict[str, Any]]]:
    """Safely loads JSON from a given path."""
    if not filepath or not filepath.exists():
        return None
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️  [Warning] Failed to parse JSON from {filepath}: {e}")
        return None

def initialize_database_schema(db_path: Path, schema_path: Path) -> sqlite3.Connection:
    """Executes the DDL schema from agm_travel_schema.sql on the SQLite database."""
    print(f"📖 Reading schema file: {schema_path.resolve()}")
    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    # Ensure parent directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"🔨 Initializing SQLite database at: {db_path.resolve()}")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Enable foreign keys and execute schema DDL
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.executescript(schema_sql)
    conn.commit()
    print("✅ Database schema initialized successfully.")
    return conn

def import_daily_trips(conn: sqlite3.Connection, data: Any) -> int:
    """Imports trip records into the trips table."""
    trips_list = []
    if isinstance(data, list):
        trips_list = data
    elif isinstance(data, dict):
        trips_list = data.get("trips", data.get("data", []))

    if not trips_list:
        return 0

    cursor = conn.cursor()
    count = 0

    for idx, item in enumerate(trips_list):
        if not isinstance(item, dict):
            continue

        raw_id = item.get("id")
        try:
            trip_id = int(raw_id) if raw_id is not None else (idx + 1)
        except (ValueError, TypeError):
            trip_id = idx + 1

        van_type = str(item.get("van_type") or item.get("vanType") or "Big van")
        guide = str(item.get("guide") or "")
        driver = str(item.get("driver") or "")
        company = str(item.get("company") or "AGM")
        pax = str(item.get("pax") if item.get("pax") is not None else "0")
        quads = str(item.get("quads") if item.get("quads") is not None else "0")
        camels = str(item.get("camels") if item.get("camels") is not None else "0")
        person_extra = str(item.get("person_extra") or item.get("personExtra") or "None")
        quad_extra = str(item.get("quad_extra") or item.get("quadExtra") or "None")
        camel_extra = str(item.get("camel_extra") or item.get("camelExtra") or "None")
        extra_payment = str(item.get("extra_payment") or item.get("extraPayment") or "0 DH")
        date_val = str(item.get("date") or "")
        time_val = str(item.get("time") or "")

        drivers_list_raw = item.get("drivers_list") or item.get("driversList")
        if isinstance(drivers_list_raw, (list, dict)):
            drivers_list_json = json.dumps(drivers_list_raw)
        elif isinstance(drivers_list_raw, str):
            drivers_list_json = drivers_list_raw
        else:
            drivers_list_json = None

        cursor.execute("""
            INSERT OR REPLACE INTO trips (
                id, van_type, guide, driver, company, pax, quads, camels,
                person_extra, quad_extra, camel_extra, extra_payment,
                date, time, drivers_list, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
        """, (
            trip_id, van_type, guide, driver, company, pax, quads, camels,
            person_extra, quad_extra, camel_extra, extra_payment,
            date_val, time_val, drivers_list_json
        ))
        count += 1

    conn.commit()
    return count

def import_registered_drivers(conn: sqlite3.Connection, data: Any) -> int:
    """Imports driver records into the registered_drivers table."""
    drivers_list = []
    if isinstance(data, list):
        drivers_list = data
    elif isinstance(data, dict):
        drivers_list = data.get("registeredDrivers", data.get("drivers", data.get("data", [])))

    if not drivers_list:
        return 0

    cursor = conn.cursor()
    count = 0

    for idx, item in enumerate(drivers_list):
        if not isinstance(item, dict):
            continue

        name = str(item.get("name") or "").strip()
        if not name:
            continue

        driver_id = str(item.get("id") or f"DR-{idx + 1:02d}")
        van_type = str(item.get("van_type") or item.get("vanType") or "Big van")
        company_name = str(item.get("company_name") or item.get("companyName") or item.get("company") or "AGM")
        phone = item.get("phone")
        phone_val = str(phone) if phone else None

        # Status handling (Active/Inactive or boolean or integer)
        is_active = 1
        if "is_active" in item:
            is_active = 1 if item["is_active"] else 0
        elif "isActive" in item:
            is_active = 1 if item["isActive"] else 0
        elif "status" in item:
            is_active = 0 if str(item["status"]).strip().lower() in ["inactive", "disabled", "false", "0"] else 1

        cursor.execute("""
            INSERT OR REPLACE INTO registered_drivers (
                id, name, van_type, company_name, phone, is_active
            ) VALUES (?, ?, ?, ?, ?, ?);
        """, (
            driver_id, name, van_type, company_name, phone_val, is_active
        ))
        count += 1

    conn.commit()
    return count

def import_registered_guides(conn: sqlite3.Connection, data: Any) -> int:
    """Imports guide records into the registered_guides table."""
    guides_list = []
    if isinstance(data, list):
        guides_list = data
    elif isinstance(data, dict):
        guides_list = data.get("registeredGuides", data.get("guides", data.get("data", [])))

    if not guides_list:
        return 0

    cursor = conn.cursor()
    count = 0

    for idx, item in enumerate(guides_list):
        if not isinstance(item, dict):
            continue

        name = str(item.get("name") or "").strip()
        if not name:
            continue

        guide_id = str(item.get("id") or f"GD-{100001 + idx}")
        nickname = item.get("nickname")
        nickname_val = str(nickname) if nickname else None
        phone = item.get("phone")
        phone_val = str(phone) if phone else None

        dates_worked = item.get("dates_worked") or item.get("datesWorked")
        if isinstance(dates_worked, (list, dict)):
            dates_worked_str = json.dumps(dates_worked)
        elif dates_worked:
            dates_worked_str = str(dates_worked)
        else:
            dates_worked_str = None

        is_active = 1
        if "is_active" in item:
            is_active = 1 if item["is_active"] else 0
        elif "isActive" in item:
            is_active = 1 if item["isActive"] else 0
        elif "status" in item:
            is_active = 0 if str(item["status"]).strip().lower() in ["inactive", "disabled", "false", "0"] else 1

        cursor.execute("""
            INSERT OR REPLACE INTO registered_guides (
                id, name, nickname, phone, dates_worked, is_active
            ) VALUES (?, ?, ?, ?, ?, ?);
        """, (
            guide_id, name, nickname_val, phone_val, dates_worked_str, is_active
        ))
        count += 1

    conn.commit()
    return count

def import_managers(conn: sqlite3.Connection, data: Any) -> int:
    """Imports manager records into the managers table."""
    managers_list = []
    if isinstance(data, list):
        managers_list = data
    elif isinstance(data, dict):
        managers_list = data.get("managersList", data.get("managers", data.get("data", [])))

    if not managers_list:
        return 0

    cursor = conn.cursor()
    count = 0

    for idx, item in enumerate(managers_list):
        if not isinstance(item, dict):
            continue

        mgr_id = str(item.get("id") or f"mgr_{idx + 1:03d}")
        name = str(item.get("name") or "").strip()
        if not name:
            continue

        lastname = str(item.get("lastname") or item.get("lastName") or "")
        school_level = str(item.get("school_level") or item.get("schoolLevel") or "")
        skill = str(item.get("skill") or "")
        started_from = str(item.get("started_from") or item.get("startedFrom") or "")
        email = str(item.get("email") or "")
        employee_id = str(item.get("employee_id") or item.get("employeeId") or "")
        pin = item.get("pin") or item.get("paymentPin")
        pin_val = str(pin) if pin else None
        status = str(item.get("status") or "Active")

        cursor.execute("""
            INSERT OR REPLACE INTO managers (
                id, name, lastname, school_level, skill, started_from, email, employee_id, pin, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            mgr_id, name, lastname, school_level, skill, started_from, email, employee_id, pin_val, status
        ))
        count += 1

    conn.commit()
    return count

def import_payment_rates(conn: sqlite3.Connection, data: Any) -> int:
    """Imports payment rates dictionary into payment_rates key-value table."""
    if not isinstance(data, dict):
        return 0

    cursor = conn.cursor()
    count = 0
    rates_dict = data.get("paymentRates", data)

    for k, v in rates_dict.items():
        val_str = json.dumps(v) if isinstance(v, (dict, list)) else str(v)
        cursor.execute("""
            INSERT OR REPLACE INTO payment_rates (key, value) VALUES (?, ?);
        """, (str(k), val_str))
        count += 1

    conn.commit()
    return count

def main():
    parser = argparse.ArgumentParser(
        description="Initialize SQLite database (agm_travel.db) and import JSON records from AGM Travel data files."
    )
    parser.add_argument("--schema", "-s", default=DEFAULT_SCHEMA_FILE, help="Path to agm_travel_schema.sql")
    parser.add_argument("--db", "-d", default=DEFAULT_DB_NAME, help="Path for target SQLite database file")
    parser.add_argument("--trips", default="agm_daily_trips.json", help="Path to agm_daily_trips.json")
    parser.add_argument("--drivers", default="registered_drivers.json", help="Path to registered_drivers.json")
    parser.add_argument("--guides", default="registered_guides.json", help="Path to registered_guides.json")
    parser.add_argument("--managers", default="managers_list.json", help="Path to managers_list.json")
    parser.add_argument("--rates", default="payment_rates.json", help="Path to payment_rates.json (optional)")
    parser.add_argument("--backup", default="agm_complete_server_backup.json", help="Path to full server backup (optional)")

    args = parser.parse_args()

    print("=" * 72)
    print("        AGM TRAVEL - SQLITE INITIALIZER & DATA IMPORTER")
    print("=" * 72)

    # 1. Locate schema file
    schema_path = find_file(args.schema, args.schema)
    if not schema_path:
        print(f"❌ Error: Schema file '{args.schema}' not found!")
        print(f"   Searched in current directory and: {[str(p) for p in POSSIBLE_DATA_DIRS]}")
        sys.exit(1)

    # 2. Database target path
    db_target = Path(args.db)

    # 3. Initialize SQLite DB & Schema
    conn = initialize_database_schema(db_target, schema_path)

    # 4. Check for full backup first (if present)
    backup_path = find_file(args.backup, args.backup)
    backup_data = load_json_file(backup_path) if backup_path else None

    # 5. Load and Import trips
    trips_path = find_file(args.trips, args.trips)
    trips_data = load_json_file(trips_path)
    if trips_data is None and backup_data and isinstance(backup_data, dict):
        trips_data = backup_data.get("trips")
    trips_count = import_daily_trips(conn, trips_data) if trips_data is not None else 0
    print(f"📦 Trips Imported:            {trips_count} records {f'(from {trips_path})' if trips_path else ''}")

    # 6. Load and Import registered drivers
    drivers_path = find_file(args.drivers, args.drivers)
    drivers_data = load_json_file(drivers_path)
    if drivers_data is None and backup_data and isinstance(backup_data, dict):
        drivers_data = backup_data.get("registeredDrivers")
    drivers_count = import_registered_drivers(conn, drivers_data) if drivers_data is not None else 0
    print(f"🚗 Drivers Imported:          {drivers_count} records {f'(from {drivers_path})' if drivers_path else ''}")

    # 7. Load and Import registered guides
    guides_path = find_file(args.guides, args.guides)
    guides_data = load_json_file(guides_path)
    if guides_data is None and backup_data and isinstance(backup_data, dict):
        guides_data = backup_data.get("registeredGuides")
    guides_count = import_registered_guides(conn, guides_data) if guides_data is not None else 0
    print(f"🚩 Guides Imported:           {guides_count} records {f'(from {guides_path})' if guides_path else ''}")

    # 8. Load and Import managers
    managers_path = find_file(args.managers, args.managers)
    managers_data = load_json_file(managers_path)
    if managers_data is None and backup_data and isinstance(backup_data, dict):
        managers_data = backup_data.get("managersList")
    managers_count = import_managers(conn, managers_data) if managers_data is not None else 0
    print(f"👔 Managers Imported:         {managers_count} records {f'(from {managers_path})' if managers_path else ''}")

    # 9. Load and Import payment rates (if present)
    rates_path = find_file(args.rates, args.rates)
    rates_data = load_json_file(rates_path)
    if rates_data is None and backup_data and isinstance(backup_data, dict):
        rates_data = backup_data.get("paymentRates")
    rates_count = import_payment_rates(conn, rates_data) if rates_data is not None else 0
    if rates_count > 0:
        print(f"💰 Payment Rates Configured:  {rates_count} rate keys {f'(from {rates_path})' if rates_path else ''}")

    # Synchronize copy to AGM-AGAFAY/agm_travel.db if target was default root agm_travel.db
    if str(db_target) == "agm_travel.db":
        alt_dest = Path("AGM-AGAFAY") / "agm_travel.db"
        alt_dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            import shutil
            shutil.copy2(db_target, alt_dest)
            print(f"🔄 Synced database replica to: {alt_dest.resolve()}")
        except Exception as e:
            print(f"ℹ️  Notice on replica sync: {e}")

    conn.close()
    print("=" * 72)
    print(f"🎉 SUCCESS: SQLite database initialized & populated at '{db_target}'")
    print("=" * 72)

if __name__ == "__main__":
    main()
