/* Wiring: run an action, judge the choice, scenarios, reset, theme. */
(function () {
  "use strict";
  const G = window.GV, S = G.S, ui = G.ui, { esc, ex } = G;
  const $ = (id) => document.getElementById(id);
  G.ACTION = Object.fromEntries(G.ACTIONS.map((a) => [a.id, a]));

  const nextStep = (c, exceptId) => {
    const id = c.best[0];
    return id && id !== exceptId ? `<p class="v-next"><b>Better next step:</b> <code>${esc(G.ACTION[id].btn)}</code>. ${c.reasons[id]}</p>` : "";
  };

  G.renderAll = () => {
    G.renderBoxes();
    G.renderScenarios(pickScenario, startFree);
    G.renderMission(pickScenario);
    G.renderSituation();
    G.renderHint();
    G.renderTabs();
    G.renderActions();
  };

  G.runAction = async (a) => {
    if (ui.busy) return;
    const before = G.coach();
    const prompt = G.promptStr();
    const block = a.can && a.can();
    if (block) {
      G.printCmd(a.cmd, prompt);
      (block.out || []).forEach((l) => G.printLine(l));
      G.trimTerm();
      G.showFeedback(null, { kind: "wrong", label: "Not quite. This would fail right now", html: `<p>${esc(block.why)}</p>${nextStep(before, a.id)}` });
      return;
    }
    ui.busy = true;
    ui.hint = false;
    document.body.classList.add("busy");
    const wasComplete = G.scenarioComplete(G.scenario());
    const r = a.run();
    G.printCmd(r.cmd, prompt);
    G.trimTerm();
    G.flash(r.zones || [], true);
    G.flash(r.links || [], false);
    await Promise.all((r.anim || []).map((x) => G.fly(x.from, x.to, x.label, x.delay)));
    const failed = !!(r.explain && r.explain.warn);
    if (!failed) S.ev[a.id] = (S.ev[a.id] || 0) + 1;
    (r.events || []).forEach((e) => { S.ev[e] = (S.ev[e] || 0) + 1; });
    G.renderAll();
    (r.out || []).forEach((l) => G.printLine(l));
    G.trimTerm();
    const after = G.coach();
    let verdict;
    if (failed && before.best.includes(a.id)) {
      verdict = { kind: "ok", label: "This error was expected. Here is what it means", html: `<p>${before.reasons[a.id]}</p>${nextStep(after, a.id)}` };
    } else if (failed) {
      verdict = { kind: "wrong", label: "Not quite. Git refused this", html: `<p>${r.explain.what}</p>${nextStep(after, a.id)}` };
    } else if (before.best.includes(a.id)) {
      verdict = { kind: "right", label: "Right choice", html: `<p>${before.reasons[a.id]}</p>` };
    } else {
      const note = before.fine[a.id] || (a.ro ? "Checking like this is always safe: it only looks and changes nothing. Running it often is a great habit." : "That worked, but it is not the step your project needs right now.");
      verdict = { kind: "ok", label: "That worked, but it is not the next step", html: `<p>${note}</p>${nextStep(after, a.id)}` };
    }
    if (!wasComplete && G.scenarioComplete(G.scenario())) verdict.html += "<p><b>Scenario complete!</b> You finished every step on the checklist. Use the button above to move on.</p>";
    G.showFeedback(r.explain, verdict);
    setTimeout(G.clearFlash, G.REDUCED ? 0 : 400);
    document.body.classList.remove("busy");
    ui.busy = false;
  };

  function begin(label, intro) {
    G.resetRenderMemory();
    G.clearTerm();
    G.printLine(label, "comment");
    G.renderAll();
    if (intro) G.showFeedback(intro);
  }
  function pickScenario(id) {
    if (ui.busy) return;
    const s = G.startScenario(id);
    const n = G.SCENARIOS.indexOf(s) + 1;
    const intro = ex(`Scenario ${n}: ${s.title}`, s.intro, s.checklist.map((c) => esc(c.text)), "Read Step 1 on the left, then choose a command in Step 2. Wrong choices are fine: you will be told why.");
    intro.stepsTitle = "Your goal: tick off all of these";
    begin(`Scenario ${n} ready: ${s.title}. Pick a command in Step 2.`, intro);
  }
  function startFree() {
    if (ui.busy) return;
    G.reset();
    ui.scn = null;
    ui.msg = "";
    ui.hint = false;
    ui.tab = "setup";
    begin("Free play. Start from an empty sandbox and try anything.", ex("Free play", "No checklist here. The guide in Step 1 still tells you what is sensible next, but you can try any command in any order.", [], "Not sure what to try? Click through the groups of commands in Step 2."));
  }
  function restart() {
    if (ui.busy) return;
    if (ui.scn) pickScenario(ui.scn);
    else startFree();
  }

  G.practise = (id) => {
    pickScenario(id);
    $("sandbox").scrollIntoView({ behavior: G.REDUCED ? "auto" : "smooth" });
  };

  function welcome() {
    const w = ex(
      "Welcome! Read this first",
      "This is a safe practice area for Git. Nothing you do here touches a real file or a real GitHub account.",
      [
        "<b>Pick a scenario</b> above. Each one is a real situation (starting a project, branching, merge conflicts, pull requests, undoing mistakes). It sets up the sandbox for you.",
        "<b>Step 1</b> always tells you, in plain English, where your project is right now.",
        "<b>Step 2</b> is where you pick a command. Each button says what it does and when to use it. Stuck? Press <b>Show me a hint</b>.",
        "<b>Step 3</b> (here) tells you whether your choice was right, and why. It also explains what the command does.",
        "Watch the four boxes and the commit history while you click. They animate to show exactly what moved where.",
      ],
      "Wrong choices are fine here. Clicking something that would fail shows you the real error message and explains it. That is a fast way to learn."
    );
    w.stepsTitle = "How this sandbox works";
    G.showFeedback(w);
  }

  function initTheme() {
    const tgl = $("theme-toggle");
    const apply = () => {
      const light = document.documentElement.getAttribute("data-theme") === "light";
      tgl.checked = light;
      $("theme-label").textContent = light ? "Light" : "Dark";
    };
    tgl.addEventListener("change", () => {
      const t = tgl.checked ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", t);
      try { localStorage.setItem("gitviz-theme", t); } catch (e) {}
      apply();
    });
    apply();
  }

  $("btn-reset").addEventListener("click", restart);
  initTheme();
  G.startScenario("s1");
  G.resetRenderMemory();
  G.clearTerm();
  G.printLine("Sandbox ready. Scenario 1 is loaded. Pick a command in Step 2.", "comment");
  G.renderAll();
  welcome();
})();
