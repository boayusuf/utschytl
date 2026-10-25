"""Flask application: HTML pages + a small JSON API used by the front-end."""
from __future__ import annotations

import io
import os
import re
import threading
import time
from collections import defaultdict, deque
from functools import wraps

from flask import (
    Flask,
    abort,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)

from . import config, llm, logic
from .store import get_store, new_id

app = Flask(
    __name__,
    template_folder=str(config.ROOT / "templates"),
    static_folder=str(config.ROOT / "public" / "static"),
    static_url_path="/static",
)
app.secret_key = config.SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024  # Vercel's request limit is 4.5 MB
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = bool(os.environ.get("VERCEL") or os.environ.get("FORCE_SECURE_COOKIES"))


# --------------------------------------------------------------------------
# error handling: never show a stack trace, always say what to do
# --------------------------------------------------------------------------
def _wants_json() -> bool:
    return request.path.startswith("/api/")


@app.errorhandler(404)
def _404(e):
    if _wants_json():
        return jsonify({"error": "not_found"}), 404
    return render_template("error.html", title="Not found", message="That page or session does not exist. It may have been deleted, or the link was copied incompletely."), 404


@app.errorhandler(413)
def _413(e):
    msg = "That file is larger than 4 MB. Export the slides as a smaller PDF (most tools have a 'reduce file size' option) or paste the notes as text."
    if _wants_json():
        return jsonify({"error": "too_large", "detail": msg}), 413
    return render_template("error.html", title="File too large", message=msg), 413


@app.errorhandler(429)
def _429(e):
    return jsonify({"error": "rate_limited", "detail": "Too many messages in a short time. Wait a moment and try again."}), 429


@app.errorhandler(llm.LLMError)
def _llm_error(e):
    msg = f"The AI service did not respond properly: {str(e)[:200]}"
    if _wants_json():
        return jsonify({"error": "llm", "detail": msg}), 502
    return render_template("error.html", title="AI service problem", message=msg), 502


@app.errorhandler(RuntimeError)
def _runtime_error(e):
    msg = f"The database did not respond properly: {str(e)[:200]}"
    if _wants_json():
        return jsonify({"error": "store", "detail": msg}), 502
    return render_template("error.html", title="Storage problem", message=msg), 502


# Tiny per-IP rate limit for the AI endpoints (per instance; enough to stop casual abuse of a demo key).
_hits: dict[tuple, deque] = defaultdict(deque)
_hits_lock = threading.Lock()


def rate_limited(max_per_minute: int):
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            ip = request.headers.get("x-forwarded-for", request.remote_addr or "?").split(",")[0].strip()
            now = time.time()
            with _hits_lock:
                q = _hits[(ip, fn.__name__)]
                while q and q[0] < now - 60:
                    q.popleft()
                if len(q) >= max_per_minute:
                    abort(429)
                q.append(now)
            return fn(*a, **kw)

        return wrapper

    return deco


@app.context_processor
def inject_globals():
    return {
        "APP_NAME": config.APP_NAME,
        "APP_TAGLINE": config.APP_TAGLINE,
        "LLM_LABEL": llm.provider_label(),
        "STORE_LABEL": config.STORE_BACKEND,
        "HIDE_TECH": bool(os.environ.get("HIDE_TECH_FOOTER")),
    }


# --------------------------------------------------------------------------
# student identity: an anonymous, per-browser id so profiles and recall work across weeks
# --------------------------------------------------------------------------
@app.before_request
def _student_identity():
    sid = request.cookies.get("tb_student")
    g.student_id = sid if sid and re.fullmatch(r"[0-9a-f\-]{36}", sid) else None
    g.set_student_cookie = g.student_id is None
    if g.student_id is None:
        g.student_id = new_id()


