"""Run the app locally: python run_local.py  (http://127.0.0.1:5000)
Reads a .env file in this folder if present (no extra packages needed)."""
import os
from pathlib import Path

env = Path(__file__).with_name(".env")
if env.exists():
    for line in env.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from server.app import app  # noqa: E402

if __name__ == "__main__":
    from server import config

    print(f"AI: {config.LLM_PROVIDER}   storage: {config.STORE_BACKEND}   http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=os.environ.get("FLASK_DEBUG") == "1")
