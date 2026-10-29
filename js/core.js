/* Core model: a tiny in-memory Git. Nothing real is touched.
   S holds everything. Commits live once in S.commits; the local repo and GitHub each remember
   which commits they have (objs) and where their branch pointers are. */
(function () {
  "use strict";
  const G = (window.GV = {});
  const S = (G.S = {});

  G.ui = { tab: "setup", msg: "", hint: false, busy: false, scn: "s1", done: new Set() };
  G.REPO = "my-project";
  G.URL_HTTP = "github.com/you/my-project";
  G.URL_SSH = "git@github.com:you/my-project.git";

  G.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  G.plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  G.ex = (title, what, steps, tip, warn) => ({ title, what, steps: steps || [], tip, warn });

  const fresh = () => ({
    configured: false,
    hasLocal: false,
    hasRemote: false,
    linked: false, // is "origin" set up?
    head: "main", // current branch
    commits: {},
    seq: 0,
    nextHash: 1,
    lanes: ["main"],
    local: { objs: new Set(), branches: {}, tracking: {}, tags: {} }, // tracking = origin/<branch>
    remote: { objs: new Set(), branches: {}, tags: {} },
    work: {}, // working folder: name -> content
    index: {}, // staging area: name -> content (mirrors HEAD until you add)
    stash: [],
    reflog: [],
    prs: [],
    issues: [],
    runs: [], // GitHub Actions workflow runs
    conflict: null, // set while a merge has stopped on conflicts
    counters: { edit: 0, team: 0 },
    ev: {}, // events: which actions have been done (used by the scenario checklists)
  });
  G.reset = () => {
    Object.keys(S).forEach((k) => delete S[k]);
    Object.assign(S, fresh());
  };

  /* ---------- commits ---------- */
  G.newHash = () => {
    const n = S.nextHash++;
    return (Math.imul(n + 7919, 2654435761) >>> 0).toString(16).padStart(8, "0").slice(0, 7);
  };
  G.ensureLane = (l) => { if (!S.lanes.includes(l)) S.lanes.push(l); };
  G.mkCommit = (parents, msg, snap, lane, author) => {
    const id = G.newHash();
    S.commits[id] = { id, parents, msg, snap, lane, author: author || "you", seq: ++S.seq };
    G.ensureLane(lane);
    return id;
  };
  G.ancestors = (id) => {
    const out = new Set();
    const stack = [id];
    while (stack.length) {
      const c = stack.pop();
      if (!c || out.has(c)) continue;
      out.add(c);
      stack.push(...S.commits[c].parents);
    }
    return out;
  };
  G.isAnc = (a, b) => G.ancestors(b).has(a);
  G.give = (objs, id) => G.ancestors(id).forEach((c) => objs.add(c));
  G.snapOf = (id) => (id ? S.commits[id].snap : {});
  G.headId = () => S.local.branches[S.head];
  G.headSnap = () => G.snapOf(G.headId());
  G.logHead = (text) => S.reflog.push({ id: G.headId(), text });
  G.bySeq = (a, b) => S.commits[a].seq - S.commits[b].seq;
  G.mergeBase = (a, b) => {
    const B = G.ancestors(b);
    let best = null;
    G.ancestors(a).forEach((c) => { if (B.has(c) && (!best || S.commits[c].seq > S.commits[best].seq)) best = c; });
    return best;
  };
  G.aheadBehind = (b) => {
    b = b || S.head;
    const L = S.local.branches[b], T = S.local.tracking[b];
    if (!T) return null;
    const aL = L ? G.ancestors(L) : new Set(), aT = G.ancestors(T);
    let ahead = 0, behind = 0;
    aL.forEach((c) => { if (!aT.has(c)) ahead++; });
    aT.forEach((c) => { if (!aL.has(c)) behind++; });
    return { ahead, behind };
  };
  // Commits worth drawing: anything reachable from a branch, tag or origin/* bookmark.
  G.visibleIds = () => {
    const roots = [...Object.values(S.local.branches), ...Object.values(S.local.tracking), ...Object.values(S.remote.branches), ...Object.values(S.local.tags), ...Object.values(S.remote.tags)];
    const set = new Set();
    roots.forEach((r) => G.ancestors(r).forEach((c) => set.add(c)));
    return [...set].filter((c) => S.local.objs.has(c) || S.remote.objs.has(c)).sort(G.bySeq);
  };

  /* ---------- files ---------- */
  G.isIgnored = (n) => {
    const g = S.work[".gitignore"];
    if (!g || n === ".gitignore") return false;
    return g.split("\n").some((raw) => {
      const p = raw.trim();
      if (!p || p[0] === "#") return false;
      return p.startsWith("*.") ? n.endsWith(p.slice(1)) : n === p;
    });
  };
  G.fileList = () => {
    const hs = G.headSnap();
    const names = [...new Set([...Object.keys(S.work), ...Object.keys(S.index)])];
    return names.map((name) => {
      const w = S.work[name], i = S.index[name], h = hs[name];
      const conflicted = !!(S.conflict && S.conflict.files.includes(name));
      const tracked = i !== undefined;
      const ignored = !tracked && G.isIgnored(name);
      return {
        name, w, i, h, conflicted, ignored,
        untracked: !tracked && !ignored && !conflicted,
        staged: tracked && i !== h && !conflicted,
        unstaged: tracked && w !== i && !conflicted,
        isNew: tracked && h === undefined,
      };
    });
  };
  G.staged = () => G.fileList().filter((f) => f.staged);
  G.unstaged = () => G.fileList().filter((f) => f.unstaged);
  G.untracked = () => G.fileList().filter((f) => f.untracked);
  G.conflicted = () => G.fileList().filter((f) => f.conflicted);
  G.dirtyNames = () => G.fileList().filter((f) => f.staged || f.unstaged || f.conflicted).map((f) => f.name);
  G.contentFor = (name) => `${name}: edit ${++S.counters.edit} on ${S.head}`;
  // Tracked files with changes that switching to / merging in `snap` would overwrite.
  G.wouldOverwrite = (snap) => {
    const hs = G.headSnap();
    return G.dirtyNames().filter((n) => snap[n] !== hs[n]);
  };
  // Replace the folder + staging area with a snapshot. Untracked files stay. Names in `keep` are left alone.
  G.checkoutSnap = (snap, keepNames) => {
    const keep = new Set(keepNames || []);
    Object.keys(S.index).forEach((n) => {
      if (!(n in snap) && !keep.has(n)) { delete S.index[n]; delete S.work[n]; }
    });
    Object.entries(snap).forEach(([n, c]) => {
      if (keep.has(n)) return;
      S.index[n] = c;
      S.work[n] = c;
    });
  };

  // File-level three-way merge. Same file changed differently on both sides = conflict.
  G.mergeSnaps = (base, ours, theirs, label) => {
    const out = {}, conflicts = [], detail = {};
    new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]).forEach((n) => {
      const b = base[n], o = ours[n], t = theirs[n];
      let r;
      if (o === t) r = o;
      else if (o === b) r = t;
      else if (t === b) r = o;
      else {
        conflicts.push(n);
        detail[n] = { ours: o, theirs: t };
        r = `<<<<<<< HEAD\n${o === undefined ? "" : o}\n=======\n${t === undefined ? "" : t}\n>>>>>>> ${label}`;
      }
      if (r !== undefined) out[n] = r;
    });
    return { snap: out, conflicts, detail };
  };

  /* ---------- operations shared by actions and scenario presets ---------- */
  G.opRemoteCreate = (withReadme) => {
    S.hasRemote = true;
    if (withReadme) {
      const id = G.mkCommit([], "Initial commit", { "README.md": "# my-project" }, "main", "you");
      G.give(S.remote.objs, id);
      S.remote.branches.main = id;
    }
  };
  G.opClone = () => {
    S.hasLocal = true;
    S.linked = true;
    Object.values(S.remote.branches).forEach((id) => G.give(S.local.objs, id));
    S.local.tracking = { ...S.remote.branches };
    S.local.tags = { ...S.remote.tags };
    S.local.branches.main = S.remote.branches.main;
    S.head = "main";
    G.checkoutSnap(G.snapOf(S.remote.branches.main));
    G.logHead(`clone: from ${G.URL_SSH}`);
  };
  G.opStageAll = () => {
    const names = [];
    G.fileList().forEach((f) => {
      if (f.unstaged || f.untracked || f.conflicted) { S.index[f.name] = f.w; names.push(f.name); }
    });
    if (S.conflict) S.conflict.files = S.conflict.files.filter((n) => !names.includes(n));
    return names;
  };
  G.opCommitIndex = (msg, opts) => {
    opts = opts || {};
    const L = G.headId();
    const id = G.mkCommit(opts.parents || (L ? [L] : []), msg, { ...S.index }, S.head, opts.author || "you");
    G.give(S.local.objs, id);
    S.local.branches[S.head] = id;
    G.logHead(`commit${L ? "" : " (initial)"}: ${msg}`);
    return id;
  };
  G.opNewBranch = (name) => {
    const from = S.head;
    S.local.branches[name] = G.headId();
    G.ensureLane(name);
    S.head = name;
    G.logHead(`checkout: moving from ${from} to ${name}`);
  };
  G.opSwitch = (name) => {
    const snap = G.snapOf(S.local.branches[name]);
    const over = G.wouldOverwrite(snap);
    if (over.length) return { kind: "blocked", files: over };
    const dirty = G.dirtyNames(), from = S.head;
    S.head = name;
    G.checkoutSnap(snap, dirty);
    G.logHead(`checkout: moving from ${from} to ${name}`);
    return { kind: "ok" };
  };
  G.opPush = (force) => {
    const b = S.head, L = G.headId(), R = S.remote.branches[b];
    if (R === L) return { kind: "uptodate" };
    if (R && !force && !G.isAnc(R, L)) return { kind: "rejected", R, L, known: S.local.objs.has(R) };
    const count = [...G.ancestors(L)].filter((c) => !S.remote.objs.has(c)).length;
    const first = !S.local.tracking[b];
    G.give(S.remote.objs, L);
    S.remote.branches[b] = L;
    S.local.tracking[b] = L;
    return { kind: "ok", old: R, L, count, first, forced: !!(force && R && !G.isAnc(R, L)) };
  };
  G.opFetch = () => {
    const ups = [], tags = [];
    Object.entries(S.remote.branches).forEach(([b, id]) => {
      const old = S.local.tracking[b];
      if (old !== id) { G.give(S.local.objs, id); S.local.tracking[b] = id; ups.push({ b, old, id }); }
    });
    Object.entries(S.remote.tags).forEach(([t, id]) => {
      if (S.local.tags[t] !== id) { S.local.tags[t] = id; G.give(S.local.objs, id); tags.push(t); }
    });
    return { ups, tags };
  };
  G.opPrune = () => {
    const gone = Object.keys(S.local.tracking).filter((b) => !(b in S.remote.branches));
    gone.forEach((b) => delete S.local.tracking[b]);
    return gone;
  };
  G.opMerge = (T, label, msg) => {
    const L = G.headId();
    if (!L || G.isAnc(T, L)) return { kind: "uptodate" };
    const dirty = G.dirtyNames();
    if (G.isAnc(L, T)) {
      const snap = G.snapOf(T), over = G.wouldOverwrite(snap);
      if (over.length) return { kind: "blocked", files: over };
      const hs = G.headSnap();
      const changed = Object.keys(snap).filter((n) => snap[n] !== hs[n]);
      S.local.branches[S.head] = T;
      G.checkoutSnap(snap, dirty);
      G.logHead(`merge ${label}: Fast-forward`);
      return { kind: "ff", from: L, to: T, changed };
    }
    const res = G.mergeSnaps(G.snapOf(G.mergeBase(L, T)), G.snapOf(L), G.snapOf(T), label);
    const over = G.wouldOverwrite(res.snap);
    if (over.length) return { kind: "blocked", files: over };
    const hs = G.headSnap();
    const changed = Object.keys(res.snap).filter((n) => res.snap[n] !== hs[n]);
    if (res.conflicts.length) {
      S.conflict = { theirs: T, label, msg, files: res.conflicts.slice(), detail: res.detail };
      Object.entries(res.snap).forEach(([n, c]) => {
        S.work[n] = c;
        if (!res.conflicts.includes(n)) S.index[n] = c;
        else if (hs[n] === undefined) delete S.index[n];
        else S.index[n] = hs[n];
      });
      return { kind: "conflict", files: res.conflicts, changed };
    }
    const id = G.mkCommit([L, T], msg, res.snap, S.head, "you");
    G.give(S.local.objs, id);
    S.local.branches[S.head] = id;
    G.checkoutSnap(res.snap, dirty);
    G.logHead(`merge ${label}: Merge made by the 'ort' strategy.`);
    return { kind: "merge", id, changed };
  };
  G.opAbortMerge = () => {
    S.conflict = null;
    G.checkoutSnap(G.headSnap());
  };
  G.opRebase = (T) => {
    const L = G.headId();
    if (G.isAnc(T, L)) return { kind: "uptodate" };
    const aT = G.ancestors(T);
    const mine = [...G.ancestors(L)].filter((c) => !aT.has(c)).sort(G.bySeq);
    if (mine.some((c) => S.commits[c].parents.length > 1)) return { kind: "merges" };
    if (G.isAnc(L, T)) {
      S.local.branches[S.head] = T;
      G.checkoutSnap(G.snapOf(T));
      G.logHead(`rebase (finish): fast-forward to ${T}`);
      return { kind: "ok", count: 0, created: [] };
    }
    let parent = T;
    const created = [];
    for (const c of mine) {
      const cm = S.commits[c];
      const res = G.mergeSnaps(G.snapOf(cm.parents[0]), G.snapOf(parent), cm.snap, "rebase");
      if (res.conflicts.length) return { kind: "conflict", files: res.conflicts };
      parent = G.mkCommit([parent], cm.msg, res.snap, cm.lane, cm.author);
      G.give(S.local.objs, parent);
      created.push(parent);
    }
    S.local.branches[S.head] = parent;
    G.checkoutSnap(G.snapOf(parent));
    G.logHead(`rebase (finish): refs/heads/${S.head} onto ${T}`);
    return { kind: "ok", count: mine.length, created };
  };
  G.opTeammate = (files, msg, branch) => {
    branch = branch || "main";
    const R = S.remote.branches[branch];
    const id = G.mkCommit(R ? [R] : [], msg, { ...G.snapOf(R), ...files }, branch, "teammate");
    G.give(S.remote.objs, id);
    S.remote.branches[branch] = id;
    return id;
  };

  /* ---------- GitHub Actions: a run starts when the pushed snapshot contains the workflow file ---------- */
  G.WORKFLOW = ".github/workflows/ci.yml";
  G.opCI = (id, branch) => {
    const snap = G.snapOf(id);
    if (!(G.WORKFLOW in snap)) return null;
    const failed = Object.entries(snap).some(([n, c]) => n !== G.WORKFLOW && /BUG|BROKEN/.test(c));
    const run = { n: S.runs.length + 1, sha: id, branch, status: failed ? "failed" : "passed" };
    S.runs.push(run);
    return run;
  };
  G.latestRun = (sha) => [...S.runs].reverse().find((r) => r.sha === sha);

  // Used by scenario presets to fast-forward the sandbox to an interesting starting point.
  G.sim = {
    commit(files, msg, author) {
      Object.entries(files).forEach(([n, c]) => { S.work[n] = c; });
      G.opStageAll();
      return G.opCommitIndex(msg, { author });
    },
    base() {
      G.reset();
      S.configured = true;
      G.opRemoteCreate(true);
      G.opClone();
      G.sim.commit({ "index.html": "index.html: Welcome page" }, "Add index.html");
      G.opPush();
    },
  };
})();