@app.after_request
def _set_student_cookie(resp):
    if getattr(g, "set_student_cookie", False):
        resp.set_cookie("tb_student", g.student_id, max_age=60 * 60 * 24 * 365, samesite="Lax", httponly=True,
                        secure=app.config["SESSION_COOKIE_SECURE"])
    return resp


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def lecturer_required(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        if not session.get("lecturer"):
            if _wants_json():
                return jsonify({"error": "lecturer_login_required"}), 401
            return redirect(url_for("teach_login", next=request.path))
        return fn(*a, **kw)

    return wrapper


def _extract_pdf_text(data: bytes) -> str:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        pages = []
        _ = len(reader.pages)
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"Could not read that PDF ({type(e).__name__}). Try re-exporting it, or paste the notes as text.") from e
    for i, p in enumerate(reader.pages[:80]):
        try:
            txt = p.extract_text() or ""
        except Exception:  # noqa: BLE001
            txt = ""
        if txt.strip():
            pages.append(f"[slide {i + 1}]\n{txt.strip()}")
    return "\n\n".join(pages)


def _published_weeks():
    s = get_store()
    weeks = [w for w in s.list("weeks") if w.get("status") == "published"]
    courses = {c["id"]: c for c in s.list("courses")}
    for w in weeks:
        w["course"] = courses.get(w["course_id"], {})
    return weeks


# --------------------------------------------------------------------------
# public pages
# --------------------------------------------------------------------------
@app.get("/")
def home():
    return render_template("home.html", weeks=_published_weeks())


@app.get("/about")
def about():
    return render_template("about.html")


@app.get("/health")
def health():
    return jsonify({"ok": True, "llm": config.LLM_PROVIDER, "store": config.STORE_BACKEND})


# --------------------------------------------------------------------------
# student
# --------------------------------------------------------------------------
@app.get("/learn")
def learn():
    return render_template("learn.html", weeks=_published_weeks())


@app.post("/learn/start")
def learn_start():
    s = get_store()
    week_id = request.form.get("week_id", "")
    alias = re.sub(r"[^\w\- ]", "", request.form.get("alias", "")).strip()[:24] or "anonymous"
    week = s.get("weeks", week_id)
    if not week or week.get("status") != "published":
        abort(404)
    sess = s.insert("sessions", {"week_id": week_id, "alias": alias, "student_id": g.student_id})
    return redirect(url_for("practice", session_id=sess["id"]))


@app.get("/learn/s/<session_id>")
def practice(session_id):
    s = get_store()
    sess = s.get("sessions", session_id)
    if not sess:
        abort(404)
    week = s.get("weeks", sess["week_id"]) if sess.get("week_id") else None
    course = s.get("courses", week["course_id"]) if week else {}
    if not week:
        week = {"id": None, "title": "Defend your own work", "number": None}
        course = {"title": "My coursework"}
    open_q = logic.forum_open_count(week["id"]) if week.get("id") else 0
    return render_template("practice.html", session=sess, week=week, course=course, preselect=request.args.get("outcome"),
                           recall=request.args.get("recall") == "1", open_q=open_q)


@app.get("/api/session/<session_id>")
def api_session(session_id):
    s = get_store()
    sess = s.get("sessions", session_id)
    if not sess:
        abort(404)
    week = s.get("weeks", sess["week_id"]) if sess.get("week_id") else {"id": None, "title": "Defend your own work", "number": None}
    outcomes = sorted(s.list("outcomes", week_id=week["id"]), key=lambda o: o.get("position", 0)) if week["id"] else []
    outcomes += sorted(s.list("outcomes", session_id=session_id), key=lambda o: o.get("position", 0))
    attempts = sorted(s.list("attempts", session_id=session_id), key=lambda a: a.get("created_at", ""))
    public_outcomes = [
        {
            "id": o["id"],
            "title": o["title"],
            "prompt": o["prompt"],
            "slide_ref": o.get("slide_ref", ""),
            "position": o.get("position", 0),
            "kind": o.get("kind", "week"),
            # students see the KIND of thing checked (student_label), never the examiner text or give-away terms
            "criteria": [
                {"id": c["id"], "text": logic.safe_student_label(c.get("student_label", ""), c.get("answer_terms", []), i + 1)}
                for i, c in enumerate(o["criteria"])
            ],
        }
        for o in outcomes
    ]
    return jsonify(
        {
            "session": sess,
            "week": {"id": week["id"], "title": week["title"], "number": week.get("number")},
            "outcomes": public_outcomes,
            "attempts": [
                {k: a.get(k) for k in ("id", "outcome_id", "status", "confidence_before", "met_ids", "student_turns", "kind")}
                for a in attempts
            ],
            "student_id": g.student_id,
            "hint_after": config.HINT_AFTER_ATTEMPTS,
            "judge_votes": 1 if config.LLM_PROVIDER == "mock" else config.JUDGE_VOTES,
            "max_turns": config.MAX_TURNS_PER_OUTCOME,
        }
    )


