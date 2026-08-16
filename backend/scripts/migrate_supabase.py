"""Read-only Supabase backup and deterministic import into local SQLite."""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client
from postgrest.exceptions import APIError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.db.sqlite_client import SQLiteClient, _value  # noqa: E402

TABLES = [
    "portfolios", "asset_categories", "assets", "asset_history",
    "target_allocations", "rebalance_plans", "plan_allocations",
    "allocation_groups", "allocation_group_items", "benchmark_history", "user_settings",
]


def backup(output: Path) -> dict:
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY are required")
    client = create_client(url, key)
    payload = {"format": 1, "created_at": datetime.now().astimezone().isoformat(), "tables": {}}
    for table in TABLES:
        rows, offset = [], 0
        while True:
            try:
                page = client.table(table).select("*").range(offset, offset + 999).execute().data or []
            except APIError as exc:
                if exc.code == "PGRST205":
                    print(f"backup {table}: absent (legacy table)")
                    rows = []
                    break
                raise
            rows.extend(page)
            if len(page) < 1000:
                break
            offset += 1000
        payload["tables"][table] = rows
        print(f"backup {table}: {len(rows)}")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


def restore(source: Path, database_url: str) -> None:
    payload = json.loads(source.read_text(encoding="utf-8"))
    db = SQLiteClient.from_url(database_url)
    with db.connect() as conn:
        conn.execute("PRAGMA defer_foreign_keys=ON")
        for table in reversed(TABLES):
            conn.execute(f"DELETE FROM {table}")
        for table in TABLES:
            rows = payload["tables"].get(table, [])
            for row in rows:
                item = {key: _value(value) for key, value in row.items()}
                columns = list(item)
                placeholders = ",".join("?" for _ in columns)
                conn.execute(
                    f"INSERT INTO {table} ({','.join(columns)}) VALUES ({placeholders})",
                    list(item.values()),
                )
            count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            if count != len(rows):
                raise RuntimeError(f"count mismatch for {table}: {count} != {len(rows)}")
            print(f"restore {table}: {count}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["backup", "restore", "all"])
    parser.add_argument("--output", type=Path, default=Path("backups") / f"supabase-backup-{datetime.now():%Y%m%d-%H%M%S}.json")
    parser.add_argument("--database-url", default="sqlite:///./data/meowney.db")
    args = parser.parse_args()
    if args.command in {"backup", "all"}: backup(args.output)
    if args.command in {"restore", "all"}: restore(args.output, args.database_url)


if __name__ == "__main__":
    main()
