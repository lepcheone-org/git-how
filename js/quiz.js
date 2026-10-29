/* Quiz mode: "What would you use?" multiple choice, with a reason after every answer. */
(function () {
  "use strict";
  const G = window.GV, { esc } = G;
  const $ = (id) => document.getElementById(id);
  const DATA = window.GV_QUIZ.map(([c, q, a, w, why, s]) => ({ c, q, a, w, why, s }));
  const CATS = [["all", "Everything"], ["vs", "Git vs GitHub"], ["setup", "Setup"], ["daily", "Daily loop"], ["sync", "Syncing"], ["branch", "Branches"], ["merge", "Merge & rebase"], ["github", "Pull requests"], ["undo", "Undo & fix"], ["extras", "Ignore, tags, Issues & Actions"]];
  const st = { cat: "all", len: 10, qs: [], i: 0, score: 0, missed: [], picked: null };
  const page = $("quiz-page"), overlay = $("quiz");
  let opener = null;

  const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const fmt = (t) => (/^(git |\*\.)/.test(t) ? `<code>${esc(t)}</code>` : esc(t));
  const best = () => { try { return JSON.parse(localStorage.getItem("gitviz-quiz-best") || "null"); } catch (e) { return null; } };
  const saveBest = (pct) => { try { const b = best(); if (!b || pct > b) localStorage.setItem("gitviz-quiz-best", JSON.stringify(pct)); } catch (e) {} };
  const count = (cat) => DATA.filter((q) => cat === "all" || q.c === cat).length;

  function menu() {
    const b = best();
    page.innerHTML =
      '<h1 id="quiz-title">Quiz: what would you use?</h1>' +
      "<p class=\"qz-lead\">Short scenarios, four answers each. After every answer you get the reason, so you learn even when you guess wrong.</p>" +
      '<h2 class="qz-h">Topic</h2><div class="qz-chips" id="qz-cats"></div>' +
      '<h2 class="qz-h">How many questions</h2><div class="qz-chips" id="qz-len"></div>' +
      '<div class="qz-start"><button class="btn primary" id="qz-go" type="button">Start quiz</button>' + (b != null ? `<span class="qz-best">Your best score: ${b}%</span>` : "") + "</div>";
    const cats = $("qz-cats"), len = $("qz-len");
    CATS.forEach(([id, name]) => {
      const bt = document.createElement("button");
      bt.type = "button"; bt.className = "scn"; bt.textContent = `${name} (${count(id)})`;
      bt.setAttribute("aria-pressed", String(st.cat === id));
      bt.addEventListener("click", () => { st.cat = id; menu(); });
      cats.append(bt);
    });
    [10, 20, 0].forEach((n) => {
      const bt = document.createElement("button");
      bt.type = "button"; bt.className = "scn"; bt.textContent = n ? String(n) : "All";
      bt.setAttribute("aria-pressed", String(st.len === n));
      bt.addEventListener("click", () => { st.len = n; menu(); });
      len.append(bt);
    });
    $("qz-go").addEventListener("click", start);
  }

  function start() {
    const pool = DATA.filter((q) => st.cat === "all" || q.c === st.cat);
    st.qs = shuffle(pool).slice(0, st.len || pool.length).map((q) => ({ ...q, opts: shuffle([q.a, ...q.w]) }));
    st.i = 0; st.score = 0; st.missed = []; st.picked = null;
    show();
  }

  function show() {
    const q = st.qs[st.i], n = st.qs.length;
    st.picked = null;
    page.innerHTML =
      `<div class="qz-top"><span>Question ${st.i + 1} of ${n}</span><span>Score: ${st.score}</span></div>` +
      `<div class="qz-bar"><i style="width:${(st.i / n) * 100}%"></i></div>` +
      `<h1 class="qz-q" id="quiz-title">${esc(q.q)}</h1>` +
      `<div class="qz-opts">${q.opts.map((o, k) => `<button type="button" class="qz-opt" data-k="${k}"><span class="qz-key">${k + 1}</span><span>${fmt(o)}</span></button>`).join("")}</div>` +
      '<div class="qz-feedback" id="qz-fb" aria-live="polite"></div>';
    page.querySelectorAll(".qz-opt").forEach((b) => b.addEventListener("click", () => answer(+b.dataset.k)));
  }

  function answer(k) {
    if (st.picked !== null) return;
    const q = st.qs[st.i];
    st.picked = k;
    const ok = q.opts[k] === q.a;
    if (ok) st.score++; else st.missed.push(q);
    page.querySelectorAll(".qz-opt").forEach((b, idx) => {
      b.disabled = true;
      if (q.opts[idx] === q.a) b.classList.add("right");
      else if (idx === k) b.classList.add("wrong");
    });
    const last = st.i === st.qs.length - 1;
    $("qz-fb").innerHTML =
      `<div class="verdict ${ok ? "right" : "wrong"}"><div class="v-label">${ok ? "Correct" : "Not quite"}</div>` +
      (ok ? "" : `<p>The answer is: ${fmt(q.a)}</p>`) + `<p>${esc(q.why)}</p></div>` +
      `<button class="btn primary" id="qz-next" type="button">${last ? "See results" : "Next question"}</button>`;
    $("qz-next").addEventListener("click", next);
    $("qz-next").focus();
  }

  function next() {
    if (st.i < st.qs.length - 1) { st.i++; show(); } else results();
  }

  function results() {
    const n = st.qs.length, pct = Math.round((st.score / n) * 100);
    saveBest(pct);
    const msg = pct >= 90 ? "Excellent. You know your way around Git." : pct >= 70 ? "Good work. A few things to revisit." : pct >= 50 ? "A decent start. Practise the topics below in the sandbox." : "Keep going. Use the sandbox scenarios, then try again.";
    page.innerHTML =
      '<h1 id="quiz-title">Results</h1>' +
      `<div class="qz-score"><strong>${st.score} / ${n}</strong><span>${pct}%</span></div><p class="qz-lead">${msg}</p>` +
      (st.missed.length
        ? `<h2 class="qz-h">Review what you missed</h2><ul class="qz-missed">${st.missed.map((q, i) => `<li><b>${esc(q.q)}</b><br>Answer: ${fmt(q.a)}<br><span class="qz-why">${esc(q.why)}</span><br><button class="btn qz-prac" data-i="${i}" type="button">Practise this in the sandbox</button></li>`).join("")}</ul>`
        : '<p class="qz-lead">No mistakes. Perfect round.</p>') +
      '<div class="qz-start"><button class="btn primary" id="qz-again" type="button">Try again</button><button class="btn" id="qz-menu" type="button">Change topic</button><button class="btn" id="qz-done" type="button">Close</button></div>';
    page.querySelectorAll(".qz-prac").forEach((b) => b.addEventListener("click", () => { const s = st.missed[+b.dataset.i].s; close(); G.practise(s); }));
    $("qz-again").addEventListener("click", start);
    $("qz-menu").addEventListener("click", menu);
    $("qz-done").addEventListener("click", close);
  }

  function open() {
    opener = document.activeElement;
    overlay.hidden = false;
    menu();
    $("quiz-close").focus();
  }
  function close() {
    overlay.hidden = true;
    if (opener) opener.focus();
  }
  $("btn-quiz").addEventListener("click", open);
  $("quiz-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (overlay.hidden) return;
    if (e.key === "Escape") close();
    else if (/^[1-4]$/.test(e.key) && st.qs.length && page.querySelector(".qz-opt")) { if (st.picked === null && st.qs[st.i] && +e.key <= st.qs[st.i].opts.length) answer(+e.key - 1); }
  });
})();
