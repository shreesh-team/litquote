import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2 import pool

load_dotenv()

_pool: pool.ThreadedConnectionPool | None = None


def get_pool() -> pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        dsn = os.environ["DATABASE_URL"]
        try:
            _pool = pool.ThreadedConnectionPool(minconn=2, maxconn=10, dsn=dsn)
            # Verify connectivity with a quick probe
            conn = _pool.getconn()
            _pool.putconn(conn)
            print("DB: connection pool initialised OK")
        except Exception as exc:
            print(f"DB: connection pool FAILED — {exc}")
            raise
    return _pool


def get_db():
    p = get_pool()
    conn = p.getconn()
    try:
        yield conn
    finally:
        p.putconn(conn)


def run_migrations():
    conn = get_pool().getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    filename TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            conn.commit()

            migrations_dir = Path(__file__).parent / "migrations"
            sql_files = sorted(migrations_dir.glob("*.sql"))
            applied = 0

            for path in sql_files:
                cur.execute(
                    "SELECT 1 FROM schema_migrations WHERE filename = %s",
                    (path.name,),
                )
                if cur.fetchone():
                    continue
                cur.execute(path.read_text(encoding="utf-8"))
                cur.execute(
                    "INSERT INTO schema_migrations (filename) VALUES (%s)",
                    (path.name,),
                )
                conn.commit()
                print(f"DB migration applied: {path.name}")
                applied += 1

        if applied == 0:
            print("DB: all migrations already up to date")
        else:
            print(f"DB: {applied} migration(s) applied")
    finally:
        get_pool().putconn(conn)