@app.post("/api/attempt/start")
def api_attempt_start():
    body = request.get_json(force=True, silent=True) or {}
    try:
        conf = int(body.get("confidence") or 0)
    except (TypeError, ValueError):
        conf = 0
    if conf not in (0, 1, 2, 3, 4, 5):
        return jsonify({"error": "confidence must be 1-5 or 0 for 'not given'"}), 400
    kind = "recall" if body.get("kind") == "recall" else "practice"
    try:
        a = logic.start_attempt(str(body.get("session_id", "")), str(body.get("outcome_id", "")), conf, kind=kind)
    except KeyError:
        abort(404)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(_attempt_payload(a["id"]))


def _attempt_payload(attempt_id: str) -> dict:
    s = get_store()
    a = s.get("attempts", attempt_id)
    if not a:
        abort(404)
    turns = sorted(s.list("turns", attempt_id=attempt_id), key=lambda t: t["created_at"])
    return {
        "attempt": {k: a.get(k) for k in ("id", "outcome_id", "status", "confidence_before", "met_ids", "student_turns", "target_attempts")},
        "turns": [{"role": t["role"], "content": t["content"], "meta": t.get("meta")} for t in turns],
    }


@app.get("/api/attempt/<attempt_id>")
def api_attempt(attempt_id):
    return jsonify(_attempt_payload(attempt_id))


@app.post("/api/attempt/<attempt_id>/message")
@rate_limited(30)
def api_attempt_message(attempt_id):
    body = request.get_json(force=True, silent=True) or {}
    content = (body.get("content") or "").strip()
    if not content:
        return jsonify({"error": "empty"}), 400
    try:
        res = logic.student_message(attempt_id, content)
    except KeyError:
        abort(404)
    return jsonify(
        {
            "tutor": {"role": "tutor", "content": res["tutor"]["content"], "meta": res["tutor"].get("meta")},
            "criteria": res["criteria"],
            "status": res["status"],
            "hint": res["hint"],
            "student_turns": res["student_turns"],
        }
    )


@app.post("/api/attempt/<attempt_id>/confidence")
def api_attempt_confidence(attempt_id):
    """Optional self-rating, allowed only before the first message so it is a prediction, not a hindsight."""
    s = get_store()
    a = s.get("attempts", attempt_id)
    if not a:
        abort(404)
    body = request.get_json(force=True, silent=True) or {}
    try:
        conf = int(body.get("confidence", 0))
    except (TypeError, ValueError):
        conf = 0
    if conf not in (1, 2, 3, 4, 5):
        return jsonify({"error": "confidence must be 1-5"}), 400
    if (a.get("student_turns") or 0) > 0:
        return jsonify({"error": "too late: you have already started explaining"}), 400
    s.update("attempts", attempt_id, {"confidence_before": conf})
    return jsonify({"ok": True})


@app.post("/api/attempt/<attempt_id>/skip")
def api_attempt_skip(attempt_id):
    if not logic.skip_attempt(attempt_id):
        abort(404)
    return jsonify({"ok": True})


# --------------------------------------------------------------------------
# learn mode, class wall, coursework viva, profile
# --------------------------------------------------------------------------
@app.get("/learn/s/<session_id>/learn")
def learn_mode(session_id):
    s = get_store()
    sess = s.get("sessions", session_id)
    if not sess:
        abort(404)
    week = s.get("weeks", sess["week_id"]) if sess.get("week_id") else None
    course = s.get("courses", week["course_id"]) if week else {}
    chats = s.list("chats", session_id=session_id)
    messages = (chats[-1].get("messages") if chats else []) or []
    materials = s.list("materials", session_id=session_id)
    mine = s.list("outcomes", session_id=session_id)
    return render_template("learn_mode.html", session=sess, week=week, course=course, messages=messages, materials=materials, mine=mine)


