/* Rendering: boxes, commit chart, scenario picker, commands, feedback, terminal, animations. */
(function () {
  "use strict";
  const G = window.GV, S = G.S, ui = G.ui, { esc, plural } = G;
  const $ = (id) => document.getElementById(id);
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const seen = {};
  let lastCommitIds = new Set();
  G.resetRenderMemory = () => { Object.keys(seen).forEach((k) => delete seen[k]); lastCommitIds = new Set(); };

  /* ---------- the four boxes ---------- */
  function renderList(ulId, items) {
    const ul = $(ulId);
    const prev = seen[ulId] || new Set(), next = new Set();
    ul.replaceChildren();
    items.forEach((it) => {
      const li = h("li", it.cls || "");
      next.add(it.key);
      if (!prev.has(it.key) && !it.noAnim) li.classList.add("enter");
      it.build(li);
      ul.appendChild(li);
    });
    seen[ulId] = next;
  }
  const emptyItem = (key, text) => ({ key, cls: "empty", noAnim: true, build: (li) => { li.textContent = text; } });
  const metaItem = (key, text, cls) => ({ key, cls: cls || "meta", noAnim: true, build: (li) => { li.textContent = text; } });
  const badge = (t, c) => h("span", `badge ${c}`, t);

  function commitItems(tip, who) {
    if (!tip) return [];
    const ids = [...G.ancestors(tip)].sort((a, b) => G.bySeq(b, a));
    const items = ids.slice(0, 4).map((id) => ({ key: `${who}:${id}`, build: (li) => li.append(h("span", "hash", id), h("span", "msg", S.commits[id].msg)) }));
    if (ids.length > 4) items.push({ key: `${who}:more${ids.length}`, cls: "more", noAnim: true, build: (li) => { li.textContent = `...and ${ids.length - 4} older`; } });
    return items;
  }

  function renderZones() {
    ["wd", "stage", "local"].forEach((z) => $("z-" + z).classList.toggle("absent", !S.hasLocal));
    $("z-remote").classList.toggle("absent", !S.hasRemote);

    if (!S.hasLocal) renderList("wd-body", [emptyItem("e-wd0", "No project folder yet")]);
    else {
      const files = G.fileList();
      renderList("wd-body", files.length ? files.map((f) => {
        const bs = [];
        if (f.conflicted) bs.push(["conflict", "b-red"]);
        if (f.untracked) bs.push(["untracked", "b-red"]);
        if (f.unstaged) bs.push(["modified", "b-amber"]);
        if (f.staged) bs.push(["staged", "b-green"]);
        if (f.ignored) bs.push(["ignored", "b-muted"]);
        if (!bs.length) bs.push(["clean", "b-muted"]);
        return { key: `${f.name}|${bs.map((b) => b[0]).join("+")}|${f.w}`, build: (li) => { li.append(h("span", "fname", f.name)); const w = h("span", "badges"); bs.forEach((b) => w.append(badge(...b))); li.append(w); } };
      }) : [emptyItem("e-wd1", "No files yet. Edit a file.")]);
    }

    if (!S.hasLocal) renderList("stage-body", [emptyItem("e-st0", "No repository yet")]);
    else {
      const st = G.staged();
      renderList("stage-body", st.length ? st.map((f) => ({ key: `${f.name}:${f.i}`, build: (li) => { li.append(h("span", "fname", f.name)); li.append(badge(f.isNew ? "new file" : "modified", "b-green")); } })) : [emptyItem("e-st1", S.conflict ? "Merge in progress" : "Nothing staged")]);
    }

    if (!S.hasLocal) renderList("local-body", [emptyItem("e-lo0", "No repository yet. Try git init or git clone.")]);
    else {
      const items = [metaItem(`meta:${S.head}:${S.conflict ? "m" : ""}`, `HEAD -> ${S.head}${S.conflict ? "  (merging)" : ""}`)];
      const bs = Object.keys(S.local.branches);
      if (bs.length > 1) items.push(metaItem(`br:${bs.join(",")}:${S.head}`, `Branches: ${bs.map((b) => (b === S.head ? `* ${b}` : b)).join(", ")}`, "meta soft"));
      if (S.stash.length) items.push(metaItem(`stash:${S.stash.length}`, `Stash: ${plural(S.stash.length, "shelf")} saved`, "meta soft"));
      const tags = Object.keys(S.local.tags);
      if (tags.length) items.push(metaItem(`tags:${tags.join(",")}`, `Tags: ${tags.join(", ")}`, "meta soft"));
      const L = G.headId();
      renderList("local-body", items.concat(L ? commitItems(L, `L${S.head}`) : [emptyItem("e-lo1", "No commits yet")]));
    }

    if (!S.hasRemote) renderList("remote-body", [emptyItem("e-re0", "No repository on GitHub yet")]);
    else {
      const bs = Object.keys(S.remote.branches);
      const items = [metaItem("rmeta", bs.length ? `Branches on GitHub: ${bs.join(", ")}` : "main on GitHub")];
      S.prs.forEach((p) => items.push({ key: `pr${p.n}:${p.state}:${p.approved}:${(G.latestRun(S.remote.branches[p.from]) || {}).status}`, cls: `pr ${p.state}`, build: (li) => {
        li.append(h("span", "fname", `PR #${p.n}  ${p.from} -> ${p.base}`));
        const w = h("span", "badges");
        w.append(badge(p.state === "merged" ? "merged" : p.approved ? "approved" : "open", p.state === "merged" ? "b-purple" : p.approved ? "b-green" : "b-amber"));
        const chk = p.state === "open" && G.latestRun(S.remote.branches[p.from]);
        if (chk) w.append(badge(`checks ${chk.status}`, chk.status === "passed" ? "b-green" : "b-red"));
        li.append(w);
      } }));
      S.issues.forEach((i) => items.push({ key: `is${i.n}:${i.state}`, cls: "pr", build: (li) => { li.append(h("span", "fname", `Issue #${i.n}  ${i.title}`)); li.append(badge(i.state, i.state === "open" ? "b-green" : "b-purple")); } }));
      S.runs.slice(-2).forEach((r) => items.push({ key: `run${r.n}:${r.status}`, cls: "pr", build: (li) => { li.append(h("span", "fname", `Actions: CI #${r.n} on ${r.branch}`)); li.append(badge(r.status, r.status === "passed" ? "b-green" : "b-red")); } }));
      const R = S.remote.branches.main;
      renderList("remote-body", items.concat(R ? commitItems(R, "Rmain") : [emptyItem("e-re1", "Empty repository")]));
    }
  }

  /* ---------- commit chart (SVG) ---------- */
  function renderGraph() {
    const box = $("graph");
    const ids = G.visibleIds();
    if (!ids.length) { box.innerHTML = '<div class="empty">No commits yet. Your history will grow here, one dot per commit.</div>'; lastCommitIds = new Set(); return; }

    // When main has diverged, the commits off the main line get their own row so the fork is visible.
    const tips = [S.local.branches.main, S.local.tracking.main, S.remote.branches.main].filter(Boolean);
    const top = tips.find((t) => tips.every((o) => G.isAnc(o, t))) || S.local.branches.main || tips[0];
    const chain = new Set();
    for (let c = top; c; c = S.commits[c].parents[0]) chain.add(c);
    const laneOf = (id) => { const l = S.commits[id].lane; return l === "main" && top && !chain.has(id) ? "main~" : l; };
    const used = new Set(ids.map(laneOf));
    const lanes = [];
    S.lanes.forEach((l) => { if (used.has(l)) lanes.push(l); if (used.has(l + "~")) lanes.push(l + "~"); });
    const laneIdx = (l) => lanes.indexOf(l);

    const pills = {};
    const addPill = (id, p) => { (pills[id] = pills[id] || []).push(p); };
    Object.entries(S.local.branches).forEach(([n, t]) => addPill(t, { k: "local", t: n === S.head ? `HEAD -> ${n}` : n, lane: n }));
    Object.entries(S.local.tracking).forEach(([n, t]) => addPill(t, { k: "track", t: `origin/${n}`, lane: n }));
    Object.entries(S.remote.branches).forEach(([n, t]) => addPill(t, { k: "remote", t: `GitHub: ${n}`, lane: n }));
    Object.entries(S.local.tags).forEach(([n, t]) => addPill(t, { k: S.remote.tags[n] === t ? "tag" : "tag unpushed", t: `tag: ${n}`, lane: S.commits[t].lane }));
    const maxPills = Math.max(1, ...ids.map((i) => (pills[i] || []).length));
    const GX0 = 130, GDX = 116, GY0 = 50 + maxPills * 24, GDY = 120 + 18 * (maxPills - 1);
    const pos = {};
    ids.forEach((id, i) => { pos[id] = { x: GX0 + i * GDX, y: GY0 + laneIdx(laneOf(id)) * GDY }; });
    const width = GX0 + ids.length * GDX + 30, height = GY0 + (lanes.length - 1) * GDY + 90;
    const colorIdx = (lane) => (lane.endsWith("~") ? S.lanes.length + S.lanes.indexOf(lane.slice(0, -1)) : Math.max(0, S.lanes.indexOf(lane)));
    const lc = (lane) => `--lc:var(--b${colorIdx(lane) % 6})`;
    const laneName = (l) => (l.endsWith("~") ? `${l.slice(0, -1)} (other)` : l);

    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Commit history chart">`;
    lanes.forEach((l) => {
      const y = GY0 + laneIdx(l) * GDY;
      svg += `<g style="${lc(l)}"><line class="g-lane-line" x1="${GX0 - 40}" y1="${y}" x2="${width}" y2="${y}"/><text class="g-lane-name" x="10" y="${y + 4}">${esc(laneName(l))}</text></g>`;
    });
    ids.forEach((id) => {
      const c = S.commits[id];
      c.parents.forEach((p, idx) => {
        if (!pos[p]) return;
        const a = pos[p], b = pos[id];
        const lane = c.parents.length > 1 && idx > 0 ? laneOf(p) : laneOf(id);
        const d = a.y === b.y ? `M${a.x} ${a.y} L${b.x} ${b.y}` : `M${a.x} ${a.y} C${a.x + GDX / 2} ${a.y}, ${b.x - GDX / 2} ${b.y}, ${b.x} ${b.y}`;
        svg += `<path class="g-edge${S.local.objs.has(id) ? "" : " dashed"}" style="${lc(lane)}" d="${d}"/>`;
      });
    });
    ids.forEach((id) => {
      const c = S.commits[id], { x, y } = pos[id];
      const inL = S.local.objs.has(id), inR = S.remote.objs.has(id);
      const kind = inL && inR ? "full" : inL ? "local" : "remote";
      const pop = lastCommitIds.has(id) ? "" : "pop";
      const short = c.msg.length > 17 ? c.msg.slice(0, 16) + "..." : c.msg;
      const by = c.author === "teammate" ? "by teammate" : c.author === "github" ? "by GitHub" : "";
      svg += `<g class="g-node ${kind}" style="${lc(laneOf(id))}"><title>${esc(id)}: ${esc(c.msg)}${by ? ` (${by})` : ""}</title>`;
      svg += `<circle class="${pop}" cx="${x}" cy="${y}" r="13"/>`;
      svg += `<text class="g-hash" x="${x}" y="${y + 34}">${id}</text><text class="g-msg" x="${x}" y="${y + 50}">${esc(short)}</text>`;
      if (by) svg += `<text class="g-msg" x="${x}" y="${y + 64}">${by}</text>`;
      svg += "</g>";
      (pills[id] || []).forEach((p, i) => {
        const w = p.t.length * 7.1 + 18, py = y - 34 - i * 24;
        svg += `<g class="g-pill ${p.k}" style="${lc(p.lane)}"><rect x="${x - w / 2}" y="${py - 10}" width="${w}" height="20" rx="10"/><text x="${x}" y="${py}">${esc(p.t)}</text></g>`;
      });
    });
    box.innerHTML = svg + "</svg>";
    lastCommitIds = new Set(ids);
    const sc = $("graph-scroll");
    sc.scrollLeft = sc.scrollWidth;
  }

  /* ---------- scenario picker + mission ---------- */
  G.renderScenarios = (onPick, onFree) => {
    const wrap = $("scenarios");
    wrap.replaceChildren();
    G.SCENARIOS.forEach((s, i) => {
      const b = h("button", "scn");
      b.type = "button";
      b.setAttribute("aria-pressed", String(ui.scn === s.id));
      if (ui.done.has(s.id)) b.classList.add("done");
      b.append(h("span", "scn-num", String(i + 1)), h("span", "scn-title", s.title));
      b.title = s.blurb;
      b.addEventListener("click", () => onPick(s.id));
      wrap.append(b);
    });
    const f = h("button", "scn free");
    f.type = "button";
    f.setAttribute("aria-pressed", String(ui.scn === null));
    f.append(h("span", "scn-title", "Free play"));
    f.title = "No checklist. Start from an empty sandbox and try anything.";
    f.addEventListener("click", onFree);
    wrap.append(f);
  };
  G.renderMission = (onPick) => {
    const box = $("mission");
    box.replaceChildren();
    const s = G.scenario();
    if (!s) { box.append(h("p", "mission-note", "Free play: no checklist. Follow the guide in Step 1, or try any command.")); return; }
    const idx = G.SCENARIOS.indexOf(s);
    const head = h("div", "mission-head");
    const done = s.checklist.filter((c) => (S.ev[c.ev] || 0) > 0).length;
    head.append(h("strong", "", `Scenario ${idx + 1}: ${s.title}`), h("span", "mission-count", `${done} of ${s.checklist.length} done`));
    const ul = h("ul", "checklist");
    s.checklist.forEach((c) => {
      const li = h("li", (S.ev[c.ev] || 0) > 0 ? "ticked" : "", c.text);
      ul.append(li);
    });
    box.append(head, ul);
    if (G.scenarioComplete(s)) {
      ui.done.add(s.id);
      const next = G.SCENARIOS[idx + 1];
      const row = h("div", "mission-done");
      row.append(h("span", "", "Scenario complete!"));
      if (next) {
        const nb = h("button", "btn primary", `Next: ${next.title}`);
        nb.type = "button";
        nb.addEventListener("click", () => onPick(next.id));
        row.append(nb);
      }
      box.append(row);
    }
  };

  /* ---------- situation, hint, tabs, commands ---------- */
  G.renderSituation = () => { $("situation").innerHTML = G.coach().situation; };
  G.renderHint = () => {
    const box = $("hint");
    box.replaceChildren();
    const c = G.coach();
    if (c.complete || !c.best.length) return;
    const a = G.ACTION[c.best[0]];
    if (!ui.hint) {
      const b = h("button", "btn", "Not sure? Show me a hint");
      b.type = "button";
      b.addEventListener("click", () => { ui.hint = true; G.renderTabs(); G.renderActions(); G.renderHint(); });
      box.append(b);
      return;
    }
    const t = h("span", "hint-text");
    t.innerHTML = `Hint: look for <code>${esc(a.btn)}</code> in the <b>${esc(G.TABS.find((x) => x.id === a.tab).name)}</b> group.`;
    box.append(t);
    if (a.tab !== ui.tab) {
      const go = h("button", "btn", "Open that group");
      go.type = "button";
      go.addEventListener("click", () => { ui.tab = a.tab; G.renderTabs(); G.renderActions(); });
      box.append(go);
    }
  };
  G.renderTabs = () => {
    const wrap = $("tabs");
    wrap.replaceChildren();
    G.TABS.forEach((t) => {
      const b = h("button", "tab", t.name);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(t.id === ui.tab));
      b.addEventListener("click", () => { ui.tab = t.id; G.renderTabs(); G.renderActions(); G.renderHint(); });
      wrap.append(b);
    });
    $("tab-intro").textContent = G.TABS.find((t) => t.id === ui.tab).intro;
  };
  G.renderActions = () => {
    const wrap = $("actions");
    wrap.replaceChildren();
    const c = G.coach();
    if (["daily", "undo"].includes(ui.tab)) {
      const row = h("div", "msgrow");
      const lab = h("label", "", "Commit message (what you changed, in your own words):");
      lab.htmlFor = "msg-input";
      const inp = h("input");
      inp.id = "msg-input";
      inp.type = "text";
      inp.maxLength = 60;
      inp.placeholder = "optional, e.g. Add login page";
      inp.value = ui.msg;
      inp.addEventListener("input", () => { ui.msg = inp.value; });
      row.append(lab, inp);
      wrap.append(row);
    }
    G.ACTIONS.filter((a) => a.tab === ui.tab).forEach((a) => {
      const b = h("button", "act");
      b.type = "button";
      if (a.can && a.can()) b.classList.add("blocked");
      if (ui.hint && c.best.includes(a.id)) b.classList.add("suggested");
      b.append(h("span", "cmd", a.btn), h("span", "desc", a.desc));
      const when = h("span", "when");
      when.innerHTML = `<b>Use it:</b> ${esc(a.when)}`;
      b.append(when);
      if (a.ro) b.append(h("span", "ro", "only looks, changes nothing"));
      b.addEventListener("click", () => G.runAction(a));
      wrap.append(b);
    });
  };

  /* ---------- feedback + terminal ---------- */
  G.showFeedback = (e, verdict) => {
    const box = $("explain");
    let html = "";
    if (verdict) html += `<div class="verdict ${verdict.kind}"><div class="v-label">${esc(verdict.label)}</div>${verdict.html}</div>`;
    if (e) {
      html += `<div class="ex-section">${verdict ? "What this command does" : ""}</div><div class="ex-title">${esc(e.title)}</div><p class="ex-what">${e.what}</p>`;
      if (e.steps && e.steps.length) html += `<h4>${e.stepsTitle || "Behind the scenes"}</h4><ul>${e.steps.map((s) => `<li>${s}</li>`).join("")}</ul>`;
      if (e.tip) html += `<div class="ex-tip">${e.tip}</div>`;
    }
    if (verdict && verdict.kind !== "wrong") html += '<p class="v-next">Your turn again. Step 1 now describes where you are, so read it and pick your next command.</p>';
    if (verdict && verdict.kind === "wrong") html += '<p class="v-next">Nothing changed. Pick another command in Step 2.</p>';
    box.innerHTML = html;
    box.classList.remove("fade");
    void box.offsetWidth;
    box.classList.add("fade");
  };
  const term = () => $("terminal");
  G.promptStr = () => (S.hasLocal ? `~/${G.REPO} (${S.head})$ ` : "~$ ");
  G.printLine = (l, cls) => {
    const t = typeof l === "string" ? l : l.t;
    let c = typeof l === "string" ? cls || "" : l.c || "";
    if (!c) c = /^(fatal|error)/.test(t) ? "err" : /^hint/.test(t) ? "hint" : "out";
    term().append(h("div", `ln ${c}`, t === "" ? "\u00a0" : t));
  };
  G.printCmd = (cmds, prompt) => {
    [].concat(cmds).forEach((c) => {
      const d = h("div", "ln");
      if (c.startsWith("#")) d.append(h("span", "comment", c));
      else d.append(h("span", "prompt", prompt), h("span", "cmdtext", c));
      term().append(d);
    });
  };
  G.trimTerm = () => {
    const t = term();
    while (t.childElementCount > 140) t.firstElementChild.remove();
    t.scrollTop = t.scrollHeight;
  };
  G.clearTerm = () => term().replaceChildren();

  /* ---------- animation ---------- */
  const zoneEl = (z) => $("z-" + z);
  G.fly = (from, to, label, delay) => {
    if (REDUCED) return Promise.resolve();
    const a = zoneEl(from).getBoundingClientRect(), b = zoneEl(to).getBoundingClientRect();
    const chip = h("div", "fly", label);
    document.body.append(chip);
    const w = chip.offsetWidth, hgt = chip.offsetHeight, same = from === to;
    const x1 = a.left + a.width / 2 - w / 2, y1 = same ? a.top - hgt - 30 : a.top + a.height / 2 - hgt / 2;
    const x2 = b.left + b.width / 2 - w / 2, y2 = same ? a.top + a.height / 2 - hgt / 2 : b.top + b.height / 2 - hgt / 2;
    const anim = chip.animate(
      [
        { transform: `translate(${x1}px, ${y1}px) scale(0.8)`, opacity: 0 },
        { transform: `translate(${x1}px, ${y1}px) scale(1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${x2}px, ${y2}px) scale(1)`, opacity: 1, offset: 0.85 },
        { transform: `translate(${x2}px, ${y2}px) scale(0.8)`, opacity: 0 },
      ],
      { duration: 1100, delay: delay || 0, easing: "ease-in-out", fill: "both" }
    );
    return anim.finished.then(() => chip.remove(), () => chip.remove());
  };
  G.flash = (ids, zones) => {
    ids.forEach((id) => {
      const el = zones ? zoneEl(id) : $(id);
      if (!el) return;
      el.classList.remove("pulse");
      void el.offsetWidth;
      el.classList.add(zones ? "pulse" : "active");
    });
  };
  G.clearFlash = () => {
    document.querySelectorAll(".zone.pulse").forEach((e) => e.classList.remove("pulse"));
    document.querySelectorAll(".link.active").forEach((e) => e.classList.remove("active"));
  };
  G.REDUCED = REDUCED;
  G.renderBoxes = () => { renderZones(); renderGraph(); };
})();
