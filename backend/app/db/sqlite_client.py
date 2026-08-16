"""Small SQLite client compatible with the Supabase query subset used by Meowney."""
from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from threading import RLock
from typing import Any
from uuid import UUID, uuid4


@dataclass
class QueryResponse:
    data: Any


def _value(value: Any) -> Any:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (UUID, date, datetime)):
        return str(value)
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return value


class SQLiteClient:
    def __init__(self, path: Path):
        self.path = path.resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self.migrate()

    @classmethod
    def from_url(cls, url: str) -> "SQLiteClient":
        prefix = "sqlite:///"
        if not url.startswith(prefix):
            raise ValueError("DATABASE_URL must start with sqlite:///")
        return cls(Path(url[len(prefix):]))

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=30000")
        return conn

    def migrate(self) -> None:
        migration_dir = Path(__file__).with_name("migrations")
        with self._lock, self.connect() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
            applied = {r[0] for r in conn.execute("SELECT version FROM schema_migrations")}
            for file in sorted(migration_dir.glob("*.sql")):
                if file.stem in applied:
                    continue
                conn.executescript(file.read_text(encoding="utf-8"))
                conn.execute("INSERT INTO schema_migrations(version) VALUES (?)", (file.stem,))

    def table(self, name: str) -> "SQLiteQuery":
        if not re.fullmatch(r"[a-z_]+", name):
            raise ValueError("Invalid table name")
        return SQLiteQuery(self, name)


