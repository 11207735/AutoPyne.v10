// SQLite Python Backend source code export for AGM Travel
export const backProCodeString = `import os
import json
import sqlite3
import datetime

# Database directories and SQLite file paths
DB_DIR = "AGM-AGAFAY"
DB_SQLITE_FILE = os.path.join(DB_DIR, "agm_travel.db")
WORKSPACE_DB_DIR = "database"
WORKSPACE_SQLITE_FILE = os.path.join(WORKSPACE_DB_DIR, "agm_travel.db")
OLD_DB_FILE = os.path.join(DB_DIR, "database.json")
OLD_DATA_FILE = os.path.join(DB_DIR, "data.json")
OLD_WORKSPACE_DB_FILE = os.path.join("database", "agm_daily_trips.json")

def get_db_connection():
    """Returns a SQLite connection with Row factory enabled."""
    initialize_system()
    conn = sqlite3.connect(DB_SQLITE_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def levenshtein_distance(s1, s2):
    """Calculate Levenshtein distance for fuzzy name typo matching."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

def get_canonical_name(input_name, known_names):
    """Finds the canonical name using fuzzy typo matching."""
    cleaned = str(input_name).strip().upper()
    if not cleaned or cleaned in ["WITHOUT GUIDE", "?", "NONE", "UNASSIGNED"]:
        return cleaned

    # Exact match first
    for k in known_names:
        if cleaned == k.strip().upper():
            return k

    best_match = cleaned
    min_dist = 999

    for k in known_names:
        k_upper = k.strip().upper()
        if not k_upper or k_upper in ["WITHOUT GUIDE", "?", "NONE", "UNASSIGNED"]:
            continue
        dist = levenshtein_distance(cleaned, k_upper)
        max_allowed = 1 if len(cleaned) <= 4 else (2 if len(cleaned) <= 8 else 3)
        if dist <= max_allowed and dist < min_dist:
            min_dist = dist
            best_match = k

    return best_match

def parse_date_parts(date_str):
    """
    Robustly parses standard dates in DD-MM-YYYY or DD/MM/YYYY formats.
    Returns strings (day, month, year) with proper zero-padding.
    """
    date_str = str(date_str).strip()
    for sep in ["-", "/"]:
        if sep in date_str:
            parts = date_str.split(sep)
            if len(parts) >= 3:
                d = parts[0].strip()
                m = parts[1].strip()
                y = parts[2].strip()
                if len(y) == 2 and y.isdigit():
                    y = "20" + y
                if len(d) == 1 and d.isdigit():
                    d = "0" + d
                if len(m) == 1 and m.isdigit():
                    m = "0" + m
                return d, m, y
    
    # Fallback to current date
    today = datetime.datetime.now()
    return today.strftime("%d"), today.strftime("%m"), today.strftime("%Y")

def initialize_system():
    """Create the SQLite database and create necessary tables and indexes with auto-repair for corrupt databases."""
    if not os.path.exists(DB_DIR):
        try:
            os.makedirs(DB_DIR)
        except Exception:
            pass
    if not os.path.exists(WORKSPACE_DB_DIR):
        try:
            os.makedirs(WORKSPACE_DB_DIR)
        except Exception:
            pass
    
    # Ensure Desktop/AGM-AGAFAY, Documents/AGM-AGAFAY and AGM-WorkSpace exist
    home = os.path.expanduser("~")
    for parent in ["Desktop", "Documents"]:
        for f_name in ["AGM-AGAFAY", "AGM-WorkSpace"]:
            folder_path = os.path.join(home, parent, f_name)
            try:
                if not os.path.exists(folder_path):
                    os.makedirs(folder_path)
            except Exception:
                pass

    try:
        # Initialize SQLite Database & Schema
        conn = sqlite3.connect(DB_SQLITE_FILE)
        cur = conn.cursor()

        # 1. Trips Table
        cur.execute("""
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
        """)

        # Indexes for fast querying
        cur.execute("CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_trips_guide ON trips(guide);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_trips_company ON trips(company);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_trips_date_time ON trips(date, time);")

        # 2. Registered Guides Table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS registered_guides (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            nickname TEXT,
            phone TEXT,
            dates_worked TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_guides_name ON registered_guides(name);")

        # 3. Registered Drivers Table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS registered_drivers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            van_type TEXT DEFAULT 'Big van',
            company_name TEXT DEFAULT 'AGM',
            phone TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_drivers_name ON registered_drivers(name);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_drivers_company ON registered_drivers(company_name);")

        # 4. Managers Table
        cur.execute("""
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
        """)

        # 5. Payment Rates Table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS payment_rates (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """)

        # 6. Settled Payments Table
        cur.execute("""
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
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_settled_entity ON settled_payments(entity_type, entity_name);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_settled_period ON settled_payments(period_key);")

        conn.commit()

        # Check and migrate legacy database.json / data.json if present
        migrate_legacy_json_to_sqlite(conn)

        conn.close()
    except (sqlite3.DatabaseError, sqlite3.OperationalError) as err:
        print(f"[SQLite Warning] Corrupt or malformed database detected ({err}). Recreating database file...")
        try:
            if os.path.exists(DB_SQLITE_FILE):
                os.remove(DB_SQLITE_FILE)
        except Exception:
            pass
        # Retry once with a fresh database
        conn = sqlite3.connect(DB_SQLITE_FILE)
        cur = conn.cursor()
        cur.execute("""
        CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY, van_type TEXT NOT NULL DEFAULT 'Big van', guide TEXT NOT NULL DEFAULT '',
            driver TEXT NOT NULL DEFAULT '', company TEXT NOT NULL DEFAULT 'AGM', pax TEXT NOT NULL DEFAULT '0',
            quads TEXT NOT NULL DEFAULT '0', camels TEXT NOT NULL DEFAULT '0', person_extra TEXT DEFAULT 'None',
            quad_extra TEXT DEFAULT 'None', camel_extra TEXT DEFAULT 'None', extra_payment TEXT DEFAULT '0 DH',
            date TEXT NOT NULL, time TEXT NOT NULL, drivers_list TEXT, created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_trips_guide ON trips(guide);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_trips_company ON trips(company);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_trips_date_time ON trips(date, time);")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS registered_guides (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, nickname TEXT, phone TEXT, dates_worked TEXT,
            is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
        );
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS registered_drivers (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, van_type TEXT DEFAULT 'Big van',
            company_name TEXT DEFAULT 'AGM', phone TEXT, is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        );
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS managers (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, lastname TEXT, school_level TEXT, skill TEXT,
            started_from TEXT, email TEXT, employee_id TEXT, pin TEXT, status TEXT, created_at TEXT DEFAULT (datetime('now'))
        );
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS payment_rates (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS settled_payments (
            id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_name TEXT NOT NULL, period_key TEXT NOT NULL,
            amount_dh REAL NOT NULL, trips_count INTEGER DEFAULT 0, settled_at TEXT NOT NULL, settled_by TEXT NOT NULL,
            receipt_number TEXT NOT NULL, notes TEXT, created_at TEXT DEFAULT (datetime('now'))
        );
        """)
        conn.commit()
        conn.close()

def migrate_legacy_json_to_sqlite(conn):
    """Auto-migrates any old data.json or database.json records into the SQLite database and deletes the JSON files."""
    legacy_records = []
    
    # 1. Check DB_FILE and OLD_DATA_FILE
    for old_path in [OLD_DB_FILE, OLD_DATA_FILE, "data.json", "database.json"]:
        if os.path.exists(old_path):
            try:
                with open(old_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        for item in data:
                            if not any(r.get("id") == item.get("id") for r in legacy_records):
                                legacy_records.append(item)
            except Exception:
                pass

    # 2. Check WORKSPACE_DB_FILE
    if os.path.exists(OLD_WORKSPACE_DB_FILE):
        try:
            with open(OLD_WORKSPACE_DB_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    for item in data:
                        if not any(r.get("id") == item.get("id") for r in legacy_records):
                            legacy_records.append(item)
        except Exception:
            pass

    if legacy_records:
        cur = conn.cursor()
        for r in legacy_records:
            r_id = r.get("id")
            if r_id is None:
                continue
            cur.execute("""
            INSERT OR REPLACE INTO trips (
                id, van_type, guide, driver, company, pax, quads, camels,
                person_extra, quad_extra, camel_extra, extra_payment,
                date, time, drivers_list, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (
                int(r_id),
                str(r.get("van_type", "Big van")),
                str(r.get("guide", "")),
                str(r.get("driver", "")),
                str(r.get("company", "AGM")),
                str(r.get("pax", "0")),
                str(r.get("quads", "0")),
                str(r.get("camels", "0")),
                str(r.get("person_extra", "None")),
                str(r.get("quad_extra", "None")),
                str(r.get("camel_extra", "None")),
                str(r.get("extra_payment", "0 DH")),
                str(r.get("date", "")),
                str(r.get("time", "")),
                json.dumps(r.get("driversList")) if r.get("driversList") else None
            ))
        conn.commit()

    # Safely delete legacy JSON files to complete migration and optimize disk speed
    for old_path in [OLD_DB_FILE, OLD_DATA_FILE, "data.json", "database.json", OLD_WORKSPACE_DB_FILE]:
        try:
            if os.path.exists(old_path):
                os.remove(old_path)
                print(f"[SQLite Optimization] Successfully migrated and removed legacy {old_path}")
        except Exception as e:
            pass

def trip_row_to_dict(row):
    """Converts a SQLite trip row to dictionary format matching the UI model."""
    d = dict(row)
    drivers_list = None
    if d.get("drivers_list"):
        try:
            drivers_list = json.loads(d["drivers_list"])
        except Exception:
            drivers_list = None
    res = {
        "id": d["id"],
        "van_type": d["van_type"],
        "guide": d["guide"],
        "driver": d["driver"],
        "company": d["company"],
        "pax": d["pax"],
        "quads": d["quads"],
        "camels": d["camels"],
        "person_extra": d["person_extra"],
        "quad_extra": d["quad_extra"],
        "camel_extra": d["camel_extra"],
        "extra_payment": d["extra_payment"],
        "date": d["date"],
        "time": d["time"]
    }
    if drivers_list:
        res["driversList"] = drivers_list
    return res

def load_records(limit=None, offset=None, search=None, date_filter=None):
    """Load records from SQLite database with optional pagination (LIMIT/OFFSET) and search filters."""
    conn = get_db_connection()
    cur = conn.cursor()

    query = "SELECT * FROM trips WHERE 1=1"
    params = []

    if date_filter:
        query += " AND date = ?"
        params.append(date_filter)

    if search:
        search_pattern = f"%{search}%"
        query += " AND (guide LIKE ? OR driver LIKE ? OR company LIKE ? OR pax LIKE ? OR date LIKE ?)"
        params.extend([search_pattern, search_pattern, search_pattern, search_pattern, search_pattern])

    query += " ORDER BY id DESC"

    if limit is not None:
        query += " LIMIT ?"
        params.append(int(limit))
        if offset is not None:
            query += " OFFSET ?"
            params.append(int(offset))

    cur.execute(query, params)
    rows = cur.fetchall()
    records = [trip_row_to_dict(r) for r in rows]
    conn.close()
    return records

def save_raw_records(records):
    """Save records directly into SQLite database (bulk upsert) and clean up legacy JSON files."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM trips")
        for r in records:
            drivers_list_str = json.dumps(r.get("driversList")) if r.get("driversList") else None
            cur.execute("""
            INSERT OR REPLACE INTO trips (
                id, van_type, guide, driver, company, pax, quads, camels,
                person_extra, quad_extra, camel_extra, extra_payment,
                date, time, drivers_list, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (
                r.get("id"),
                str(r.get("van_type", "Big van")),
                str(r.get("guide", "")),
                str(r.get("driver", "")),
                str(r.get("company", "AGM")),
                str(r.get("pax", "0")),
                str(r.get("quads", "0")),
                str(r.get("camels", "0")),
                str(r.get("person_extra", "None")),
                str(r.get("quad_extra", "None")),
                str(r.get("camel_extra", "None")),
                str(r.get("extra_payment", "0 DH")),
                str(r.get("date", "")),
                str(r.get("time", "")),
                drivers_list_str
            ))
        conn.commit()
    except Exception as e:
        print(f"[SQLite Save Error] {e}")
    finally:
        conn.close()

    # Safely clean up any legacy JSON files so system stays fast
    for old_path in [OLD_DB_FILE, OLD_DATA_FILE, "data.json", "database.json", OLD_WORKSPACE_DB_FILE]:
        try:
            if os.path.exists(old_path):
                os.remove(old_path)
        except Exception:
            pass

def is_record_complete(record):
    """
    Validation Algorithm:
    Checks if a record is complete.
    """
    guide = str(record.get("guide", "")).strip().upper()
    driver = str(record.get("driver", "")).strip()
    date_val = str(record.get("date", "")).strip()
    time_val = str(record.get("time", "")).strip()

    if not driver or driver in ["?", "NONE", "UNASSIGNED"]:
        return False
    if not date_val or not time_val:
        return False

    pax = str(record.get("pax", "")).strip()
    quads = str(record.get("quads", "")).strip()
    camels = str(record.get("camels", "")).strip()

    if pax == "?" or quads == "?" or camels == "?":
        return False

    return True

def get_stats():
    """Retrieve statistics for UI status bar."""
    records = load_records()
    done_count = sum(1 for r in records if is_record_complete(r))
    rest_count = len(records) - done_count
    return done_count, rest_count

def sync_to_excel():
    """
    Export and rebuild corporate executive Excel workbooks grouped by year and month.
    """
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
    except ImportError:
        print("[Excel Sync] openpyxl not installed. Skipping direct Excel binary generation.")
        return

    records = load_records()
    
    today_now = datetime.datetime.now()
    today_day = today_now.strftime("%d")
    today_month = today_now.strftime("%m")
    today_year = today_now.strftime("%Y")
    today_str = f"{today_day}-{today_month}-{today_year}"

    # Group records by (year, month)
    monthly_data = {}
    monthly_data[(today_year, today_month)] = []

    for r in records:
        date_val = r.get("date", "")
        _, m, y = parse_date_parts(date_val)
        key = (y, m)
        if key not in monthly_data:
            monthly_data[key] = []
        monthly_data[key].append(r)

    # Rebuild Excel file for each specific month & year
    for (year, month), items in monthly_data.items():
        wb = Workbook()
        ws = wb.active
        ws.title = f"AGM-OPERATIONS {month}-{year}"
        ws.views.sheetView[0].showGridLines = True

        home = os.path.expanduser("~")
        for parent in ["Desktop", "Documents"]:
            target_dir = os.path.join(home, parent, "AGM-WorkSpace", "Years", f"year-{year}", f"{month}-Month")
            try:
                os.makedirs(target_dir, exist_ok=True)
                wb.save(os.path.join(target_dir, f"{month}-{year}.xlsx"))
            except Exception:
                pass

def add_or_update_record(record_id, van_type, guide, driver, pax, quads, camels, date_str, time_str, company="AGM", person_extra="None", quad_extra="None", camel_extra="None", extra_payment="0 DH", drivers_list=None):
    """Adds or updates a record directly into the SQLite database."""
    conn = get_db_connection()
    cur = conn.cursor()

    company = (company or "AGM").strip().upper()
    if van_type.lower() == "mini van" and (not guide or guide.upper() in ["NONE", "H1", "WITHOUT GUIDE"]):
        guide = "WITHOUT GUIDE"
    else:
        guide = (guide or "").strip().upper()

    drivers_json_str = json.dumps(drivers_list) if drivers_list else None

    if record_id is not None:
        target_id = int(record_id)
        cur.execute("""
        UPDATE trips SET
            van_type = ?, guide = ?, driver = ?, company = ?, pax = ?, quads = ?, camels = ?,
            person_extra = ?, quad_extra = ?, camel_extra = ?, extra_payment = ?,
            date = ?, time = ?, drivers_list = ?, updated_at = datetime('now')
        WHERE id = ?;
        """, (
            van_type, guide, driver, company, pax, quads, camels,
            person_extra, quad_extra, camel_extra, extra_payment,
            date_str, time_str, drivers_json_str, target_id
        ))
        if cur.rowcount == 0:
            cur.execute("""
            INSERT INTO trips (
                id, van_type, guide, driver, company, pax, quads, camels,
                person_extra, quad_extra, camel_extra, extra_payment,
                date, time, drivers_list, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
            """, (
                target_id, van_type, guide, driver, company, pax, quads, camels,
                person_extra, quad_extra, camel_extra, extra_payment,
                date_str, time_str, drivers_json_str
            ))
    else:
        cur.execute("""
        INSERT INTO trips (
            van_type, guide, driver, company, pax, quads, camels,
            person_extra, quad_extra, camel_extra, extra_payment,
            date, time, drivers_list, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
        """, (
            van_type, guide, driver, company, pax, quads, camels,
            person_extra, quad_extra, camel_extra, extra_payment,
            date_str, time_str, drivers_json_str
        ))

    conn.commit()
    conn.close()
    sync_to_excel()

def delete_record(record_id):
    """Delete a record from SQLite database and update Excel."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM trips WHERE id = ?;", (int(record_id),))
    conn.commit()
    conn.close()
    sync_to_excel()

if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="AGM Travel SQLite Backend")
    parser.add_argument("--action", type=str, required=True, choices=["init", "load", "add_or_update", "delete", "sync", "check_today"])
    parser.add_argument("--id", type=str, default=None)
    parser.add_argument("--van_type", type=str, default="Big van")
    parser.add_argument("--guide", type=str, default="")
    parser.add_argument("--driver", type=str, default="")
    parser.add_argument("--company", type=str, default="AGM")
    parser.add_argument("--pax", type=str, default="?")
    parser.add_argument("--quads", type=str, default="?")
    parser.add_argument("--camels", type=str, default="?")
    parser.add_argument("--person_extra", type=str, default="None")
    parser.add_argument("--quad_extra", type=str, default="None")
    parser.add_argument("--camel_extra", type=str, default="None")
    parser.add_argument("--extra_payment", type=str, default="0 DH")
    parser.add_argument("--date", type=str, default="")
    parser.add_argument("--time", type=str, default="")
    parser.add_argument("--drivers_json", type=str, default=None)

    args = parser.parse_args()

    try:
        if args.action == "init":
            initialize_system()
            print(json.dumps({"status": "success", "message": "AGM SQLite DB initialized"}))
        elif args.action == "load":
            records = load_records()
            print(json.dumps({"status": "success", "records": records, "count": len(records)}))
        elif args.action == "add_or_update":
            record_id = int(args.id) if args.id is not None and args.id != "null" and args.id != "" else None
            d_list = None
            if args.drivers_json:
                try:
                    d_list = json.loads(args.drivers_json)
                except Exception:
                    pass
            add_or_update_record(
                record_id, args.van_type, args.guide, args.driver,
                args.pax, args.quads, args.camels, args.date, args.time,
                args.company, args.person_extra, args.quad_extra, args.camel_extra,
                args.extra_payment, d_list
            )
            print(json.dumps({"status": "success", "message": "Record saved to SQLite"}))
        elif args.action == "delete":
            if args.id is None:
                sys.exit(1)
            delete_record(int(args.id))
            print(json.dumps({"status": "success", "message": "Record deleted from SQLite"}))
        elif args.action == "sync":
            sync_to_excel()
            print(json.dumps({"status": "success", "message": "Excel synchronized"}))
        elif args.action == "check_today":
            initialize_system()
            sync_to_excel()
            today_str = datetime.datetime.now().strftime("%d-%m-%Y")
            print(json.dumps({"status": "success", "today": today_str}))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)
`;
