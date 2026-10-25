/* Student practice screen. Plain JS, no build step. */
(function () {
  const root = document.getElementById("app");
  const sessionId = root.dataset.session;
  const $ = (id) => document.getElementById(id);

  const state = {
    outcomes: [],
    attempts: {}, // outcome_id -> attempt (with turns when loaded)
    current: null, // outcome id
    busy: false,
    hintAfter: 2,
    judgeVotes: 2,
    startedAt: Date.now(),
  };

  const api = async (url, body) => {
    const r = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || data.error || r.statusText);
    return data;
  };

  function statusOf(oid) {
    const a = state.attempts[oid];
    return a ? a.status : "not_started";
  }

  function renderNav() {
    const nav = $("outcome-nav");
    nav.innerHTML = "";
    const prog = $("progress");
    prog.innerHTML = "";
    let lastKind = null;
    state.outcomes.forEach((o, i) => {
      const st = statusOf(o.id);
      const kind = o.kind || "week";
      if (kind !== lastKind && state.outcomes.some((x) => (x.kind || "week") !== "week")) {
        const g = document.createElement("li");
        g.className = "group";
        g.textContent = kind === "week" ? "This week" : kind === "viva" ? "My coursework" : "My own cards";
        nav.appendChild(g);
        lastKind = kind;
      }
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-current", o.id === state.current ? "true" : "false");
      b.innerHTML = `<span class="dot ${st}" aria-hidden="true"></span><span>${i + 1}. ${escapeHtml(o.title)}</span>`;
      b.addEventListener("click", () => select(o.id));
      li.appendChild(b);
      nav.appendChild(li);
      const seg = document.createElement("span");
      seg.className = st;
      prog.appendChild(seg);
    });
    const done = state.outcomes.filter((o) => statusOf(o.id) === "mastered").length;
    $("session-status").textContent = `${done} of ${state.outcomes.length} understood`;
  }

  function renderRubric(o, metIds, targetId) {
    const ul = $("rubric");
    ul.innerHTML = "";
    (o.criteria || []).forEach((c) => {
      const li = document.createElement("li");
      const met = metIds.includes(c.id);
      li.className = (met ? "met" : "") + (c.id === targetId && !met ? " target" : "");
      li.innerHTML = `<span class="tick" aria-hidden="true"></span><span>${escapeHtml(c.text)}</span>`;
      li.setAttribute("aria-label", `${c.text}: ${met ? "covered" : "not yet"}`);
      ul.appendChild(li);
    });
    const n = (o.criteria || []).length;
    const how = state.judgeVotes > 1
      ? `${state.judgeVotes} independent checks must agree, each quoting your words, before a tick turns green.`
      : "A tick turns green only when your own words cover the point.";
    $("rubric-note").textContent = metIds.length === n && n ? "All points covered." : `${metIds.length} of ${n} covered. ${how}`;
  }

  // ---- class wall ----
  function renderWall(posts) {
    const host = $("wall");
    host.innerHTML = "";
    if (!posts.length) {
      host.innerHTML = '<p class="muted" style="font-size:0.9rem; margin:0">No one has shared one yet. Be the first.</p>';
      return;
    }
    posts.forEach((p) => {
      const d = document.createElement("div");
      d.className = "post";
      const txt = document.createElement("p");
      txt.textContent = p.content;
      d.appendChild(txt);
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<span>${escapeHtml(p.alias)}${p.verified ? ' · <span class="pill pill-teal" style="font-size:0.7rem; padding:0 0.4rem">passed the check</span>' : ""}</span>
        <button class="vote" data-v="1" aria-pressed="${p.my_vote > 0}" aria-label="Helpful">▲ ${p.up}</button>
        <button class="vote" data-v="-1" aria-pressed="${p.my_vote < 0}" aria-label="Not helpful">▼ ${p.down}</button>`;
      meta.querySelectorAll(".vote").forEach((b) =>
        b.addEventListener("click", async () => {
          const v = Number(b.dataset.v);
          const r = await api(`/api/post/${p.id}/vote`, { value: p.my_vote === v ? 0 : v });
          renderWall(r.posts);
        })
      );
      d.appendChild(meta);
      host.appendChild(d);
    });
  }

  async function loadWall(oid) {
    try {
      const r = await api(`/api/outcome/${oid}/wall`);
      renderWall(r.posts);
    } catch (e) {
      $("wall").innerHTML = "";
    }
  }

  $("wallform").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("wallinput").value.trim();
    if (!text) return;
    $("wallbtn").disabled = true;
    try {
      const r = await api(`/api/outcome/${state.current}/wall`, { session_id: sessionId, content: text });
      renderWall(r.posts);
      $("wallinput").value = "";
      $("wallstatus").textContent = "Shared.";
    } catch (err) {
      $("wallstatus").textContent = err.message;
    }
    $("wallbtn").disabled = false;
  });

  function renderCard(o) {
    const i = state.outcomes.findIndex((x) => x.id === o.id);
    $("card-pos").textContent = `Outcome ${i + 1} of ${state.outcomes.length}`;
    $("card-slide").textContent = o.slide_ref ? o.slide_ref : "";
    $("card-prompt").textContent = o.prompt;
    $("back-title").textContent = o.title;
  }

  function addMsg(role, text, opts = {}) {
    const chat = $("chat");
    const d = document.createElement("div");
    d.className = `msg ${role}` + (opts.mastered ? " mastered" : "") + (opts.reveal ? " reveal" : "");
    if (opts.hint) d.innerHTML = `<span class="tag">Hint</span><br>`;
    if (opts.reveal) {
      d.innerHTML = `<span class="tag">The answer</span><br>`;
      const body = document.createElement("div");
      body.className = "reveal-body";
      body.textContent = text;
      d.appendChild(body);
      const hide = document.createElement("button");
      hide.type = "button";
      hide.className = "btn btn-sm btn-secondary";
      hide.style.marginTop = "0.6rem";
      hide.textContent = "Hide it, I'll explain it back";
      hide.addEventListener("click", () => {
        body.hidden = !body.hidden;
        hide.textContent = body.hidden ? "Show it again" : "Hide it, I'll explain it back";
        if (body.hidden) $("input").focus();
      });
      d.appendChild(hide);
      chat.appendChild(d);
      d.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return d;
    }
    d.appendChild(document.createTextNode(text));
    chat.appendChild(d);
    d.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return d;
  }

  function typing(on) {
    let t = document.getElementById("typing");
    if (on && !t) {
      t = document.createElement("div");
      t.id = "typing";
      t.className = "msg tutor";
      t.innerHTML = '<span class="typing" aria-label="Tutor is thinking"><i></i><i></i><i></i></span>';
      $("chat").appendChild(t);
      t.scrollIntoView({ block: "nearest" });
    } else if (!on && t) t.remove();
  }

  async function select(oid) {
    state.current = oid;
    const o = state.outcomes.find((x) => x.id === oid);
    renderNav();
    renderCard(o);
    $("wall-panel").hidden = (o.kind || "week") !== "week";
    if (!$("wall-panel").hidden) loadWall(oid);
    $("wallstatus").textContent = "";
    $("wallinput").value = "";
    $("summary").hidden = true;
    const card = $("bigcard");
    card.classList.remove("flipped");
    let a = state.attempts[oid];
    document.querySelectorAll("#conf-scale button").forEach((b) => b.setAttribute("aria-pressed", "false"));
    if (!a) {
      // start straight away; confidence is optional and can be tapped before the first message
      try {
        const data = await api("/api/attempt/start", { session_id: sessionId, outcome_id: oid, confidence: 0 });
        a = state.attempts[oid] = data.attempt;
      } catch (e) {
        addMsg("tutor", "Could not start this outcome: " + e.message);
        return;
      }
    }
    const conf = $("confidence");
    conf.hidden = (a.student_turns || 0) > 0 && !a.confidence_before;
    conf.dataset.done = a.confidence_before ? "1" : "";
    if (a.confidence_before) {
      const b = document.querySelector(`#conf-scale button[data-v="${a.confidence_before}"]`);
      if (b) b.setAttribute("aria-pressed", "true");
    }
    $("input").disabled = false;
    $("send").disabled = false;
    await loadAttempt(a.id, o);
  }

  async function loadAttempt(attemptId, o) {
    const data = await api(`/api/attempt/${attemptId}`);
    state.attempts[o.id] = { ...state.attempts[o.id], ...data.attempt };
    const chat = $("chat");
    chat.innerHTML = "";
    data.turns.forEach((t) => addMsg(t.role, t.content, { hint: t.meta && t.meta.hint, reveal: t.meta && t.meta.reveal, mastered: data.attempt.status === "mastered" && t.role === "tutor" && t === data.turns[data.turns.length - 1] }));
    $("chat-wrap").hidden = false;
    renderRubric(o, data.attempt.met_ids || [], null);
    $("reveal").hidden = !data.attempt.can_reveal;
    if (data.attempt.status === "mastered" || data.attempt.status === "seen") {
      showMastered(o, data.turns[data.turns.length - 1].content, data.attempt.status === "seen");
    } else if (data.attempt.status === "parked") {
      $("input").disabled = true;
      $("send").disabled = true;
      addMsg("tutor", "This one is parked for now. Move on and come back to it in a later session with fresh eyes.");
    } else {
      $("input").disabled = false;
      $("send").disabled = false;
      $("input").focus();
    }
    renderNav();
  }

  function showMastered(o, summary, seen = false) {
    $("back-summary").textContent = summary;
    const pill = document.querySelector("#face-back .pill");
    pill.textContent = seen ? "Seen the answer, explained back" : "Understood";
    pill.className = "pill " + (seen ? "pill-amber" : "pill-teal");
    $("reveal").hidden = true;
    const mine = Array.from(document.querySelectorAll("#chat .msg.student")).map((d) => d.textContent);
    if (mine.length && !$("wallinput").value) {
      $("wallinput").value = mine[mine.length - 1];
      $("wallstatus").textContent = "You passed. Share this with the class?";
    }
    $("bigcard").classList.add("flipped");
    $("input").disabled = true;
    $("send").disabled = true;
    $("next-btn").focus();
  }

  function nextUnfinished() {
    const order = state.outcomes.map((o) => o.id);
    const i = order.indexOf(state.current);
    for (let k = 1; k <= order.length; k++) {
      const id = order[(i + k) % order.length];
      const st = statusOf(id);
      if (!["mastered", "seen", "skipped", "parked"].includes(st)) return id;
    }
    return null;
  }

  function showSummary() {
    const mastered = state.outcomes.filter((o) => statusOf(o.id) === "mastered").length;
    const skipped = state.outcomes.filter((o) => ["skipped", "parked"].includes(statusOf(o.id))).length;
    const seen = state.outcomes.filter((o) => statusOf(o.id) === "seen").length;
    const mins = Math.max(1, Math.round((Date.now() - state.startedAt) / 60000));
    const over = state.outcomes.filter((o) => {
      const a = state.attempts[o.id];
      return a && a.confidence_before >= 4 && a.status !== "mastered" && (a.student_turns || 0) >= 1;
    }).length;
    $("summary-grid").innerHTML = [
      [mastered, "outcomes understood"],
      [seen, "needed the answer (back in 3 days)"],
      [skipped, "skipped or parked"],
      [mins, "minutes"],
      [over, "felt sure (4–5) but not yet shown"],
    ]
      .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`)
      .join("");
    $("summary-text").textContent =
      over > 0
        ? "The last number is the one to look at: those are the outcomes where reading about it felt like understanding it. Come back to them."
        : "Your confidence matched what you could explain. That calibration is the point.";
    $("summary").hidden = false;
    $("chat-wrap").hidden = true;
    $("bigcard").classList.remove("flipped");
    $("summary").scrollIntoView({ behavior: "smooth" });
  }

  // ---- events ----
  document.querySelectorAll("#conf-scale button").forEach((b) => {
    b.addEventListener("click", async () => {
      const a = state.attempts[state.current];
      if (!a) return;
      document.querySelectorAll("#conf-scale button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      try {
        await api(`/api/attempt/${a.id}/confidence`, { confidence: Number(b.dataset.v) });
        a.confidence_before = Number(b.dataset.v);
        $("confidence").dataset.done = "1";
      } catch (e) {
        /* optional; ignore */
      }
      $("input").focus();
    });
  });

  $("composer").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const input = $("input");
    const text = input.value.trim();
    if (!text || state.busy) return;
    const o = state.outcomes.find((x) => x.id === state.current);
    const a = state.attempts[state.current];
    state.busy = true;
    $("send").disabled = true;
    addMsg("student", text);
    input.value = "";
    typing(true);
    try {
      const res = await api(`/api/attempt/${a.id}/message`, { content: text });
      typing(false);
      const metIds = res.criteria.filter((c) => c.met).map((c) => c.id);
      const target = res.tutor.meta && res.tutor.meta.target_id;
      a.met_ids = metIds;
      a.status = res.status;
      a.student_turns = res.student_turns;
      if (!a.confidence_before) $("confidence").hidden = true;
      renderRubric(o, metIds, target);
      addMsg("tutor", res.tutor.content, { hint: res.hint, mastered: res.status === "mastered" || res.status === "seen" });
      $("reveal").hidden = !res.can_reveal;
      renderNav();
      if (res.status === "mastered" || res.status === "seen") {
        setTimeout(() => showMastered(o, res.tutor.content, res.status === "seen"), 600);
      } else if (res.status === "parked") {
        $("send").disabled = true;
        input.disabled = true;
        setTimeout(advance, 2500);
      } else {
        $("send").disabled = false;
        input.focus();
      }
    } catch (e) {
      typing(false);
      addMsg("tutor", "Something went wrong talking to the tutor (" + e.message + "). Your message is saved; try sending again.");
      $("send").disabled = false;
    } finally {
      state.busy = false;
    }
  });

  $("input").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      $("composer").requestSubmit();
    }
  });

  $("reveal").addEventListener("click", async () => {
    const a = state.attempts[state.current];
    if (!a || state.busy) return;
    state.busy = true;
    $("reveal").disabled = true;
    typing(true);
    try {
      const res = await api(`/api/attempt/${a.id}/reveal`, {});
      typing(false);
      addMsg("tutor", res.text, { reveal: true });
      a.revealed = true;
      $("reveal").hidden = true;
      const o = state.outcomes.find((x) => x.id === state.current);
      a.met_ids = [];
      renderRubric(o, [], null);
      $("rubric-note").textContent = "Now explain it back in your own words. Copied sentences don't count.";
    } catch (e) {
      typing(false);
      addMsg("tutor", "Could not show the answer: " + e.message);
    } finally {
      $("reveal").disabled = false;
      state.busy = false;
    }
  });

  $("skip").addEventListener("click", async () => {
    const a = state.attempts[state.current];
    if (a) {
      await api(`/api/attempt/${a.id}/skip`, {});
      a.status = "skipped";
    }
    advance();
  });

  $("next-btn").addEventListener("click", advance);

  function advance() {
    renderNav();
    const nxt = nextUnfinished();
    if (nxt) select(nxt);
    else showSummary();
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    const order = state.outcomes.map((o) => o.id);
    const i = order.indexOf(state.current);
    if (e.key === "ArrowDown" && i < order.length - 1) select(order[i + 1]);
    if (e.key === "ArrowUp" && i > 0) select(order[i - 1]);
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---- voice input (Web Speech API, Chrome/Edge/Safari; degrades silently elsewhere) ----
  (function () {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const mic = $("mic");
    if (!SR || !mic) return;
    mic.hidden = false;
    let rec = null;
    mic.addEventListener("click", () => {
      if (rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = "en-GB";
      rec.interimResults = true;
      rec.continuous = true;
      const input = $("input");
      const base = input.value ? input.value.trim() + " " : "";
      let finalText = "";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += t + " "; else interim += t;
        }
        input.value = base + finalText + interim;
      };
      rec.onend = () => { rec = null; mic.setAttribute("aria-pressed", "false"); mic.textContent = "🎤 Speak"; input.focus(); };
      rec.onerror = rec.onend;
      rec.start();
      mic.setAttribute("aria-pressed", "true");
      mic.textContent = "■ Stop";
    });
  })();

  // ---- boot ----
  (async () => {
    const data = await api(`/api/session/${sessionId}`);
    state.outcomes = data.outcomes;
    state.hintAfter = data.hint_after;
    state.judgeVotes = data.judge_votes || 1;
    data.attempts.forEach((a) => (state.attempts[a.outcome_id] = a));
    const pre = root.dataset.preselect;
    const recall = root.dataset.recall === "1";
    if (pre && state.outcomes.some((o) => o.id === pre)) {
      if (recall) {
        // a fresh, short re-explain attempt a few days after mastering
        const data = await api("/api/attempt/start", { session_id: sessionId, outcome_id: pre, confidence: 0, kind: "recall" });
        state.attempts[pre] = data.attempt;
      }
      select(pre);
      return;
    }
    const first = state.outcomes.find((o) => !["mastered", "seen", "skipped", "parked"].includes(statusOf(o.id))) || state.outcomes[0];
    if (first) select(first.id);
  })();
})();