@app.post("/api/session/<session_id>/learn")
@rate_limited(30)
def api_learn(session_id):
    body = request.get_json(force=True, silent=True) or {}
    content = (body.get("content") or "").strip()
    if not content:
        return jsonify({"error": "empty"}), 400
    try:
        return jsonify(logic.learn_message(session_id, content))
    except KeyError:
        abort(404)


@app.post("/api/session/<session_id>/materials")
def api_materials(session_id):
    s = get_store()
    if not s.get("sessions", session_id):
        abort(404)
    title = (request.form.get("title") or "").strip()
    text = (request.form.get("text") or "").strip()
    f = request.files.get("file")
    if f and f.filename:
        data = f.read()
        title = title or f.filename
        try:
            text = (text + "\n\n" + (_extract_pdf_text(data) if f.filename.lower().endswith(".pdf") else data.decode("utf-8", errors="ignore"))).strip()
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
    if len(text) < 50:
        return jsonify({"error": "That is too short to learn from. Add a PDF, a chapter, or a few paragraphs of notes."}), 400
    m = logic.add_material(session_id, title or "Notes", text)
    return jsonify({"ok": True, "material": {"id": m["id"], "title": m["title"], "chars": m["chars"]}})


@app.post("/api/session/<session_id>/cards")
@rate_limited(10)
def api_cards(session_id):
    body = request.get_json(force=True, silent=True) or {}
    try:
        rows = logic.make_cards(session_id, (body.get("focus") or "")[:200])
    except KeyError:
        abort(404)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"ok": True, "n": len(rows), "outcomes": [{"id": r["id"], "title": r["title"]} for r in rows]})


@app.route("/learn/check-work", methods=["GET", "POST"])
def check_work():
    if request.method == "GET":
        return render_template("check_work.html", error=None)
    s = get_store()
    work = (request.form.get("work") or "").strip()
    f = request.files.get("file")
    if f and f.filename:
        data = f.read()
        try:
            work = (work + "\n\n" + (_extract_pdf_text(data) if f.filename.lower().endswith(".pdf") else data.decode("utf-8", errors="ignore"))).strip()
        except ValueError as e:
            return render_template("check_work.html", error=str(e)), 400
    alias = re.sub(r"[^\w\- ]", "", request.form.get("alias", "")).strip()[:24] or "anonymous"
    sess = s.insert("sessions", {"week_id": None, "alias": alias, "student_id": g.student_id, "kind": "viva"})
    try:
        logic.make_viva(sess["id"], work)
    except ValueError as e:
        return render_template("check_work.html", error=str(e)), 400
    return redirect(url_for("practice", session_id=sess["id"]))


@app.get("/api/outcome/<outcome_id>/wall")
def api_wall(outcome_id):
    if not get_store().get("outcomes", outcome_id):
        abort(404)
    return jsonify({"posts": logic.wall_for_outcome(outcome_id, g.student_id)})


@app.post("/api/outcome/<outcome_id>/wall")
@rate_limited(20)
def api_wall_post(outcome_id):
    body = request.get_json(force=True, silent=True) or {}
    try:
        p = logic.post_explanation(str(body.get("session_id", "")), outcome_id, body.get("content") or "", g.student_id)
    except KeyError:
        abort(404)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"ok": True, "post_id": p["id"], "posts": logic.wall_for_outcome(outcome_id, g.student_id)})


@app.post("/api/post/<post_id>/vote")
@rate_limited(60)
def api_vote(post_id):
    body = request.get_json(force=True, silent=True) or {}
    try:
        v = int(body.get("value", 0))
    except (TypeError, ValueError):
        v = 0
    try:
        logic.vote_post(post_id, g.student_id, v)
    except KeyError:
        abort(404)
    p = get_store().get("posts", post_id)
    if p:
        return jsonify({"ok": True, "posts": logic.wall_for_outcome(p["outcome_id"], g.student_id)})
    return jsonify({"ok": True})


