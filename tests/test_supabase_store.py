"""Exercise the Supabase/PostgREST code path with a fake HTTP layer (no network)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server import store  # noqa: E402

calls = []


class FakeResp:
    def __init__(self, status, body):
        self.status_code = status
        self._body = body
        self.text = "" if body is None else "x"

    def json(self):
        return self._body


def fake_request(method, url, headers=None, params=None, json=None, timeout=None):
    calls.append((method, url.rsplit("/", 1)[-1], params, json))
    if method == "POST":
        return FakeResp(201, [json])
    if method == "PATCH":
        return FakeResp(200, [{**json, "id": params["id"][3:]}])
    if method == "GET":
        return FakeResp(200, [{"id": "abc", "title": "t"}])
    return FakeResp(204, None)


store.requests.request = fake_request
s = store.SupabaseStore("https://x.supabase.co", "key")
row = s.insert("courses", {"title": "C"})
assert row["id"] and row["created_at"]
assert calls[-1][0] == "POST" and calls[-1][1] == "courses"
s.update("weeks", "w1", {"status": "published"})
assert calls[-1][2] == {"id": "eq.w1"}
s.get("weeks", "w1")
assert calls[-1][2]["id"] == "eq.w1"
s.list("attempts", session_id=["a", "b"])
assert calls[-1][2]["session_id"] == 'in.("a","b")'
s.list("outcomes", week_id="w1")
assert calls[-1][2]["week_id"] == "eq.w1" and calls[-1][2]["order"].startswith("created_at.asc") and calls[-1][2]["limit"] == 1000
print("supabase store ok")
