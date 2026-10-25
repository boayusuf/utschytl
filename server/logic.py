"""Pedagogical core: drafting outcomes, judging explanations, tutoring, and
aggregating the lecturer's gap report. Pure functions over the store."""
from __future__ import annotations

import random
import re
from collections import Counter, defaultdict
from typing import Any

from . import config, llm, prompts
from .store import get_store, new_id, now_iso

# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
_WORD = re.compile(r"[a-zA-Z][a-zA-Z\-']+")
_STOP = set(
    "the a an and or of to in on for with is are be as it its that this these those by from at "
    "into than then so if not no do does did can could would should will may might must have has had "
    "what why how when where which who whom about over under between each every any some such more most "
    "very just also only own same other out up down off again further once here there all both few".split()
)


def _keywords(text: str) -> set[str]:
    return {w.lower() for w in _WORD.findall(text) if w.lower() not in _STOP and len(w) > 2}


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", re.sub(r"\s+", " ", text.lower())).strip()


def _evidence_in_student_text(evidence: str, student_text: str) -> bool:
    """A judge may only cite words the student actually wrote. Fuzzy: normalised substring,
    or >= 80% of the evidence's words appearing in order-insensitive form."""
    ev, st = _norm(evidence), _norm(student_text)
    if not ev:
        return False
    if ev in st:
        return True
    ew = ev.split()
    sw = set(st.split())
    return len(ew) >= 4 and sum(1 for w in ew if w in sw) / len(ew) >= 0.8


def _strip_echoes(student_text: str, outcome: dict, extra: list[str] | None = None) -> str:
    """Remove any rubric line, or any sentence of a revealed answer, that the student pasted back verbatim,
    so copied text can never serve as evidence."""
    st = _norm(student_text)
    lines = [l for c in outcome["criteria"] for l in (c.get("text", ""), c.get("student_label", ""))]
    for t in extra or []:
        lines += re.split(r"(?<=[.!?])\s+|\n+", t)
    for line in lines:
        n = _norm(line)
        if len(n) > 15:
            st = st.replace(n, " ")
    return st


def _transcript(turns: list[dict]) -> str:
    lines = []
    for t in turns:
        who = "STUDENT" if t["role"] == "student" else "TUTOR"
        lines.append(f"{who}: {t['content']}")
    return "\n".join(lines) or "(no messages yet)"


def _criteria_block(criteria: list[dict]) -> str:
    return "\n".join(f"- id={c['id']}: {c['text']}" for c in criteria)


# --------------------------------------------------------------------------
# 1. Drafting outcomes from lecture material
# --------------------------------------------------------------------------
def safe_student_label(label: str, answer_terms: list[str], n: int) -> str:
    """The label students see must never contain a give-away term."""
    low = label.lower()
    if not label or any(t and t.lower() in low for t in answer_terms):
        return f"Point {n}: something the lecturer expects you to cover"
    return label[:160]

def draft_outcomes(course_title: str, material: str) -> dict:
    material = material.strip()[:60000]

    def mock():
        # Build plausible outcomes from the headings/sentences in the material.
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", material) if 25 < len(s.strip()) < 160]
        random.Random(7).shuffle(sentences)
        picks = sentences[:10] or ["The main idea of this lecture", "Why the main idea matters in practice"]
        outs = []
        for i, s in enumerate(picks):
            kw = sorted(_keywords(s))[:3] or ["idea"]
            title = " ".join(w.capitalize() for w in kw)[:60]
            outs.append(
                {
                    "title": title,
                    "prompt": f"Explain in your own words: {s.rstrip('.')}.",
                    "slide_ref": f"slide {i + 2}",
                    "criteria": [
                        {"text": f"States what '{kw[0]}' means in this context", "student_label": "Says what the key term means here", "answer_terms": [kw[0]]},
                        {"text": "Gives a concrete example or consequence", "student_label": "Gives a concrete example or consequence", "answer_terms": []},
                        {"text": "Says why it matters", "student_label": "Says why it matters", "answer_terms": []},
                    ],
                    "common_misconceptions": [f"Confuses {kw[0]} with a related idea"],
                }
            )
        return {"week_title": course_title + " (drafted)", "outcomes": outs}

    data = llm.complete_json(
        prompts.DRAFT_OUTCOMES_SYSTEM,
        prompts.DRAFT_OUTCOMES_USER.format(course=course_title, material=material),
        temperature=0.4,
        mock=mock,
    )
    outs = []
    for o in data.get("outcomes", [])[:14]:
        crits = []
        for c in o.get("criteria", [])[:4]:
            terms = [str(t).strip() for t in c.get("answer_terms", []) if str(t).strip()][:3]
            label = str(c.get("student_label", "")).strip()
            crits.append(
                {
                    "id": new_id()[:8],
                    "text": str(c.get("text", "")).strip(),
                    "student_label": safe_student_label(label, terms, len(crits) + 1),
                    "answer_terms": terms,
                }
            )
        if not crits:
            continue
        outs.append(
            {
                "title": str(o.get("title", "Untitled")).strip()[:80],
                "prompt": str(o.get("prompt", "")).strip(),
                "slide_ref": str(o.get("slide_ref", "")).strip(),
                "criteria": crits,
                "common_misconceptions": [str(m) for m in o.get("common_misconceptions", [])][:3],
            }
        )
    return {"week_title": str(data.get("week_title", course_title)).strip()[:120], "outcomes": outs}


