"""Storage layer with two interchangeable backends.

* ``JsonStore``      – a single JSON file; used for local development and tests.
* ``SupabaseStore``  – Supabase/PostgREST over plain HTTPS (no SDK needed).

Both expose the same tiny API: ``insert``, ``update``, ``get``, ``list``.
Rows are plain dicts. IDs are client-generated UUIDs so the two backends behave
identically and inserts never need a round trip to learn their id.
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests

from . import config

TABLES = ("courses", "weeks", "outcomes", "sessions", "attempts", "turns", "materials", "chats", "posts", "votes")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


class JsonStore:
    def __init__(self, path: Path):
        self.path = Path(path)
        self._lock = threading.RLock()
        self._data: dict[str, list[dict]] = {t: [] for t in TABLES}
        if self.path.exists():
            try:
                loaded = json.loads(self.path.read_text())
                for t in TABLES:
                    self._data[t] = loaded.get(t, [])
            except json.JSONDecodeError:
                pass

    # -- persistence -------------------------------------------------------
    def _flush(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._data, indent=1))
        os.replace(tmp, self.path)

    def reset(self) -> None:
        with self._lock:
            self._data = {t: [] for t in TABLES}
            self._flush()

    # -- CRUD --------------------------------------------------------------
    def insert(self, table: str, row: dict) -> dict:
        with self._lock:
            row = dict(row)
            row.setdefault("id", new_id())
            row.setdefault("created_at", now_iso())
            self._data[table].append(row)
            self._flush()
            return row

    def insert_many(self, table: str, rows: list[dict]) -> list[dict]:
        with self._lock:
            out = []
            for row in rows:
                row = dict(row)
                row.setdefault("id", new_id())
                row.setdefault("created_at", now_iso())
                self._data[table].append(row)
                out.append(row)
            self._flush()
            return out

    # child table -> (foreign key column, parent table); mirrors the ON DELETE CASCADE rules in sql/schema.sql
    _CASCADE = {
        "weeks": [("outcomes", "week_id"), ("sessions", "week_id"), ("posts", "week_id")],
        "sessions": [("attempts", "session_id"), ("materials", "session_id"), ("chats", "session_id"), ("posts", "session_id"), ("outcomes", "session_id")],
        "outcomes": [("attempts", "outcome_id"), ("posts", "outcome_id")],
        "attempts": [("turns", "attempt_id")],
        "posts": [("votes", "post_id")],
    }

    def delete(self, table: str, id: str) -> None:
        with self._lock:
            self._delete_rec(table, id)
            self._flush()

    def _delete_rec(self, table: str, id: str) -> None:
        for child, fk in self._CASCADE.get(table, []):
            for r in [r for r in self._data[child] if r.get(fk) == id]:
                self._delete_rec(child, r["id"])
        self._data[table] = [r for r in self._data[table] if r["id"] != id]

    def update(self, table: str, id: str, patch: dict) -> dict | None:
        with self._lock:
            for row in self._data[table]:
                if row["id"] == id:
                    row.update(patch)
                    self._flush()
                    return row
            return None

    def get(self, table: str, id: str) -> dict | None:
        with self._lock:
            return next((dict(r) for r in self._data[table] if r["id"] == id), None)

    def list(self, table: str, **filters: Any) -> list[dict]:
        with self._lock:
            rows = self._data[table]
            for k, v in filters.items():
                if isinstance(v, (list, tuple, set)):
                    rows = [r for r in rows if r.get(k) in v]
                else:
                    rows = [r for r in rows if r.get(k) == v]
            return [dict(r) for r in rows]


class SupabaseStore:
    """Minimal PostgREST client. Requires the tables in sql/schema.sql."""

    def __init__(self, url: str, key: str):
        self.base = f"{url}/rest/v1"
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def _req(self, method: str, table: str, *, params=None, json_body=None, prefer=None) -> Any:
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        r = requests.request(
            method, f"{self.base}/{table}", headers=headers, params=params, json=json_body, timeout=20
        )
        if r.status_code >= 400:
            raise RuntimeError(f"Supabase {method} {table} failed {r.status_code}: {r.text[:300]}")
        return r.json() if r.text else None

    def reset(self) -> None:  # used by the seed script
        for t in reversed(TABLES):
            self._req("DELETE", t, params={"id": "neq.00000000-0000-0000-0000-000000000000"})

    def insert(self, table: str, row: dict) -> dict:
        row = dict(row)
        row.setdefault("id", new_id())
        row.setdefault("created_at", now_iso())
        out = self._req("POST", table, json_body=row, prefer="return=representation")
        return out[0] if isinstance(out, list) else row

    def insert_many(self, table: str, rows: list[dict]) -> list[dict]:
        rows = [dict(r) for r in rows]
        for r in rows:
            r.setdefault("id", new_id())
            r.setdefault("created_at", now_iso())
        for i in range(0, len(rows), 500):
            self._req("POST", table, json_body=rows[i : i + 500], prefer="return=minimal")
        return rows

    def delete(self, table: str, id: str) -> None:
        self._req("DELETE", table, params={"id": f"eq.{id}"})

    def update(self, table: str, id: str, patch: dict) -> dict | None:
        out = self._req("PATCH", table, params={"id": f"eq.{id}"}, json_body=patch, prefer="return=representation")
        return out[0] if out else None

    def get(self, table: str, id: str) -> dict | None:
        out = self._req("GET", table, params={"id": f"eq.{id}", "limit": 1})
        return out[0] if out else None

    PAGE = 1000  # PostgREST's default max-rows; page through so big classes are never truncated

    def list(self, table: str, **filters: Any) -> list[dict]:
        params: dict[str, str] = {"order": "created_at.asc,id.asc"}
        for k, v in filters.items():
            if isinstance(v, (list, tuple, set)):
                if not v:
                    return []
                vals = ",".join(f'"{x}"' for x in v)
                params[k] = f"in.({vals})"
            else:
                params[k] = f"eq.{v}"
        out: list[dict] = []
        offset = 0
        while True:
            page = self._req("GET", table, params={**params, "limit": self.PAGE, "offset": offset}) or []
            out.extend(page)
            if len(page) < self.PAGE:
                return out
            offset += self.PAGE


_store = None


def get_store():
    global _store
    if _store is None:
        if config.STORE_BACKEND == "supabase":
            _store = SupabaseStore(config.SUPABASE_URL, config.SUPABASE_KEY)
        else:
            _store = JsonStore(config.JSON_STORE_PATH)
    return _store