# --------------------------------------------------------------------------
# Q&A forum
# --------------------------------------------------------------------------
def _is_lecturer() -> bool:
    return bool(session.get("lecturer"))


@app.get("/w/<week_id>/questions")
def forum(week_id):
    s = get_store()
    week = s.get("weeks", week_id)
    if not week:
        abort(404)
    course = s.get("courses", week["course_id"]) or {}
    threads = logic.forum_list(week_id, g.student_id)
    return render_template("forum.html", week=week, course=course, threads=threads, lecturer=_is_lecturer(), back=request.args.get("back"))


@app.post("/w/<week_id>/questions")
@rate_limited(10)
def forum_ask(week_id):
    alias = re.sub(r"[^\w\- ]", "", request.form.get("alias", "")).strip()[:24]
    role = "lecturer" if _is_lecturer() else "student"
    try:
        t = logic.forum_ask(week_id, g.student_id, alias or ("Lecturer" if role == "lecturer" else "a student"),
                            request.form.get("title", ""), request.form.get("body", ""), role=role)
    except KeyError:
        abort(404)
    except ValueError as e:
        return render_template("error.html", title="Could not post", message=str(e)), 400
    return redirect(url_for("forum_thread", thread_id=t["id"]))


@app.get("/q/<thread_id>")
def forum_thread(thread_id):
    t = logic.forum_thread(thread_id, g.student_id)
    if not t:
        abort(404)
    s = get_store()
    week = s.get("weeks", t["week_id"]) or {}
    course = s.get("courses", week.get("course_id", "")) or {}
    return render_template("thread.html", t=t, week=week, course=course, lecturer=_is_lecturer())


@app.post("/q/<thread_id>/reply")
@rate_limited(20)
def forum_reply(thread_id):
    alias = re.sub(r"[^\w\- ]", "", request.form.get("alias", "")).strip()[:24]
    role = "lecturer" if _is_lecturer() else "student"
    try:
        logic.forum_reply(thread_id, g.student_id, alias or ("Lecturer" if role == "lecturer" else "a student"), request.form.get("body", ""), role=role)
    except KeyError:
        abort(404)
    except ValueError as e:
        return render_template("error.html", title="Could not reply", message=str(e)), 400
    return redirect(url_for("forum_thread", thread_id=thread_id))


@app.post("/api/thread/<thread_id>/ai")
@rate_limited(10)
def api_forum_ai(thread_id):
    try:
        return jsonify({"draft": logic.forum_ai_draft(thread_id)})
    except KeyError:
        abort(404)


@app.post("/api/thread/<thread_id>/set")
@lecturer_required
def api_forum_set(thread_id):
    body = request.get_json(force=True, silent=True) or {}
    if not logic.forum_set(thread_id, {k: bool(v) for k, v in body.items()}):
        abort(404)
    return jsonify({"ok": True})


@app.post("/api/reply/<reply_id>/accept")
@lecturer_required
def api_forum_accept(reply_id):
    try:
        logic.forum_accept(reply_id)
    except KeyError:
        abort(404)
    return jsonify({"ok": True})


@app.get("/me")
def me():
    prof = logic.student_profile(g.student_id)
    return render_template("me.html", prof=prof)


# --------------------------------------------------------------------------
# lecturer
# --------------------------------------------------------------------------
@app.route("/teach/login", methods=["GET", "POST"])
def teach_login():
    error = None
    if request.method == "POST":
        if request.form.get("pin") == config.LECTURER_PIN:
            session["lecturer"] = True
            session.permanent = False
            nxt = request.args.get("next") or ""
            if not (nxt.startswith("/") and not nxt.startswith("//")):
                nxt = url_for("teach")
            return redirect(nxt)
        error = "That PIN is not right."
    return render_template("teach_login.html", error=error)


