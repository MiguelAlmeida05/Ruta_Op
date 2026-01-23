import json
import os
import sqlite3
import threading
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.core.logger import get_logger

logger = get_logger(__name__)


_lock = threading.Lock()
_conn: Optional[sqlite3.Connection] = None


def _db_path() -> str:
    base_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    os.makedirs(base_dir, exist_ok=True)
    return os.path.abspath(os.path.join(base_dir, "tudistri.sqlite3"))


def get_db() -> sqlite3.Connection:
    global _conn
    with _lock:
        if _conn is None:
            path = _db_path()
            _conn = sqlite3.connect(path, check_same_thread=False)
            _conn.row_factory = sqlite3.Row
            _conn.execute("PRAGMA journal_mode=WAL;")
            _conn.execute("PRAGMA foreign_keys=ON;")
            _init_schema(_conn)
        return _conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT,
            image_url TEXT,
            price_per_unit REAL NOT NULL,
            unit TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sellers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            products_json TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            rating REAL NOT NULL,
            trips_count INTEGER NOT NULL,
            seller_type TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            product_id TEXT NOT NULL,
            weight_kg REAL NOT NULL,
            FOREIGN KEY(product_id) REFERENCES products(id)
        );

        CREATE INDEX IF NOT EXISTS idx_orders_product_created_at ON orders(product_id, created_at);

        CREATE TABLE IF NOT EXISTS simulation_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            event_type TEXT NOT NULL,
            payload_json TEXT NOT NULL
        );
        """
    )
    conn.commit()


def _count(conn: sqlite3.Connection, table: str) -> int:
    cur = conn.execute(f"SELECT COUNT(1) AS c FROM {table}")
    row = cur.fetchone()
    return int(row["c"]) if row else 0


def seed_if_empty(products: List[Dict[str, Any]], sellers: List[Dict[str, Any]]) -> None:
    conn = get_db()
    if _count(conn, "products") == 0:
        _seed_products(conn, products)
    if _count(conn, "sellers") == 0:
        _seed_sellers(conn, sellers)
    if _count(conn, "orders") == 0:
        _seed_orders(conn, products)
    _ensure_product_images(conn, products)


def _ensure_product_images(conn: sqlite3.Connection, products: List[Dict[str, Any]]) -> None:
    rows = []
    for p in products:
        pid = str(p["id"])
        url = str(p.get("image_url") or "")
        if not url:
            url = f"/assets/products/{pid}.jpg"
        rows.append((url, pid))
    conn.executemany("UPDATE products SET image_url = ? WHERE id = ?", rows)
    conn.commit()


def _seed_products(conn: sqlite3.Connection, products: List[Dict[str, Any]]) -> None:
    rows = [
        (
            str(p["id"]),
            str(p["name"]),
            str(p.get("icon") or ""),
            str(p.get("image_url") or ""),
            float(p["price_per_unit"]),
            str(p["unit"]),
        )
        for p in products
    ]
    conn.executemany(
        "INSERT INTO products (id, name, icon, image_url, price_per_unit, unit) VALUES (?, ?, ?, ?, ?, ?)",
        rows,
    )
    conn.commit()
    logger.info(f"Seeded products: {len(rows)}")


def _seed_sellers(conn: sqlite3.Connection, sellers: List[Dict[str, Any]]) -> None:
    rows = []
    for s in sellers:
        coords = s.get("coordinates") or {}
        rows.append(
            (
                str(s["id"]),
                str(s["name"]),
                json.dumps(list(s.get("products") or []), ensure_ascii=False),
                float(coords.get("lat")),
                float(coords.get("lng")),
                float(s.get("rating") or 0),
                int(s.get("trips_count") or 0),
                str(s.get("type") or ""),
            )
        )
    conn.executemany(
        "INSERT INTO sellers (id, name, products_json, lat, lng, rating, trips_count, seller_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        rows,
    )
    conn.commit()
    logger.info(f"Seeded sellers: {len(rows)}")


def _seed_orders(conn: sqlite3.Connection, products: List[Dict[str, Any]]) -> None:
    now = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    start = now - timedelta(days=365)

    rows: List[Tuple[str, str, float]] = []
    for p in products:
        product_id = str(p["id"])
        base = 150.0
        if product_id in ("cafe", "cacao"):
            base = 70.0
        elif product_id in ("platano", "limon", "yuca"):
            base = 220.0

        for i in range(366):
            d = start + timedelta(days=i)
            week = (d.timetuple().tm_yday / 365.0) * 2.0 * 3.1415926535
            seasonal = 1.0 + 0.18 * (0.5 * (1.0 + __import__("math").sin(week)))
            weekday = d.weekday()
            weekly = 1.0 + (0.08 if weekday in (4, 5) else -0.03 if weekday in (0,) else 0.0)
            noise = max(0.6, min(1.4, 1.0 + __import__("random").uniform(-0.12, 0.12)))
            kg = max(1.0, base * seasonal * weekly * noise)
            rows.append((d.isoformat(), product_id, float(round(kg, 3))))

    conn.executemany("INSERT INTO orders (created_at, product_id, weight_kg) VALUES (?, ?, ?)", rows)
    conn.commit()
    logger.info(f"Seeded orders: {len(rows)}")


def fetch_products() -> List[Dict[str, Any]]:
    conn = get_db()
    cur = conn.execute("SELECT id, name, icon, image_url, price_per_unit, unit FROM products ORDER BY name ASC")
    return [dict(r) for r in cur.fetchall()]


def fetch_product_by_id(product_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cur = conn.execute(
        "SELECT id, name, icon, image_url, price_per_unit, unit FROM products WHERE id = ?",
        (product_id,),
    )
    row = cur.fetchone()
    return dict(row) if row else None


def fetch_sellers(product_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db()
    cur = conn.execute("SELECT id, name, products_json, lat, lng, rating, trips_count, seller_type FROM sellers")
    sellers: List[Dict[str, Any]] = []
    for r in cur.fetchall():
        products = json.loads(r["products_json"]) if r["products_json"] else []
        if product_id and product_id not in products:
            continue
        sellers.append(
            {
                "id": r["id"],
                "name": r["name"],
                "products": products,
                "coordinates": {"lat": float(r["lat"]), "lng": float(r["lng"])},
                "rating": float(r["rating"]),
                "trips_count": int(r["trips_count"]),
                "type": r["seller_type"],
            }
        )
    return sellers


def log_simulation_event(event_type: str, payload: Dict[str, Any]) -> None:
    conn = get_db()
    conn.execute(
        "INSERT INTO simulation_events (created_at, event_type, payload_json) VALUES (?, ?, ?)",
        (datetime.utcnow().isoformat(), str(event_type), json.dumps(payload, ensure_ascii=False)),
    )
    conn.commit()


def fetch_daily_demand(product_id: str, since_iso: str) -> List[Tuple[str, float]]:
    conn = get_db()
    cur = conn.execute(
        """
        SELECT substr(created_at, 1, 10) AS day, SUM(weight_kg) AS total
        FROM orders
        WHERE product_id = ? AND created_at >= ?
        GROUP BY day
        ORDER BY day ASC
        """,
        (product_id, since_iso),
    )
    return [(str(r["day"]), float(r["total"])) for r in cur.fetchall()]
