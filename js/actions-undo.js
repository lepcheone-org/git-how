/* Actions, part 3: undoing things, and extras (ignore, tags). */
(function () {
  "use strict";
  const G = window.GV, S = G.S, { esc, plural, ex } = G;
  const def = (o) => G.ACTIONS.push(o);
  const needRepo = () => (S.hasLocal ? null : G.notRepo());
  const needCommit = () => needRepo() || (G.headId() ? null : { why: "There are no commits yet.", out: [`fatal: your current branch '${S.head}' does not have any commits yet`] });
  const hasParent = () => needCommit() || G.midMerge() || (S.commits[G.headId()].parents.length ? null : { why: "This is the very first commit. There is nothing before it to go back to.", out: ["fatal: ambiguous argument 'HEAD~1': unknown revision or path not in the working tree."] });
  const short = (id) => id;

  /* ================= UNDO UNCOMMITTED ================= */
  def({
    id: "restore", tab: "undo", btn: "git restore .", cmd: "git restore .",
    desc: "Throw away edits you have not staged", when: "When you want to discard changes to tracked files and go back to the last saved version.",
    can: () => needRepo() || (G.unstaged().length ? null : { why: "There are no unstaged changes to discard.", out: [] }),
    run() {
      const names = G.unstaged().map((f) => { S.work[f.name] = f.i; return f.name; });
      return {
        cmd: "git restore .", out: [], zones: ["wd"], anim: [{ from: "stage", to: "wd", label: "last version" }],
        explain: ex("git restore .", "Overwrites your working files with the version from the staging area (or last commit), discarding your edits.", [
          `Files reverted: ${names.map((n) => `<code>${esc(n)}</code>`).join(", ")}.`, "<b>This cannot be undone.</b> Git never saw those edits, so it cannot bring them back.", "Brand-new untracked files are not touched.",
        ], "Not sure? Use git stash instead: it saves the edits so you can get them back.", false),
      };
    },
  });
  def({
    id: "unstage", tab: "undo", btn: "git restore --staged .", cmd: "git restore --staged .",
    desc: "Take files out of the staging area (keeps your edits)", when: "When you staged something by mistake.",
    can: () => needRepo() || (G.staged().length ? null : { why: "Nothing is staged, so there is nothing to unstage.", out: [] }),
    run() {
      G.staged().forEach((f) => { if (f.h === undefined) delete S.index[f.name]; else S.index[f.name] = f.h; });
      return {
        cmd: "git restore --staged .", out: [], zones: ["stage", "wd"], anim: [{ from: "stage", to: "wd", label: "unstaged" }],
        explain: ex("git restore --staged .", "Moves files back out of the staging area. Your actual edits in the folder are safe.", [
          "It only undoes <code>git add</code>.", "Files that were brand new become <b>untracked</b> again. Edited files become <b>modified, not staged</b>.",
        ], "This is the safe undo for git add. It cannot lose work."),
      };
    },
  });
  def({
    id: "stash", tab: "undo", btn: "git stash", cmd: "git stash",
    desc: "Shelve your unsaved work so the folder is clean", when: "When you must switch tasks but are not ready to commit.",
    can: () => needRepo() || needCommit() || (G.dirtyNames().length ? null : { why: "There are no local changes to stash.", out: ["No local changes to save"] }),
    run() {
      const hs = G.headSnap(), changes = {};
      G.fileList().filter((f) => f.staged || f.unstaged).forEach((f) => { changes[f.name] = f.w; });
      Object.keys(changes).forEach((n) => {
        if (hs[n] === undefined) { delete S.work[n]; delete S.index[n]; } else { S.work[n] = hs[n]; S.index[n] = hs[n]; }
      });
      const label = `WIP on ${S.head}: ${G.headId()} ${S.commits[G.headId()].msg}`;
      S.stash.push({ changes, label });
      return {
        cmd: "git stash", out: [`Saved working directory and index state ${label}`], zones: ["wd", "local"], anim: [{ from: "wd", to: "local", label: "stash" }],
        explain: ex("git stash", "Puts your uncommitted changes on a shelf and gives you back a clean folder, exactly like your last commit.", [
          "Handy before switching branches or pulling when you are in the middle of something.", "The shelf is a stack: stash twice and you have two items.", "Untracked (brand-new) files are left alone by default.",
        ], "Stash is temporary storage, not a backup. Do not leave things in it for months."),
      };
    },
  });
  def({
    id: "stashpop", tab: "undo", btn: "git stash pop", cmd: "git stash pop",
    desc: "Bring back the most recently stashed work", when: "When you are ready to continue the shelved work.",
    can: () => needRepo() || (!S.stash.length ? { why: "The stash is empty. Nothing to bring back.", out: ["No stash entries found."] } : null),
    run() {
      const it = S.stash.pop();
      Object.entries(it.changes).forEach(([n, c]) => { S.work[n] = c; });
      return {
        cmd: "git stash pop", out: ["On branch " + S.head, "Changes not staged for commit:", ...Object.keys(it.changes).map((n) => ({ t: `\tmodified:   ${n}`, c: "err" })), "", "Dropped refs/stash@{0}"], zones: ["local", "wd"], anim: [{ from: "local", to: "wd", label: "stash" }],
        explain: ex("git stash pop", "Reapplies the shelved changes to your working files and removes them from the shelf.", ["Your edits are back, as unstaged changes.", "<code>pop</code> = apply + drop. Use <code>git stash apply</code> to keep a copy on the shelf."], "Pop works on any branch, so you can stash on one branch and pop on another."),
      };
    },
  });

  /* ================= UNDO COMMITS ================= */
  def({
    id: "amend", tab: "undo", btn: "git commit --amend", cmd: "git commit --amend -m \"...\"",
    desc: "Redo the last commit (new message, or add forgotten changes)", when: "To fix a typo in the last commit message, or add a forgotten file. Only before pushing.",
    can: () => needCommit() || G.midMerge() || (S.configured ? null : { why: "Run git config first.", out: ["fatal: unable to auto-detect email address"] }),
    run() {
      const cur = S.commits[G.headId()];
      const custom = (G.ui.msg || "").trim();
      const msg = custom || (cur.msg.includes(" (WIP)") ? cur.msg.replace(" (WIP)", "") : cur.msg + " (amended)");
      const old = G.headId();
      const id = G.mkCommit(cur.parents, msg, { ...S.index }, cur.lane, "you");
      G.give(S.local.objs, id);
      S.local.branches[S.head] = id;
      G.logHead(`commit (amend): ${msg}`);
      G.ui.msg = "";
      const pushed = S.remote.objs.has(old);
      return {
        cmd: `git commit --amend -m "${msg}"`, out: [`[${S.head} ${id}] ${msg}`], zones: ["stage", "local"], anim: [{ from: "stage", to: "local", label: id }],
        explain: ex("git commit --amend", "Replaces your last commit with a new one. It is the 'oops, redo that' button for the commit you just made.", [
          `The old commit <code>${old}</code> is swapped for <code>${id}</code>. Same parent, new message${G.staged().length ? "" : " (and any changes you had staged would be included)"}.`,
          "The new commit has a different ID, because commits are identified by their content.",
          pushed ? "<b>You already pushed the old one.</b> GitHub still has it, so a normal push will now be rejected. Do not amend pushed commits." : "Nothing was pushed, so no one else is affected.",
        ], "Rule: only amend commits you have not pushed. Type a message in the box first to choose your own wording."),
      };
    },
  });
  const reset = (id, mode, desc, when) =>
    def({
      id, tab: "undo", btn: `git reset --${mode} HEAD~1`, cmd: `git reset --${mode} HEAD~1`, desc, when, can: hasParent,
      run() {
        const L = G.headId(), p = S.commits[L].parents[0];
        const msg = S.commits[L].msg;
        S.local.branches[S.head] = p;
        if (mode === "mixed") S.index = { ...G.snapOf(p) };
        if (mode === "hard") G.checkoutSnap(G.snapOf(p));
        G.logHead(`reset: moving to HEAD~1`);
        const expl = {
          soft: ["The branch moves back one commit.", "Your files and the staging area keep every change. The undone commit's changes now show as <b>staged</b>, ready to commit again (for example with a better message or split up).", "Nothing is lost."],
          mixed: ["The branch moves back one commit and the staging area is emptied.", "Your files keep every change, now shown as <b>unstaged</b> (or untracked, if new).", "Nothing is lost. This is the default mode of git reset."],
          hard: ["The branch moves back one commit AND your files are rewound to match it.", "The undone commit's changes are <b>discarded</b> from your folder.", "The commit is not truly gone yet: <code>git reflog</code> remembers it for a while."],
        }[mode];
        return {
          cmd: `git reset --${mode} HEAD~1`, out: mode === "hard" ? [`HEAD is now at ${p} ${S.commits[p].msg}`] : [], zones: ["local", "stage", "wd"], anim: [{ from: "local", to: mode === "soft" ? "stage" : "wd", label: msg.slice(0, 18) }],
          explain: ex(`git reset --${mode} HEAD~1`, `Moves your branch back one commit (<code>HEAD~1</code> means 'the commit before this one'), undoing the commit <code>${L}</code>.`, expl,
            mode === "hard" ? "Danger: --hard throws away uncommitted work too. Only use it on commits you have NOT pushed." : "Only use reset on commits you have not pushed. For pushed commits use git revert."),
        };
      },
    });
  reset("resetsoft", "soft", "Undo the last commit, keep changes staged", "To redo a commit differently (e.g. a better message or split it).");
  reset("resetmixed", "mixed", "Undo the last commit, keep changes unstaged", "To undo a commit and re-choose what to stage.");
  reset("resethard", "hard", "Undo the last commit and DISCARD its changes", "To completely throw away your latest unpushed commit.");
  def({
    id: "revert", tab: "undo", btn: "git revert HEAD", cmd: "git revert HEAD --no-edit",
    desc: "Undo the last commit by adding an opposite commit", when: "To undo a commit that you already pushed and others may have.",
    can: () => hasParent() || (G.dirtyNames().length ? { why: "Revert needs a clean working tree. Commit or stash your changes first.", out: ["error: your local changes would be overwritten by revert."] } : null),
    run() {
      const L = G.headId(), c = S.commits[L];
      const id = G.mkCommit([L], `Revert "${c.msg}"`, { ...G.snapOf(c.parents[0]) }, S.head, "you");
      G.give(S.local.objs, id);
      S.local.branches[S.head] = id;
      G.checkoutSnap(G.snapOf(id));
      G.logHead(`revert: Revert "${c.msg}"`);
      return {
        cmd: "git revert HEAD --no-edit", out: [`[${S.head} ${id}] Revert "${c.msg}"`, " 1 file changed, 1 deletion(-)"], zones: ["local", "wd"], anim: [{ from: "local", to: "wd", label: "undo" }],
        explain: ex("git revert HEAD", "Creates a <b>new</b> commit that does the exact opposite of the last one. The bad commit stays in history, cancelled out.", [
          "History is never rewritten, only added to. That is why it is safe for commits you already pushed.", "Teammates can pull it like any other commit.", "Your files now look like they did before the bad commit.",
        ], "Public mistake? revert. Private mistake? reset. This is the most important rule of undoing in Git."),
      };
    },
  });
  def({
    id: "reflog", tab: "undo", ro: true, btn: "git reflog", cmd: "git reflog",
    desc: "Show every place HEAD has been (your safety net)", when: "When you think you lost commits.", can: needRepo,
    run() {
      const out = S.reflog.map((e, i) => `${e.id || "0000000"} HEAD@{${S.reflog.length - 1 - i}}: ${e.text}`).reverse();
      return {
        cmd: "git reflog", out, zones: ["local"],
        explain: ex("git reflog", "A private diary of everywhere your HEAD has pointed: commits, switches, resets, merges.", [
          "Even after <code>git reset --hard</code>, the lost commit's ID is listed here.", "<code>HEAD@{1}</code> means 'where HEAD was one move ago'.", "It only lives on your computer and is cleaned up after a few months.",
        ], "If you ever think 'I just destroyed my work', look at the reflog before panicking."),
      };
    },
  });
  def({
    id: "resetundo", tab: "undo", btn: "git reset --hard HEAD@{1}", cmd: "git reset --hard HEAD@{1}",
    desc: "Jump back to where HEAD was one move ago", when: "To undo a reset by going back to the commit the reflog remembers.",
    can: () => {
      if (needRepo()) return needRepo();
      if (S.reflog.length < 2) return { why: "There is no earlier HEAD position to return to yet.", out: ["fatal: ambiguous argument 'HEAD@{1}': unknown revision"] };
      if (S.reflog[S.reflog.length - 2].id === G.headId()) return { why: "HEAD@{1} is the same commit you are already on, so nothing would change.", out: [] };
      return null;
    },
    run() {
      const t = S.reflog[S.reflog.length - 2].id;
      S.local.branches[S.head] = t;
      G.checkoutSnap(G.snapOf(t));
      G.logHead("reset: moving to HEAD@{1}");
      return {
        cmd: "git reset --hard HEAD@{1}", out: [`HEAD is now at ${t} ${S.commits[t].msg}`], events: ["recovered"], zones: ["local", "wd"], anim: [{ from: "local", to: "wd", label: "recovered" }],
        explain: ex("git reset --hard HEAD@{1}", "Moves your branch back to where it was before the last move. The commit you thought you destroyed is back.", [
          "The reflog told Git exactly where HEAD had been.", "Your files are rewound to match that commit again.",
        ], "This is why committed work is very hard to lose. Uncommitted work is the real risk."),
      };
    },
  });

  /* ================= EXTRAS ================= */
  def({
    id: "mkdebuglog", tab: "extras", btn: "Create debug.log", cmd: "# your program writes debug.log",
    desc: "A noisy file you never want in Git", when: "Practice: a log, build or secret file appears in your folder.", can: needRepo,
    run() {
      S.work["debug.log"] = "debug.log: lots of noisy output";
      return {
        cmd: "# running your app creates debug.log", out: [], zones: ["wd"], anim: [{ from: "wd", to: "wd", label: "debug.log" }],
        explain: ex("A log file appears", "Programs create files like logs, temporary files and downloaded packages. They do not belong in a repository.", ["Git sees it as <b>untracked</b> and will keep listing it in git status.", "If you run <code>git add .</code>, it would be committed by accident."], "Secrets (passwords, keys) are even more important to keep out."),
      };
    },
  });
  def({
    id: "gitignore", tab: "extras", btn: "Create .gitignore", cmd: "# create .gitignore containing: *.log",
    desc: "Tell Git to ignore files like *.log", when: "To keep logs, build output and secrets out of Git.", can: () => needRepo() || (".gitignore" in S.work ? { why: "A .gitignore file already exists.", out: [] } : null),
    run() {
      S.work[".gitignore"] = "*.log";
      return {
        cmd: "# create .gitignore containing: *.log", out: [], zones: ["wd"], anim: [{ from: "wd", to: "wd", label: ".gitignore" }],
        explain: ex(".gitignore", "A plain text file listing patterns of files Git should pretend do not exist.", [
          "<code>*.log</code> means 'every file ending in .log'.", "Ignored files vanish from <code>git status</code> and are skipped by <code>git add .</code>.", "The .gitignore file itself is committed, so the whole team shares the same rules.",
        ], "It does not remove files that are already tracked. It only affects untracked ones."),
      };
    },
  });
  def({
    id: "tag", tab: "extras", btn: "git tag v1.0", cmd: "git tag v1.0",
    desc: "Put a permanent name on this commit", when: "To mark a release, like version 1.0.", can: needCommit,
    run() {
      const name = `v1.${Object.keys(S.local.tags).length}`;
      S.local.tags[name] = G.headId();
      return {
        cmd: `git tag ${name}`, out: [], zones: ["local"],
        explain: ex(`git tag ${name}`, "Attaches a permanent, human-friendly label to the current commit.", ["Unlike a branch, a tag never moves. It always points at the same commit.", "It is created only on your computer until you push it.", "See the tag label in the commit history chart."], "Teams use tags for releases: v1.0, v1.1, v2.0."),
      };
    },
  });
  def({
    id: "pushtags", tab: "extras", btn: "git push --tags", cmd: "git push origin --tags",
    desc: "Upload your tags to GitHub", when: "After tagging a release, so others can see it.",
    can: () => needRepo() || (!S.linked || !S.hasRemote ? { why: "There is no GitHub remote.", out: ["fatal: No configured push destination."] } : !Object.keys(S.local.tags).some((t) => S.remote.tags[t] !== S.local.tags[t]) ? { why: "There are no new tags to push.", out: ["Everything up-to-date"] } : null),
    run() {
      const out = [`To ${G.URL_SSH}`];
      Object.entries(S.local.tags).forEach(([t, id]) => {
        if (S.remote.tags[t] !== id) { S.remote.tags[t] = id; G.give(S.remote.objs, id); out.push(` * [new tag]         ${t} -> ${t}`); }
      });
      return {
        cmd: "git push origin --tags", out, zones: ["local", "remote"], links: ["l-push"], anim: [{ from: "local", to: "remote", label: "tag" }],
        explain: ex("git push --tags", "A normal git push does NOT send tags. This sends them, so GitHub lists them under Tags and Releases.", ["On GitHub you can then turn a tag into a Release with notes and downloadable files."], "You can push one tag only: git push origin v1.0"),
      };
    },
  });
})();