def _courses_with_weeks():
    s = get_store()
    courses = s.list("courses")
    weeks = s.list("weeks")
    sessions = s.list("sessions")
    by_week = {}
    for w in weeks:
        by_week.setdefault(w["course_id"], []).append(w)
        w["n_students"] = sum(1 for x in sessions if x["week_id"] == w["id"])
        w["n_outcomes"] = len(s.list("outcomes", week_id=w["id"]))
        w["open_q"] = logic.forum_open_count(w["id"])
    for c in courses:
        c["weeks"] = sorted(by_week.get(c["id"], []), key=lambda w: w.get("number") or 0)
    return courses


@app.get("/teach")
@lecturer_required
def teach():
    return render_template("teach.html", courses=_courses_with_weeks())


@app.post("/teach/seed")
@lecturer_required
def teach_seed():
    """Load the demo week (Informatics 1, Week 5) with simulated students, so the report is populated."""
    from .seed import seed

    seed(reset=False)
    return redirect(url_for("teach"))


@app.post("/teach/week/new")
@lecturer_required
def teach_week_new():
    s = get_store()
    course_title = request.form.get("course_title", "").strip()[:120] or "Untitled course"
    course_code = request.form.get("course_code", "").strip()[:24]
    week_number = request.form.get("week_number", "").strip()
    material = request.form.get("material", "").strip()
    form_echo = {"course_title": course_title, "course_code": course_code, "week_number": week_number, "material": material}
    f = request.files.get("slides")
    if f and f.filename:
        data = f.read()
        try:
            if f.filename.lower().endswith(".pdf"):
                material = (material + "\n\n" + _extract_pdf_text(data)).strip()
            else:
                material = (material + "\n\n" + data.decode("utf-8", errors="ignore")).strip()
        except ValueError as e:
            return render_template("teach.html", courses=_courses_with_weeks(), error=str(e), form=form_echo), 400
    if len(material) < 200:
        return render_template(
            "teach.html",
            courses=_courses_with_weeks(),
            error="I need at least a few paragraphs of lecture material (a PDF of slides, or pasted notes) to draft outcomes. "
            + ("That PDF had no extractable text; it may be scanned images. Paste the notes instead." if f and f.filename and len(material) < 50 else ""),
            form=form_echo,
        ), 400

    existing = next((c for c in s.list("courses") if c["title"].lower() == course_title.lower()), None)
    course = existing or s.insert("courses", {"title": course_title, "code": course_code})
    try:
        draft = logic.draft_outcomes(course_title, material)
    except llm.LLMError as e:
        return render_template("teach.html", courses=_courses_with_weeks(), error=f"The AI drafting step failed: {e}", form=form_echo), 502
    if not draft["outcomes"]:
        return render_template("teach.html", courses=_courses_with_weeks(), error="The AI could not find teachable outcomes in that material. Try a different file or paste clearer notes.", form=form_echo), 502
    week = s.insert(
        "weeks",
        {
            "course_id": course["id"],
            "number": int(week_number) if week_number.isdigit() else None,
            "title": draft["week_title"],
            "status": "draft",
            "material_chars": len(material),
            "material_excerpt": material[:1500],
        },
    )
    for i, o in enumerate(draft["outcomes"]):
        s.insert("outcomes", {**o, "week_id": week["id"], "position": i})
    return redirect(url_for("teach_week", week_id=week["id"]))


@app.get("/teach/week/<week_id>")
@lecturer_required
def teach_week(week_id):
    s = get_store()
    week = s.get("weeks", week_id)
    if not week:
        abort(404)
    course = s.get("courses", week["course_id"])
    outcomes = sorted(s.list("outcomes", week_id=week_id), key=lambda o: o.get("position", 0))
    return render_template("teach_week.html", week=week, course=course, outcomes=outcomes)


