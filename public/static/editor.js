/* Lecturer outcome editor: edit in place, autosave with debounce, publish. */
(function () {
  const root = document.getElementById("editor-app");
  const weekId = root.dataset.week;
  const $ = (id) => document.getElementById(id);
  let outcomes = JSON.parse($("outcomes-data").textContent);
  let selected = 0;
  let timer = null;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function render() {
    const host = $("outcomes");
    host.innerHTML = "";
    outcomes.forEach((o, i) => {
      const el = document.createElement("article");
      el.className = "outcome-edit";
      el.dataset.i = i;
      el.innerHTML = `
        <div class="oe-head">
          <span class="oe-num">${i + 1}</span>
          <input type="text" data-f="title" value="${esc(o.title)}" aria-label="Outcome title" placeholder="Concept name">
          <input type="text" data-f="slide_ref" value="${esc(o.slide_ref)}" aria-label="Slide reference" placeholder="slides 4–6" style="max-width:120px">
          <button class="icon-btn" data-act="up" title="Move up" aria-label="Move up">↑</button>
          <button class="icon-btn" data-act="down" title="Move down" aria-label="Move down">↓</button>
          <button class="icon-btn" data-act="del" title="Delete outcome" aria-label="Delete outcome">✕</button>
        </div>
        <textarea data-f="prompt" aria-label="Prompt shown to the student" placeholder="Explain in your own words…">${esc(o.prompt)}</textarea>
        <div class="crit-list" aria-label="Rubric criteria">
          <div class="crit-row muted" style="font-size:0.85rem"><span>Examiner checks for (lecturer + judge only)</span><span>Give-away words</span><span></span></div>
          ${(o.criteria || [])
            .map(
              (c, k) => `
            <div class="crit-row" data-k="${k}">
              <input type="text" data-cf="text" value="${esc(c.text)}" aria-label="Criterion ${k + 1}">
              <input type="text" data-cf="answer_terms" value="${esc((c.answer_terms || []).join(", "))}" aria-label="Give-away words for criterion ${k + 1}" placeholder="comma-separated">
              <button class="icon-btn" data-act="delcrit" aria-label="Remove criterion">✕</button>
              <input type="text" data-cf="student_label" value="${esc(c.student_label || "")}" aria-label="Label students see for criterion ${k + 1}" placeholder="Label students see, e.g. 'Says what gets ignored and why'" class="crit-label" style="grid-column: 1 / -1; font-size:0.9rem; color: var(--ink-2)">
            </div>`
            )
            .join("")}
        </div>
        <div class="oe-foot">
          <button class="btn btn-ghost btn-sm" data-act="addcrit" type="button">+ criterion</button>
          <label style="font-weight:400; font-size:0.9rem; display:flex; gap:0.5rem; align-items:center; flex:1; margin:0">
            <span class="muted" style="white-space:nowrap">Common misconceptions</span>
            <input type="text" data-f="common_misconceptions" value="${esc((o.common_misconceptions || []).join("; "))}" placeholder="separate with ;" style="padding:0.4rem 0.6rem; font-size:0.9rem">
          </label>
        </div>`;
      el.addEventListener("focusin", () => {
        selected = i;
        preview();
      });
      host.appendChild(el);
    });
    preview();
  }

  function preview() {
    const o = outcomes[selected];
    if (!o) return;
    $("pv-pos").textContent = `Outcome ${selected + 1} of ${outcomes.length}`;
    $("pv-slide").textContent = o.slide_ref || "";
    $("pv-prompt").textContent = o.prompt || "(no prompt yet)";
    $("pv-rubric").innerHTML = (o.criteria || [])
      .filter((c) => c.text)
      .map((c, k) => `<li><span class="tick" aria-hidden="true"></span><span>${esc(c.student_label || "Point " + (k + 1) + ": something the lecturer expects you to cover")}</span></li>`)
      .join("");
  }

  function readBack() {
    document.querySelectorAll(".outcome-edit").forEach((el) => {
      const i = Number(el.dataset.i);
      const o = outcomes[i];
      el.querySelectorAll("[data-f]").forEach((inp) => {
        const f = inp.dataset.f;
        if (f === "common_misconceptions") o[f] = inp.value.split(";").map((s) => s.trim()).filter(Boolean);
        else o[f] = inp.value;
      });
      el.querySelectorAll(".crit-row[data-k]").forEach((row) => {
        const k = Number(row.dataset.k);
        const c = o.criteria[k];
        c.text = row.querySelector('[data-cf="text"]').value;
        c.student_label = row.querySelector('[data-cf="student_label"]').value;
        c.answer_terms = row.querySelector('[data-cf="answer_terms"]').value.split(",").map((s) => s.trim()).filter(Boolean);
      });
    });
  }

  function scheduleSave() {
    $("save-status").textContent = "Saving…";
    clearTimeout(timer);
    timer = setTimeout(save, 700);
  }

  async function save() {
    readBack();
    const body = { title: $("week-title").value, outcomes };
    try {
      const r = await fetch(`/api/week/${weekId}/outcomes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      $("save-status").textContent = "All changes saved";
    } catch (e) {
      $("save-status").textContent = "Could not save: " + e.message;
    }
  }

  $("outcomes").addEventListener("input", (e) => {
    readBack();
    preview();
    scheduleSave();
  });
  $("week-title").addEventListener("input", scheduleSave);

  $("outcomes").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    readBack();
    const card = btn.closest(".outcome-edit");
    const i = Number(card.dataset.i);
    const act = btn.dataset.act;
    if (act === "del") {
      if (!confirm("Delete this outcome? Students' past attempts on it are kept for the report.")) return;
      outcomes.splice(i, 1);
      selected = Math.max(0, Math.min(selected, outcomes.length - 1));
    } else if (act === "up" && i > 0) {
      [outcomes[i - 1], outcomes[i]] = [outcomes[i], outcomes[i - 1]];
      selected = i - 1;
    } else if (act === "down" && i < outcomes.length - 1) {
      [outcomes[i + 1], outcomes[i]] = [outcomes[i], outcomes[i + 1]];
      selected = i + 1;
    } else if (act === "addcrit") {
      outcomes[i].criteria.push({ id: null, text: "", student_label: "", answer_terms: [] });
    } else if (act === "delcrit") {
      const k = Number(btn.closest(".crit-row").dataset.k);
      outcomes[i].criteria.splice(k, 1);
    } else return;
    render();
    scheduleSave();
  });

  $("add-outcome").addEventListener("click", () => {
    readBack();
    outcomes.push({ id: null, title: "", prompt: "Explain in your own words: ", slide_ref: "", criteria: [{ id: null, text: "", student_label: "", answer_terms: [] }, { id: null, text: "", student_label: "", answer_terms: [] }], common_misconceptions: [] });
    selected = outcomes.length - 1;
    render();
    const last = document.querySelector(".outcome-edit:last-child input");
    if (last) last.focus();
    scheduleSave();
  });

  async function setPublish(publish) {
    clearTimeout(timer);
    await save();
    const r = await fetch(`/api/week/${weekId}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publish }) });
    if (r.ok) location.reload();
    else {
      const d = await r.json().catch(() => ({}));
      $("save-status").textContent = "Cannot publish yet: " + (d.error || r.statusText);
    }
  }
  const pub = $("publish");
  if (pub) pub.addEventListener("click", () => setPublish(true));
  const unpub = $("unpublish");
  if (unpub) unpub.addEventListener("click", () => setPublish(false));

  render();
})();