# --------------------------------------------------------------------------
# 2. Judging the student's explanation
# --------------------------------------------------------------------------
def _mock_judge(outcome: dict, turns: list[dict], extra_strip: list[str] | None = None) -> dict:
    student_text = _strip_echoes(" ".join(t["content"] for t in turns if t["role"] == "student"), outcome, extra_strip)
    words = _keywords(student_text)
    last = next((t["content"] for t in reversed(turns) if t["role"] == "student"), "")
    gave_up = bool(re.search(r"\b(i don'?t know|no idea|just tell me|give me the answer|idk)\b", last.lower()))
    res = []
    for c in outcome["criteria"]:
        ck = _keywords(c["text"]) | {t.lower() for t in c.get("answer_terms", [])}
        overlap = words & ck
        met = len(overlap) >= max(1, min(2, len(ck) // 3)) and len(student_text) > 40
        ev = ""
        if met:
            for sent in re.split(r"(?<=[.!?])\s+", student_text):
                if _keywords(sent) & overlap:
                    ev = sent.strip()[:160]
                    break
        res.append({"id": c["id"], "met": met, "evidence": ev})
    misc = []
    for m in outcome.get("common_misconceptions", []):
        if _keywords(m) & words and len(_keywords(m) & words) >= 2:
            misc.append(m)
    return {"criteria": res, "misconceptions": misc, "gave_up": gave_up, "summary": "Mock judge summary."}


def judge(outcome: dict, turns: list[dict], extra_strip: list[str] | None = None) -> dict:
    """Run the judge JUDGE_VOTES times; a criterion counts as met only if every vote agrees."""
    user = prompts.JUDGE_USER.format(
        title=outcome["title"],
        prompt=outcome["prompt"],
        criteria_block=_criteria_block(outcome["criteria"]),
        transcript=_transcript(turns),
    )
    votes = []
    n_votes = 1 if config.LLM_PROVIDER == "mock" else max(1, config.JUDGE_VOTES)
    for i in range(n_votes):
        v = llm.complete_json(
            prompts.JUDGE_SYSTEM, user, temperature=0.1 + 0.2 * i, mock=lambda: _mock_judge(outcome, turns, extra_strip)
        )
        votes.append(v)

    student_text = _strip_echoes(" ".join(t["content"] for t in turns if t["role"] == "student"), outcome, extra_strip)
    by_id: dict[str, list[dict]] = defaultdict(list)
    for v in votes:
        for c in v.get("criteria", []):
            by_id[str(c.get("id"))].append(c)
    criteria = []
    for c in outcome["criteria"]:
        cs = by_id.get(c["id"], [])
        met = bool(cs) and all(bool(x.get("met")) for x in cs)
        evidence = next((str(x.get("evidence", "")) for x in cs if x.get("evidence")), "") if met else ""
        # Hard checks that no prompt can be talked out of:
        # (a) the evidence must be words the student actually wrote;
        # (b) pasting the rubric line back never counts.
        if met and not _evidence_in_student_text(evidence, student_text):
            met, evidence = False, ""
        criteria.append({"id": c["id"], "met": met, "evidence": evidence[:300]})
    miscs = []
    seen = set()
    for v in votes:
        for m in v.get("misconceptions", []) or []:
            m = str(m).strip()
            if m and m.lower() not in seen:
                seen.add(m.lower())
                miscs.append(m[:200])
    return {
        "criteria": criteria,
        "misconceptions": miscs[:4],
        "gave_up": any(bool(v.get("gave_up")) for v in votes),
        "summary": str(votes[0].get("summary", ""))[:300],
        "votes": n_votes,
    }


# --------------------------------------------------------------------------
# 3. Tutor turn with answer-reveal gate
# --------------------------------------------------------------------------
_MOCK_PROBES = [
    "You mentioned {said}. Can you give me a concrete situation where that shows up, and what happens there?",
    "Suppose a classmate said the opposite of what you just wrote. What would you point to that shows they're wrong?",
    "Why would anyone care about this when building real software? Walk me through one consequence.",
    "Take the part about {said} one step further: what changes if the input gets much bigger?",
    "You're close. What is the one thing a lecturer would still want you to say about this?",
]


def _mock_tutor(outcome: dict, turns: list[dict], target: dict | None, attempts: int) -> str:
    last = next((t["content"] for t in reversed(turns) if t["role"] == "student"), "")
    said = (" ".join(sorted(_keywords(last))[:2]) or "that").lower()
    i = (len(turns) // 2) % len(_MOCK_PROBES)
    msg = _MOCK_PROBES[i].format(said=said)
    if target and attempts >= config.HINT_AFTER_ATTEMPTS:
        label = target.get("student_label") or "the part you have not covered yet"
        msg = f"Look again at the prompt and focus on this: {label.lower()}. " + msg
    return msg


def _violates_gate(text: str, forbidden: list[str]) -> bool:
    low = text.lower()
    return any(f and f.lower() in low for f in forbidden)


def tutor_reply(outcome: dict, turns: list[dict], judgement: dict, attempts_on_target: int) -> dict:
    met_ids = {c["id"] for c in judgement["criteria"] if c["met"]}
    unmet = [c for c in outcome["criteria"] if c["id"] not in met_ids]
    target = unmet[0] if unmet else None
    forbidden = [t for c in unmet for t in c.get("answer_terms", [])]
    hint_on = attempts_on_target >= config.HINT_AFTER_ATTEMPTS
    system = prompts.TUTOR_SYSTEM.format(
        forbidden=", ".join(f'"{f}"' for f in forbidden) or "(none)",
        hint_rule=prompts.TUTOR_HINT_RULE_ON if hint_on else prompts.TUTOR_HINT_RULE_OFF,
        met="; ".join(c["text"] for c in outcome["criteria"] if c["id"] in met_ids) or "(none yet)",
        target=target["text"] if target else "(all met)",
        attempts=attempts_on_target,
        misconceptions="; ".join(judgement.get("misconceptions", [])) or "(none)",
    )
    user = prompts.TUTOR_USER.format(
        title=outcome["title"], prompt=outcome["prompt"], transcript=_transcript(turns)
    )
    gated = False
    text = llm.complete_text(
        system, user, temperature=0.7, mock=lambda: _mock_tutor(outcome, turns, target, attempts_on_target)
    )
    if _violates_gate(text, forbidden):
        gated = True
        text = llm.complete_text(
            system + "\n\nYour previous draft used a forbidden phrase. Rewrite it with a question only, no explanation.",
            user,
            temperature=0.5,
            mock=lambda: "Let's take a smaller step. In your own words, what is the single most important thing happening here?",
        )
        if _violates_gate(text, forbidden):
            text = "Let's take a smaller step. In your own words, what is the single most important thing happening here?"
    return {"text": text.strip(), "target_id": target["id"] if target else None, "hint": hint_on and not gated, "gated": gated}


def mastered_message(outcome: dict, judgement: dict) -> str:
    ev = "\n".join(
        f"- {c['text']}: \"{j['evidence']}\""
        for c, j in zip(outcome["criteria"], judgement["criteria"])
        if j["met"]
    )
    return llm.complete_text(
        prompts.MASTERED_SYSTEM,
        prompts.MASTERED_USER.format(title=outcome["title"], evidence_block=ev),
        temperature=0.5,
        mock="You covered every part of this one in your own words, including the example you gave. Marked as understood.",
    )


# --------------------------------------------------------------------------
# 4. Session / attempt orchestration
# --------------------------------------------------------------------------
def start_attempt(session_id: str, outcome_id: str, confidence_before: int, kind: str = "practice") -> dict:
    s = get_store()
    sess = s.get("sessions", session_id)
    outcome = s.get("outcomes", outcome_id)
    if not sess or not outcome:
        raise KeyError("session/outcome not found")
    private = outcome.get("session_id") == session_id
    if not private and (outcome.get("week_id") is None or outcome.get("week_id") != sess.get("week_id")):
        raise KeyError("session/outcome not found")
    if not outcome.get("criteria"):
        raise ValueError("outcome has no criteria")
    existing = [a for a in s.list("attempts", session_id=session_id, outcome_id=outcome_id)]
    if kind == "recall":
        existing = [a for a in existing if a.get("kind") == "recall" and a.get("status") == "in_progress"]
    if existing:
        a = existing[-1]
        if a.get("confidence_before") is None and confidence_before:
            a = s.update("attempts", a["id"], {"confidence_before": confidence_before}) or a
        return a
    a = s.insert(
        "attempts",
        {
            "session_id": session_id,
            "outcome_id": outcome_id,
            "confidence_before": confidence_before or None,
            "status": "in_progress",
            "student_turns": 0,
            "target_attempts": 0,
            "target_id": None,
            "met_ids": [],
            "misconceptions": [],
            "kind": kind,
        },
    )
    opener = prompts.TUTOR_OPENER if kind != "recall" else "Quick recall: a few days on, explain this again in two or three sentences, without looking anything up."
    s.insert("turns", {"attempt_id": a["id"], "role": "tutor", "content": opener, "judge": None})
    return a


def student_message(attempt_id: str, content: str) -> dict:
    s = get_store()
    attempt = s.get("attempts", attempt_id)
    if not attempt:
        raise KeyError("attempt not found")
    outcome = s.get("outcomes", attempt["outcome_id"])
    if not outcome or not outcome.get("criteria"):
        raise KeyError("outcome not found")
    content = content.strip()[:2000]
    s.insert("turns", {"attempt_id": attempt_id, "role": "student", "content": content, "judge": None})
    turns = sorted(s.list("turns", attempt_id=attempt_id), key=lambda t: t["created_at"])
    revealed_text = attempt.get("revealed_text") or ""
    if revealed_text:
        # after a reveal, only what the student writes AFTER seeing the answer counts, and copied sentences are stripped
        cut = attempt.get("revealed_at") or ""
        turns = [t for t in turns if t.get("created_at", "") > cut and not (t.get("meta") or {}).get("reveal")]

    j = judge(outcome, turns, [revealed_text] if revealed_text else None)
    # Ticks never go grey again: once the student has shown a point, it stays shown.
    prev_met = set(attempt.get("met_ids") or [])
    for c in j["criteria"]:
        if c["id"] in prev_met and not c["met"]:
            c["met"] = True
    met_ids = [c["id"] for c in j["criteria"] if c["met"]]
    all_met = len(met_ids) == len(outcome["criteria"])
    student_turns = attempt.get("student_turns", 0) + 1

    # how many times has the student tried the current target?
    first_unmet = next((c["id"] for c in outcome["criteria"] if c["id"] not in met_ids), None)
    target_attempts = attempt.get("target_attempts", 0) + 1 if first_unmet == attempt.get("target_id") else 1

    misconceptions = list(dict.fromkeys((attempt.get("misconceptions") or []) + j["misconceptions"]))[:8]
    patch: dict[str, Any] = {
        "student_turns": student_turns,
        "met_ids": met_ids,
        "misconceptions": misconceptions,
        "target_id": first_unmet,
        "target_attempts": target_attempts,
        "last_judge": {"criteria": j["criteria"], "summary": j["summary"], "votes": j["votes"]},
    }

    if all_met and revealed_text:
        # explained back after seeing the answer: good, but not the same as understood unaided
        patch.update({"status": "seen", "mastered_at": now_iso()})
        tutor = {
            "text": f"You've put it in your own words now. This one is marked 'seen the answer' rather than 'understood', and it will come back in {config.RECALL_AFTER_DAYS} days to check it stuck.",
            "target_id": None, "hint": False, "gated": False,
        }
    elif all_met:
        reply = mastered_message(outcome, j)
        patch.update({"status": "mastered", "mastered_at": now_iso()})
        tutor = {"text": reply, "target_id": None, "hint": False, "gated": False}
    elif student_turns >= config.MAX_TURNS_PER_OUTCOME and not revealed_text:
        tutor = {
            "text": "Let's park this one for now and come back to it later. You can mark it 'skip' and move on; your attempt is saved.",
            "target_id": first_unmet,
            "hint": False,
            "gated": False,
        }
        patch.update({"status": "parked"})
    else:
        tutor = tutor_reply(outcome, turns, j, target_attempts)

    s.update("attempts", attempt_id, patch)
    t = s.insert(
        "turns",
        {
            "attempt_id": attempt_id,
            "role": "tutor",
            "content": tutor["text"],
            "judge": {"criteria": j["criteria"], "misconceptions": j["misconceptions"], "gave_up": j["gave_up"]},
            "meta": {"hint": tutor["hint"], "gated": tutor["gated"], "target_id": tutor["target_id"]},
        },
    )
    status = patch.get("status", "in_progress")
    return {
        "tutor": t,
        "criteria": j["criteria"],
        "status": status,
        "hint": tutor["hint"],
        "student_turns": student_turns,
        "can_reveal": status == "in_progress" and not revealed_text and student_turns >= config.REVEAL_AFTER_TURNS,
    }


def reveal_answer(attempt_id: str) -> dict:
    """The student is stuck and asks to see it. Show a full explanation, then require them to say it back."""
    s = get_store()
    attempt = s.get("attempts", attempt_id)
    if not attempt:
        raise KeyError("attempt not found")
    if attempt.get("revealed_text"):
        return {"text": attempt["revealed_text"]}
    if (attempt.get("student_turns") or 0) < config.REVEAL_AFTER_TURNS:
        raise ValueError(f"Try at least {config.REVEAL_AFTER_TURNS} times first. The trying is what makes the answer stick.")
    outcome = s.get("outcomes", attempt["outcome_id"])
    turns = sorted(s.list("turns", attempt_id=attempt_id), key=lambda t: t["created_at"])
    student = "\n".join(t["content"] for t in turns if t["role"] == "student")[-3000:]
    crit = "\n".join(f"- {c['text']}" for c in outcome["criteria"])
    text = llm.complete_text(
        prompts.REVEAL_SYSTEM.format(criteria=crit),
        prompts.REVEAL_USER.format(title=outcome["title"], prompt=outcome["prompt"], student=student or "(nothing yet)"),
        temperature=0.4,
        mock=lambda: " ".join(c["text"].rstrip(".") + "." for c in outcome["criteria"]) + "\nNow close this and explain it back in your own words.",
    ).strip()
    now = now_iso()
    s.insert("turns", {"attempt_id": attempt_id, "role": "tutor", "content": text, "judge": None, "meta": {"reveal": True}, "created_at": now})
    s.update("attempts", attempt_id, {"revealed_text": text, "revealed_at": now, "met_ids": []})
    return {"text": text}


def skip_attempt(attempt_id: str) -> dict | None:
    return get_store().update("attempts", attempt_id, {"status": "skipped"})


# --------------------------------------------------------------------------
# 5. Lecturer gap report
# --------------------------------------------------------------------------
def week_report(week_id: str) -> dict:
    s = get_store()
    week = s.get("weeks", week_id)
    outcomes = sorted(s.list("outcomes", week_id=week_id), key=lambda o: o.get("position", 0))
    sessions = s.list("sessions", week_id=week_id)
    session_ids = [x["id"] for x in sessions]
    attempts = s.list("attempts", session_id=session_ids) if session_ids else []
    attempt_ids = [a["id"] for a in attempts]
    turns = s.list("turns", attempt_id=attempt_ids) if attempt_ids else []
    turns_by_attempt: dict[str, list[dict]] = defaultdict(list)
    for t in turns:
        turns_by_attempt[t["attempt_id"]].append(t)

    n_students = len({a["session_id"] for a in attempts})
    quotes_ok = n_students >= config.MIN_STUDENTS_FOR_QUOTES
    K_ANON = 3  # a quote set is shown only if at least this many distinct sessions failed the point

    rows = []
    total_mastered = 0
    for o in outcomes:
        atts = [a for a in attempts if a["outcome_id"] == o["id"]]
        n = len(atts)
        mastered = [a for a in atts if a.get("status") == "mastered"]
        total_mastered += len(mastered)
        crit_rows = []
        for c in o["criteria"]:
            met_n = sum(1 for a in atts if c["id"] in (a.get("met_ids") or []))
            # anonymised quotes of attempts where this criterion was NOT met: the student's last message
            quotes = []
            if quotes_ok:
                failing_sessions = set()
                for a in atts:
                    if c["id"] in (a.get("met_ids") or []):
                        continue
                    st = [t for t in turns_by_attempt[a["id"]] if t["role"] == "student"]
                    if st:
                        failing_sessions.add(a["session_id"])
                        q = st[-1]["content"][:220]
                        if q not in quotes:
                            quotes.append(q)
                if len(failing_sessions) < K_ANON:
                    quotes = []
            crit_rows.append(
                {
                    "id": c["id"],
                    "text": c["text"],
                    "met": met_n,
                    "met_pct": round(100 * met_n / n) if n else None,
                    "quotes": quotes[:4],
                }
            )
        misc = Counter()
        for a in atts:
            for m in a.get("misconceptions") or []:
                misc[m] += 1
        conf_mastered = [a["confidence_before"] for a in mastered if a.get("confidence_before")]
        conf_not = [a["confidence_before"] for a in atts if a.get("status") != "mastered" and a.get("confidence_before")]
        hardest = min(crit_rows, key=lambda c: (c["met_pct"] if c["met_pct"] is not None else 101)) if crit_rows and n else None
        rows.append(
            {
                "outcome": o,
                "attempted": n,
                "mastered": len(mastered),
                "mastered_pct": round(100 * len(mastered) / n) if n else None,
                "gap_pct": (100 - round(100 * len(mastered) / n)) if n else None,
                "median_turns": _median([a.get("student_turns", 0) for a in atts]) if atts else None,
                "criteria": crit_rows,
                "hardest_criterion": hardest,
                "misconceptions": [{"text": m, "n": k} for m, k in misc.most_common(5)],
                "avg_conf_mastered": round(sum(conf_mastered) / len(conf_mastered), 1) if conf_mastered else None,
                "avg_conf_not_mastered": round(sum(conf_not) / len(conf_not), 1) if conf_not else None,
                # "felt vs shown": students who rated themselves >=4 but did not master
                "revealed_n": sum(1 for a in atts if a.get("revealed_text")),
                "overconfident_n": sum(
                    1
                    for a in atts
                    if (a.get("confidence_before") or 0) >= 4
                    and a.get("status") != "mastered"
                    and (a.get("student_turns") or 0) >= 1
                ),
            }
        )
    rows.sort(key=lambda r: (-(r["gap_pct"] if r["gap_pct"] is not None else -1), r["outcome"].get("position", 0)))
    secure = [r for r in rows if r["attempted"] and (r["mastered_pct"] or 0) >= 80]
    return {
        "week": week,
        "n_students": n_students,
        "n_attempts": len(attempts),
        "n_mastered": total_mastered,
        "quotes_ok": quotes_ok,
        "min_students_for_quotes": config.MIN_STUDENTS_FOR_QUOTES,
        "k_anon": K_ANON,
        "outcomes_secure": len(secure),
        "outcomes_total": len(outcomes),
        "rows": rows,
        "overconfident_total": sum(r["overconfident_n"] for r in rows),
    }


def _median(xs: list[int]) -> float | None:
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    m = len(xs) // 2
    return xs[m] if len(xs) % 2 else (xs[m - 1] + xs[m]) / 2


def reteach(week_id: str, outcome_id: str) -> str:
    rep = week_report(week_id)
    row = next((r for r in rep["rows"] if r["outcome"]["id"] == outcome_id), None)
    if not row:
        raise KeyError("outcome not in report")
    hc = row["hardest_criterion"] or {"text": "(none)", "met_pct": 0, "quotes": []}
    quotes = "\n".join(f"- \"{q}\"" for q in hc.get("quotes", [])) or "(quotes hidden: fewer than the minimum number of students)"
    return llm.complete_text(
        prompts.RETEACH_SYSTEM,
        prompts.RETEACH_USER.format(
            title=row["outcome"]["title"],
            criterion=hc["text"],
            met_pct=hc.get("met_pct") or 0,
            misconceptions="; ".join(m["text"] for m in row["misconceptions"]) or "(none recorded)",
            quotes=quotes,
        ),
        temperature=0.5,
        mock=(
            "**Why they are stuck**\nMost attempts describe the idea in general terms but never connect it to the "
            f"criterion \"{hc['text']}\".\n\n**Five-minute re-teach**\n- Start from one of the students' own sentences and ask the room what is missing.\n"
            "- Show a tiny worked example and a counter-example side by side.\n- Ask them to re-state the rule in one sentence.\n\n"
            "**Check question**\nGive a new example and ask which side of the contrast it falls on, and why."
        ),
    )


# --------------------------------------------------------------------------
# 6. Learn mode: student materials, explaining chat, own cards, coursework viva
# --------------------------------------------------------------------------
def _session_material(session: dict) -> str:
    """Lecturer material excerpt for the week + everything the student added, capped."""
    s = get_store()
    parts = []
    week = s.get("weeks", session["week_id"]) if session.get("week_id") else None
    if week and week.get("material_excerpt"):
        parts.append(f"[Lecturer's material for {week['title']}]\n{week['material_excerpt']}")
    for m in s.list("materials", session_id=session["id"]):
        parts.append(f"[{m['title']}]\n{m['text']}")
    text = "\n\n".join(parts)
    return text[-config.MAX_MATERIAL_CHARS:]


def add_material(session_id: str, title: str, text: str) -> dict:
    s = get_store()
    text = text.strip()[: config.MAX_MATERIAL_CHARS]
    return s.insert("materials", {"session_id": session_id, "title": title.strip()[:120] or "Untitled", "text": text, "chars": len(text)})


def learn_message(session_id: str, content: str) -> dict:
    s = get_store()
    session = s.get("sessions", session_id)
    if not session:
        raise KeyError("session not found")
    chats = s.list("chats", session_id=session_id)
    chat = chats[-1] if chats else s.insert("chats", {"session_id": session_id, "messages": []})
    msgs = list(chat.get("messages") or [])
    msgs.append({"role": "student", "content": content.strip()[:4000]})
    transcript = "\n".join(("STUDENT: " if m["role"] == "student" else "TUTOR: ") + m["content"] for m in msgs[-16:])
    material = _session_material(session) or "(no material added yet)"
    last = content.strip()

    def mock():
        kw = sorted(_keywords(last))[:2]
        topic = " ".join(kw) or "this"
        return (
            f"Here is the short version of {topic}: it is the idea that the course keeps coming back to, and the way to hold it "
            f"is to connect it to one concrete case. In the material it appears around slide 3. Now: in one sentence, what would change about {topic} if the input were ten times bigger?"
        )

    reply = llm.complete_text(
        prompts.LEARN_SYSTEM.format(material=material),
        prompts.LEARN_USER.format(transcript=transcript),
        temperature=0.6,
        mock=mock,
    )
    msgs.append({"role": "tutor", "content": reply})
    s.update("chats", chat["id"], {"messages": msgs[-60:]})
    return {"reply": reply, "n": len(msgs)}


def _outcomes_from_json(data: dict, *, limit: int) -> list[dict]:
    outs = []
    for o in (data.get("outcomes") or [])[:limit]:
        crits = []
        for c in (o.get("criteria") or [])[:4]:
            terms = [str(t).strip() for t in c.get("answer_terms", []) if str(t).strip()][:3]
            text = str(c.get("text", "")).strip()
            if not text:
                continue
            crits.append(
                {
                    "id": new_id()[:8],
                    "text": text[:300],
                    "student_label": safe_student_label(str(c.get("student_label", "")).strip(), terms, len(crits) + 1),
                    "answer_terms": terms,
                }
            )
        if not crits:
            continue
        outs.append(
            {
                "title": str(o.get("title", "Untitled")).strip()[:80],
                "prompt": str(o.get("prompt", "")).strip()[:500],
                "slide_ref": str(o.get("slide_ref", "")).strip()[:40],
                "criteria": crits,
                "common_misconceptions": [str(m) for m in (o.get("common_misconceptions") or [])][:3],
            }
        )
    return outs


def make_cards(session_id: str, focus: str = "") -> list[dict]:
    """Draft private outcomes ("my cards") from the student's own material."""
    s = get_store()
    session = s.get("sessions", session_id)
    if not session:
        raise KeyError("session not found")
    mats = s.list("materials", session_id=session_id)
    if not mats:
        raise ValueError("Add some material first (slides, a chapter, your notes).")
    material = "\n\n".join(f"[{m['title']}]\n{m['text']}" for m in mats)[-config.MAX_MATERIAL_CHARS:]

    def mock():
        d = draft_outcomes("My material", material)
        return {"outcomes": d["outcomes"][:4]}

    data = llm.complete_json(
        prompts.MAKE_CARDS_SYSTEM, prompts.MAKE_CARDS_USER.format(focus=focus or "(none)", material=material), temperature=0.4, mock=mock
    )
    outs = _outcomes_from_json(data if isinstance(data, dict) else {"outcomes": data}, limit=6)
    existing = s.list("outcomes", session_id=session_id)
    rows = []
    for i, o in enumerate(outs):
        rows.append(s.insert("outcomes", {**o, "week_id": None, "session_id": session_id, "kind": "mine", "position": 1000 + len(existing) + i}))
    return rows


def make_viva(session_id: str, work: str) -> list[dict]:
    s = get_store()
    session = s.get("sessions", session_id)
    if not session:
        raise KeyError("session not found")
    work = work.strip()[:40000]
    if len(work) < 200:
        raise ValueError("Paste the actual piece of work (at least a few paragraphs or 30 lines of code).")

    def mock():
        lines = [l for l in work.splitlines() if l.strip()]
        picks = lines[: 3]
        return {
            "outcomes": [
                {
                    "title": f"Part {i + 1} of your work",
                    "prompt": f"In your submission you wrote \"{l.strip()[:60]}\". Explain why you did it this way and what would break if you changed it.",
                    "slide_ref": f"line {i + 1}",
                    "criteria": [
                        {"text": "Explains the reason for this choice in their own words", "student_label": "Gives the reason behind the choice", "answer_terms": []},
                        {"text": "Says what would go wrong if it were changed or removed", "student_label": "Says what would break without it", "answer_terms": []},
                    ],
                    "common_misconceptions": [],
                }
                for i, l in enumerate(picks)
            ]
        }

    data = llm.complete_json(prompts.VIVA_SYSTEM, prompts.VIVA_USER.format(work=work), temperature=0.4, mock=mock)
    outs = _outcomes_from_json(data if isinstance(data, dict) else {"outcomes": data}, limit=4)
    s.insert("materials", {"session_id": session_id, "title": "My coursework (viva)", "text": work, "chars": len(work), "kind": "viva"})
    rows = []
    for i, o in enumerate(outs):
        rows.append(s.insert("outcomes", {**o, "week_id": None, "session_id": session_id, "kind": "viva", "position": 2000 + i}))
    return rows


# --------------------------------------------------------------------------
# 7. Class wall: students' own explanations, voted
# --------------------------------------------------------------------------
def wall_for_outcome(outcome_id: str, student_id: str | None) -> list[dict]:
    s = get_store()
    posts = s.list("posts", outcome_id=outcome_id)
    if not posts:
        return []
    votes = s.list("votes", post_id=[p["id"] for p in posts])
    by_post: dict[str, list[dict]] = defaultdict(list)
    for v in votes:
        by_post[v["post_id"]].append(v)
    out = []
    for p in posts:
        vs = by_post.get(p["id"], [])
        score = sum(int(v.get("value", 0)) for v in vs)
        mine = next((int(v.get("value", 0)) for v in vs if student_id and v.get("student_id") == student_id), 0)
        out.append(
            {
                "id": p["id"],
                "content": p["content"],
                "alias": p.get("alias") or "a student",
                "verified": bool(p.get("verified")),
                "score": score,
                "up": sum(1 for v in vs if int(v.get("value", 0)) > 0),
                "down": sum(1 for v in vs if int(v.get("value", 0)) < 0),
                "my_vote": mine,
                "is_mine": bool(student_id and p.get("student_id") == student_id),
                "created_at": p.get("created_at"),
            }
        )
    out.sort(key=lambda x: (-x["score"], -x["verified"], x["created_at"] or ""))
    return out


def post_explanation(session_id: str, outcome_id: str, content: str, student_id: str | None) -> dict:
    s = get_store()
    session = s.get("sessions", session_id)
    outcome = s.get("outcomes", outcome_id)
    if not session or not outcome:
        raise KeyError("not found")
    content = content.strip()[:1200]
    if len(content) < 20:
        raise ValueError("Write at least a sentence.")
    att = s.list("attempts", session_id=session_id, outcome_id=outcome_id)
    verified = any(a.get("status") == "mastered" for a in att)
    return s.insert(
        "posts",
        {
            "session_id": session_id,
            "student_id": student_id,
            "week_id": outcome.get("week_id"),
            "outcome_id": outcome_id,
            "alias": session.get("alias") or "a student",
            "content": content,
            "verified": verified,
        },
    )


def vote_post(post_id: str, student_id: str, value: int) -> dict:
    s = get_store()
    if not (s.get("posts", post_id) or s.get("threads", post_id) or s.get("replies", post_id)):
        raise KeyError("post not found")
    value = 1 if value > 0 else (-1 if value < 0 else 0)
    existing = [v for v in s.list("votes", post_id=post_id) if v.get("student_id") == student_id]
    if existing:
        return s.update("votes", existing[0]["id"], {"value": value}) or existing[0]
    return s.insert("votes", {"post_id": post_id, "student_id": student_id, "value": value})


def wall_summary_for_week(week_id: str) -> dict[str, list[dict]]:
    """Top explanations per outcome, for the lecturer report."""
    s = get_store()
    outcomes = s.list("outcomes", week_id=week_id)
    out = {}
    for o in outcomes:
        top = wall_for_outcome(o["id"], None)[:2]
        if top:
            out[o["id"]] = top
    return out


# --------------------------------------------------------------------------
# 8. Student profile across weeks: calibration + spaced recall
# --------------------------------------------------------------------------
def student_profile(student_id: str) -> dict:
    from datetime import datetime, timedelta, timezone

    s = get_store()
    sessions = [x for x in s.list("sessions") if x.get("student_id") == student_id]
    if not sessions:
        return {"sessions": 0, "weeks": [], "due": [], "overconfident": [], "calibration": None}
    sid = [x["id"] for x in sessions]
    attempts = s.list("attempts", session_id=sid)
    weeks = {w["id"]: w for w in s.list("weeks")}
    courses = {c["id"]: c for c in s.list("courses")}
    outcomes = {o["id"]: o for o in s.list("outcomes", id=[a["outcome_id"] for a in attempts])} if attempts else {}
    by_week: dict[str, dict] = {}
    due, over = [], []
    now = datetime.now(timezone.utc)
    # calibration bins: confidence -> (n, mastered)
    bins = {k: [0, 0] for k in range(1, 6)}
    for a in attempts:
        o = outcomes.get(a["outcome_id"])
        if not o or (a.get("student_turns") or 0) < 1:
            continue
        w = weeks.get(o.get("week_id") or "", {"id": "mine", "title": "My own cards", "number": None, "course_id": None})
        row = by_week.setdefault(w["id"], {"week": w, "course": courses.get(w.get("course_id") or "", {}), "attempted": 0, "mastered": 0, "overconfident": 0})
        row["attempted"] += 1
        c = a.get("confidence_before") or 0
        mastered = a.get("status") == "mastered"
        if c in bins:
            bins[c][0] += 1
            bins[c][1] += int(mastered)
        if mastered or a.get("status") == "seen":
            row["mastered"] += int(mastered)
            ma = a.get("mastered_at")
            if ma:
                try:
                    t = datetime.fromisoformat(ma.replace("Z", "+00:00"))
                except ValueError:
                    t = now
                if now - t >= timedelta(days=config.RECALL_AFTER_DAYS) and a.get("kind") != "recall":
                    later = [b for b in attempts if b["outcome_id"] == a["outcome_id"] and b.get("kind") == "recall" and b.get("created_at", "") > ma]
                    if not later:
                        due.append({"outcome": o, "week": w, "days": (now - t).days, "session_id": a["session_id"]})
        if not mastered and c >= 4:
            row["overconfident"] += 1
            over.append({"outcome": o, "week": w, "confidence": c, "session_id": a["session_id"]})
    calib = [{"confidence": k, "n": v[0], "shown_pct": (round(100 * v[1] / v[0]) if v[0] else None)} for k, v in bins.items()]
    total = sum(v[0] for v in bins.values())
    gap = None
    if total:
        felt = sum(k * v[0] for k, v in bins.items()) / total  # 1..5
        shown = sum(v[1] for v in bins.values()) / total  # 0..1
        gap = round((felt - 1) / 4 - shown, 2)  # positive = overconfident
    return {
        "sessions": len(sessions),
        "weeks": sorted(by_week.values(), key=lambda r: (r["week"].get("number") or 99)),
        "due": due[:10],
        "overconfident": over[:10],
        "calibration": calib,
        "gap": gap,
        "total": total,
    }


# --------------------------------------------------------------------------
# 9. Q&A forum (Ed-style): questions per week, replies, lecturer answers, votes
# --------------------------------------------------------------------------
def _score(votes: list[dict], student_id: str | None):
    return sum(int(v.get("value", 0)) for v in votes), next((int(v.get("value", 0)) for v in votes if student_id and v.get("student_id") == student_id), 0)


def forum_list(week_id: str, student_id: str | None) -> list[dict]:
    s = get_store()
    threads = s.list("threads", week_id=week_id)
    if not threads:
        return []
    tids = [t["id"] for t in threads]
    replies = s.list("replies", thread_id=tids)
    votes = s.list("votes", post_id=tids)
    by_t: dict[str, list[dict]] = defaultdict(list)
    for v in votes:
        by_t[v["post_id"]].append(v)
    nrep = Counter(r["thread_id"] for r in replies)
    lect = {r["thread_id"] for r in replies if r.get("role") == "lecturer"}
    out = []
    for t in threads:
        score, mine = _score(by_t.get(t["id"], []), student_id)
        out.append({**t, "score": score, "my_vote": mine, "n_replies": nrep.get(t["id"], 0), "lecturer_replied": t["id"] in lect})
    out.sort(key=lambda x: (not x.get("pinned"), x.get("answered") or False, -x["score"], x.get("created_at") or ""), reverse=False)
    return out


def forum_thread(thread_id: str, student_id: str | None) -> dict | None:
    s = get_store()
    t = s.get("threads", thread_id)
    if not t:
        return None
    replies = s.list("replies", thread_id=thread_id)
    ids = [thread_id] + [r["id"] for r in replies]
    votes = s.list("votes", post_id=ids)
    by: dict[str, list[dict]] = defaultdict(list)
    for v in votes:
        by[v["post_id"]].append(v)
    score, mine = _score(by.get(thread_id, []), student_id)
    reps = []
    for r in replies:
        sc, mv = _score(by.get(r["id"], []), student_id)
        reps.append({**r, "score": sc, "my_vote": mv})
    reps.sort(key=lambda r: (not r.get("accepted"), r.get("role") != "lecturer", -r["score"], r.get("created_at") or ""))
    return {**t, "score": score, "my_vote": mine, "replies": reps}


def forum_ask(week_id: str, student_id: str | None, alias: str, title: str, body: str, role: str = "student") -> dict:
    s = get_store()
    if not s.get("weeks", week_id):
        raise KeyError("week not found")
    title = title.strip()[:160]
    if len(title) < 5:
        raise ValueError("Give the question a title.")
    return s.insert("threads", {"week_id": week_id, "student_id": student_id, "alias": alias or "a student", "role": role,
                                "title": title, "body": body.strip()[:4000], "answered": False, "pinned": False, "ai_draft": None, "ai_confirmed": False})


def forum_reply(thread_id: str, student_id: str | None, alias: str, body: str, role: str = "student") -> dict:
    s = get_store()
    if not s.get("threads", thread_id):
        raise KeyError("thread not found")
    body = body.strip()[:4000]
    if len(body) < 2:
        raise ValueError("Write something.")
    return s.insert("replies", {"thread_id": thread_id, "student_id": student_id, "alias": alias or ("Lecturer" if role == "lecturer" else "a student"),
                                "role": role, "body": body, "accepted": False})


def forum_ai_draft(thread_id: str) -> str:
    s = get_store()
    t = s.get("threads", thread_id)
    if not t:
        raise KeyError("thread not found")
    if t.get("ai_draft"):
        return t["ai_draft"]
    week = s.get("weeks", t["week_id"]) or {}
    material = week.get("material_excerpt") or "(no material)"
    draft = llm.complete_text(
        prompts.FORUM_SYSTEM.format(material=material),
        prompts.FORUM_USER.format(title=t["title"], body=t.get("body") or ""),
        temperature=0.4,
        mock=f"First take: the short answer to \"{t['title']}\" is in the week's material around slide 3; the key idea is to connect it to one concrete case. Check yourself: can you say in one sentence why it holds?",
    )
    s.update("threads", thread_id, {"ai_draft": draft})
    return draft


def forum_set(thread_id: str, patch: dict) -> dict | None:
    allowed = {k: v for k, v in patch.items() if k in ("answered", "pinned", "ai_confirmed")}
    return get_store().update("threads", thread_id, allowed)


def forum_accept(reply_id: str) -> None:
    s = get_store()
    r = s.get("replies", reply_id)
    if not r:
        raise KeyError("reply not found")
    for other in s.list("replies", thread_id=r["thread_id"]):
        if other.get("accepted"):
            s.update("replies", other["id"], {"accepted": False})
    s.update("replies", reply_id, {"accepted": True})
    s.update("threads", r["thread_id"], {"answered": True})


def forum_open_count(week_id: str) -> int:
    return sum(1 for t in get_store().list("threads", week_id=week_id) if not t.get("answered"))