@app.post("/api/week/<week_id>/outcomes")
@lecturer_required
def api_week_save(week_id):
    """Replace the week's outcomes with the edited list (keeps ids where given)."""
    s = get_store()
    week = s.get("weeks", week_id)
    if not week:
        abort(404)
    body = request.get_json(force=True)
    if "title" in body:
        s.update("weeks", week_id, {"title": str(body["title"]).strip()[:120]})
    incoming = body.get("outcomes", [])
    existing = {o["id"]: o for o in s.list("outcomes", week_id=week_id)}
    keep = set()
    for i, o in enumerate(incoming):
        crits = []
        for c in o.get("criteria", []):
            text = str(c.get("text", "")).strip()
            if not text:
                continue
            terms = [str(t).strip() for t in c.get("answer_terms", []) if str(t).strip()][:3]
            crits.append(
                {
                    "id": c.get("id") or logic.new_id()[:8],
                    "text": text[:300],
                    "student_label": logic.safe_student_label(str(c.get("student_label", "")).strip(), terms, len(crits) + 1),
                    "answer_terms": terms,
                }
            )
        row = {
            "title": str(o.get("title", "")).strip()[:80] or "Untitled",
            "prompt": str(o.get("prompt", "")).strip()[:500],
            "slide_ref": str(o.get("slide_ref", "")).strip()[:40],
            "criteria": crits,
            "common_misconceptions": [str(m).strip() for m in o.get("common_misconceptions", []) if str(m).strip()][:3],
            "position": i,
        }
        if o.get("id") in existing:
            s.update("outcomes", o["id"], row)
            keep.add(o["id"])
        else:
            new = s.insert("outcomes", {**row, "week_id": week_id})
            keep.add(new["id"])
    for oid in existing:
        if oid not in keep:
            s.update("outcomes", oid, {"week_id": None, "archived_from": week_id})
    return jsonify({"ok": True})


@app.post("/api/week/<week_id>/publish")
@lecturer_required
def api_week_publish(week_id):
    s = get_store()
    if not s.get("weeks", week_id):
        abort(404)
    body = request.get_json(silent=True) or {}
    publish = bool(body.get("publish", True))
    if publish:
        outcomes = s.list("outcomes", week_id=week_id)
        problems = []
        if not outcomes:
            problems.append("The week has no outcomes.")
        for o in outcomes:
            if not o.get("prompt", "").strip():
                problems.append(f"'{o['title']}' has no prompt for the student.")
            if not o.get("criteria"):
                problems.append(f"'{o['title']}' has no criteria, so nothing could be checked.")
        if problems:
            return jsonify({"ok": False, "error": " ".join(problems)}), 400
    status = "published" if publish else "draft"
    s.update("weeks", week_id, {"status": status})
    return jsonify({"ok": True, "status": status})


@app.get("/teach/week/<week_id>/report")
@lecturer_required
def teach_report(week_id):
    s = get_store()
    week = s.get("weeks", week_id)
    if not week:
        abort(404)
    course = s.get("courses", week["course_id"])
    rep = logic.week_report(week_id)
    wall = logic.wall_summary_for_week(week_id)
    live = request.args.get("live") == "1"
    return render_template("report.html", week=week, course=course, rep=rep, wall=wall, live=live)


@app.post("/api/week/<week_id>/reteach/<outcome_id>")
@lecturer_required
@rate_limited(10)
def api_reteach(week_id, outcome_id):
    try:
        md = logic.reteach(week_id, outcome_id)
    except KeyError:
        abort(404)
    return jsonify({"markdown": md})


@app.get("/api/week/<week_id>/reteach/<outcome_id>.pptx")
@lecturer_required
@rate_limited(10)
def api_reteach_pptx(week_id, outcome_id):
    from .export import reteach_pptx

    try:
        md = logic.reteach(week_id, outcome_id)
    except KeyError:
        abort(404)
    o = get_store().get("outcomes", outcome_id) or {"title": "Re-teach"}
    buf = reteach_pptx(o["title"], md)
    return send_file(buf, as_attachment=True, download_name=f"reteach-{re.sub(r'[^a-z0-9]+', '-', o['title'].lower())[:40]}.pptx",
                     mimetype="application/vnd.openxmlformats-officedocument.presentationml.presentation")


@app.get("/api/week/<week_id>/report.json")
@lecturer_required
def api_report_json(week_id):
    return jsonify(logic.week_report(week_id))
