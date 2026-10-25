"""Central configuration. Everything is driven by environment variables so the same
code runs locally (mock LLM + JSON file store) and on Vercel (Gemini + Supabase)."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Product name lives in one place so it can be renamed with a single env var.
APP_NAME = os.environ.get("APP_NAME", "Utschytl")
APP_TAGLINE = os.environ.get(
    "APP_TAGLINE", "Explain it back. Find out what you actually understand."
)

# LLM
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
LLM_PROVIDER = os.environ.get("LLM_PROVIDER") or ("gemini" if GEMINI_API_KEY else "mock")

# Storage
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")  # publishable/anon key is enough with the demo RLS policies
STORE_BACKEND = os.environ.get("STORE_BACKEND") or ("supabase" if SUPABASE_URL and SUPABASE_KEY else "json")
# On Vercel the filesystem is read-only except /tmp, so the JSON store falls back there.
JSON_STORE_PATH = Path(
    os.environ.get("JSON_STORE_PATH")
    or (ROOT / "data" / "store.json" if os.access(ROOT, os.W_OK) else Path("/tmp/utschytl-store.json"))
)

# Pedagogy / reporting knobs
MIN_STUDENTS_FOR_QUOTES = int(os.environ.get("MIN_STUDENTS_FOR_QUOTES", "5"))
HINT_AFTER_ATTEMPTS = int(os.environ.get("HINT_AFTER_ATTEMPTS", "2"))
MAX_TURNS_PER_OUTCOME = int(os.environ.get("MAX_TURNS_PER_OUTCOME", "12"))
JUDGE_VOTES = int(os.environ.get("JUDGE_VOTES", "2"))  # independent judge calls that must agree
RECALL_AFTER_DAYS = int(os.environ.get("RECALL_AFTER_DAYS", "3"))  # spaced re-explain comes due after this
MAX_MATERIAL_CHARS = int(os.environ.get("MAX_MATERIAL_CHARS", "120000"))  # per session, student-added material

LECTURER_PIN = os.environ.get("LECTURER_PIN", "1234")  # demo-only gate for the lecturer area
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
