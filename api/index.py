"""Vercel entrypoint. Vercel's Python runtime looks for a WSGI/ASGI `app` here."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server.app import app  # noqa: E402,F401
