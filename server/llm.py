"""LLM access. Two providers behind one interface:

* ``gemini`` – Google Gemini via the REST API (no SDK, just ``requests``).
* ``mock``   – deterministic, offline. Keyword-overlap judge and canned tutor
               questions, good enough to exercise every screen without a key.

The rest of the app only ever calls ``complete_json`` and ``complete_text``.
"""
from __future__ import annotations

import json
import re
from typing import Any

import requests

from . import config


class LLMError(RuntimeError):
    pass


# --------------------------------------------------------------------------
# Gemini
# --------------------------------------------------------------------------
def _gemini(system: str, user: str, *, temperature: float, json_mode: bool) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{config.GEMINI_MODEL}:generateContent?key={config.GEMINI_API_KEY}"
    )
    body: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": 8192,
            # Flash models think by default; the tutor/judge turns are short, so disable it for speed.
            "thinkingConfig": {"thinkingBudget": 0},
        },
        "safetySettings": [
            {"category": c, "threshold": "BLOCK_ONLY_HIGH"}
            for c in (
                "HARM_CATEGORY_HARASSMENT",
                "HARM_CATEGORY_HATE_SPEECH",
                "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "HARM_CATEGORY_DANGEROUS_CONTENT",
            )
        ],
    }
    if json_mode:
        body["generationConfig"]["responseMimeType"] = "application/json"
    try:
        r = requests.post(url, json=body, timeout=60)
    except requests.RequestException as e:
        raise LLMError(f"Could not reach Gemini: {e}") from e
    if r.status_code >= 400:
        raise LLMError(f"Gemini {r.status_code}: {r.text[:400]}")
    data = r.json()
    try:
        return "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])
    except (KeyError, IndexError) as e:
        raise LLMError(f"Gemini returned no text: {json.dumps(data)[:400]}") from e


def _extract_json(text: str) -> Any:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"[\[{].*[\]}]", text, flags=re.S)
        if not m:
            raise LLMError(f"No JSON in model output: {text[:200]}")
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError as e:
            raise LLMError(f"Model output was not valid JSON (possibly truncated): {text[:200]}") from e


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------
def complete_text(system: str, user: str, *, temperature: float = 0.4, mock: Any = None) -> str:
    if config.LLM_PROVIDER == "mock":
        return mock() if callable(mock) else (mock or "")
    return _gemini(system, user, temperature=temperature, json_mode=False).strip()


def complete_json(system: str, user: str, *, temperature: float = 0.2, mock: Any = None) -> Any:
    if config.LLM_PROVIDER == "mock":
        return mock() if callable(mock) else mock
    raw = _gemini(system, user, temperature=temperature, json_mode=True)
    return _extract_json(raw)


def provider_label() -> str:
    return "Google Gemini (" + config.GEMINI_MODEL + ")" if config.LLM_PROVIDER == "gemini" else "offline mock"