class SQLiteQuery:
    RELATIONS = {
        ("assets", "asset_categories"): ("category_id", "id"),
        ("rebalance_plans", "plan_allocations"): ("id", "plan_id"),
        ("rebalance_plans", "allocation_groups"): ("id", "plan_id"),
        ("allocation_groups", "allocation_group_items"): ("id", "group_id"),
    }

    def __init__(self, client: SQLiteClient, table: str):
        self.client, self.name = client, table
        self.action, self.selection, self.payload = "select", "*", None
        self.filters: list[tuple[str, str, Any]] = []
        self.ordering: tuple[str, bool] | None = None
        self.max_rows: int | None = None
        self.want_single = False
        self.conflict: str | None = None

    def select(self, columns: str = "*") -> "SQLiteQuery": self.selection = columns; return self
    def insert(self, data: Any) -> "SQLiteQuery": self.action, self.payload = "insert", data; return self
    def update(self, data: dict) -> "SQLiteQuery": self.action, self.payload = "update", data; return self
    def delete(self) -> "SQLiteQuery": self.action = "delete"; return self
    def upsert(self, data: Any, on_conflict: str | None = None) -> "SQLiteQuery": self.action, self.payload, self.conflict = "upsert", data, on_conflict; return self
    def eq(self, col: str, val: Any) -> "SQLiteQuery": self.filters.append((col, "=", val)); return self
    def neq(self, col: str, val: Any) -> "SQLiteQuery": self.filters.append((col, "!=", val)); return self
    def gte(self, col: str, val: Any) -> "SQLiteQuery": self.filters.append((col, ">=", val)); return self
    def lte(self, col: str, val: Any) -> "SQLiteQuery": self.filters.append((col, "<=", val)); return self
    def gt(self, col: str, val: Any) -> "SQLiteQuery": self.filters.append((col, ">", val)); return self
    def lt(self, col: str, val: Any) -> "SQLiteQuery": self.filters.append((col, "<", val)); return self
    def in_(self, col: str, vals: list[Any]) -> "SQLiteQuery": self.filters.append((col, "IN", vals)); return self
    def order(self, col: str, desc: bool = False) -> "SQLiteQuery": self.ordering = (col, desc); return self
    def limit(self, count: int) -> "SQLiteQuery": self.max_rows = count; return self
    def single(self) -> "SQLiteQuery": self.want_single = True; self.max_rows = 1; return self

    def _where(self) -> tuple[str, list[Any]]:
        clauses, args = [], []
        for col, op, val in self.filters:
            if not re.fullmatch(r"[a-z_]+", col): raise ValueError("Invalid column")
            if op == "IN":
                if not val: clauses.append("0"); continue
                clauses.append(f"{col} IN ({','.join('?' for _ in val)})"); args.extend(_value(v) for v in val)
            else:
                clauses.append(f"{col} {op} ?"); args.append(_value(val))
        return (" WHERE " + " AND ".join(clauses) if clauses else "", args)

    @staticmethod
    def _split_selection(text: str) -> list[str]:
        result, start, depth = [], 0, 0
        for i, char in enumerate(text):
            depth += char == "("; depth -= char == ")"
            if char == "," and depth == 0: result.append(text[start:i].strip()); start = i + 1
        result.append(text[start:].strip())
        return result

    def _relations(self) -> list[tuple[str, str]]:
        return [(m.group(1), m.group(2)) for part in self._split_selection(self.selection)
                if (m := re.fullmatch(r"([a-z_]+)\((.*)\)", part))]

    def _enrich(self, conn: sqlite3.Connection, rows: list[dict]) -> list[dict]:
        for row in rows:
            if isinstance(row.get("category_breakdown"), str):
                try: row["category_breakdown"] = json.loads(row["category_breakdown"])
                except json.JSONDecodeError: pass
        for relation, nested in self._relations():
            parent_col, child_col = self.RELATIONS[(self.name, relation)]
            many = child_col != "id"
            for row in rows:
                found = conn.execute(f"SELECT * FROM {relation} WHERE {child_col} = ?", (row.get(parent_col),)).fetchall()
                children = [dict(r) for r in found]
                if children and any("(" in p for p in self._split_selection(nested)):
                    q = SQLiteQuery(self.client, relation); q.selection = nested; children = q._enrich(conn, children)
                row[relation] = children if many else (children[0] if children else None)
        return rows

    def execute(self) -> QueryResponse:
        where, args = self._where()
        with self.client._lock, self.client.connect() as conn:
            if self.action == "select":
                simple = [p for p in self._split_selection(self.selection) if "(" not in p]
                columns = "*" if "*" in simple or not simple else ",".join(simple)
                sql = f"SELECT {columns} FROM {self.name}{where}"
                if self.ordering: sql += f" ORDER BY {self.ordering[0]} {'DESC' if self.ordering[1] else 'ASC'}"
                if self.max_rows is not None: sql += " LIMIT ?"; args.append(self.max_rows)
                rows = self._enrich(conn, [dict(r) for r in conn.execute(sql, args).fetchall()])
                return QueryResponse(rows[0] if self.want_single and rows else (None if self.want_single else rows))
            items = self.payload if isinstance(self.payload, list) else [self.payload]
            result: list[dict] = []
            if self.action in {"insert", "upsert"}:
                for raw in items:
                    item = {k: _value(v) for k, v in raw.items()}; item.setdefault("id", str(uuid4()))
                    cols = list(item); placeholders = ",".join("?" for _ in cols)
                    if self.action == "upsert":
                        conflict = self.conflict or ("ticker,snapshot_date" if self.name == "benchmark_history" else "id")
                        updates = ",".join(f"{c}=excluded.{c}" for c in cols if c not in conflict.split(","))
                        suffix = f" ON CONFLICT({conflict}) DO UPDATE SET {updates}"
                    else: suffix = ""
                    conn.execute(f"INSERT INTO {self.name} ({','.join(cols)}) VALUES ({placeholders}){suffix}", list(item.values()))
                    saved = conn.execute(f"SELECT * FROM {self.name} WHERE id=?", (item["id"],)).fetchone()
                    if saved is None and self.action == "upsert":
                        conflict_cols = conflict.split(",")
                        saved = conn.execute(
                            f"SELECT * FROM {self.name} WHERE " + " AND ".join(f"{c}=?" for c in conflict_cols),
                            [item[c] for c in conflict_cols],
                        ).fetchone()
                    result.append(dict(saved))
            else:
                before = [dict(r) for r in conn.execute(f"SELECT * FROM {self.name}{where}", args).fetchall()]
                if self.action == "delete": conn.execute(f"DELETE FROM {self.name}{where}", args)
                else:
                    item = {k: _value(v) for k, v in self.payload.items()}; sets = ",".join(f"{k}=?" for k in item)
                    conn.execute(f"UPDATE {self.name} SET {sets}{where}", list(item.values()) + args)
                result = before if self.action == "delete" else [dict(r) for r in conn.execute(f"SELECT * FROM {self.name}{where}", args).fetchall()]
            return QueryResponse(result)
