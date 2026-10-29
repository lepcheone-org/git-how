/* Actions, part 2: branches, merging, rebasing, pull requests. */
(function () {
  "use strict";
  const G = window.GV, S = G.S, { esc, plural, ex } = G;
  const def = (o) => G.ACTIONS.push(o);
  const needRepo = () => (S.hasLocal ? null : G.notRepo());
  const needCommit = () => needRepo() || (G.headId() ? null : { why: "There are no commits yet, and a branch needs a commit to point at.", out: ["fatal: invalid reference: " + S.head] });
  const noBranch = (n) => ({ why: `There is no local branch called '${n}' yet.`, out: [`fatal: invalid reference: ${n}`] });

  /* ================= BRANCHES ================= */
  def({
    id: "branchlist", tab: "branch", ro: true, btn: "git branch -a", cmd: "git branch -a",
    desc: "List your branches", when: "To see which branches exist and which one you are on.", can: needRepo,
    run() {
      const out = Object.keys(S.local.branches).map((b) => ({ t: `${b === S.head ? "* " : "  "}${b}`, c: b === S.head ? "ok" : "out" }));
      Object.keys(S.local.tracking).forEach((b) => out.push({ t: `  remotes/origin/${b}`, c: "err" }));
      return {
        cmd: "git branch -a", out, zones: ["local"],
        explain: ex("git branch -a", "Lists every branch Git knows about. The <b>*</b> marks the one you are on right now.", [
          "Plain names are your <b>local</b> branches.", "<code>remotes/origin/...</code> are bookmarks of branches on GitHub (as of your last fetch).",
        ], "A branch is only a lightweight label pointing at a commit. Having many is cheap."),
      };
    },
  });
  def({
    id: "switchnew", tab: "branch", btn: "git switch -c feature", cmd: "git switch -c feature",
    desc: "Create a new branch and move onto it", when: "Before starting any new piece of work.",
    can: () => needCommit() || G.midMerge() || (S.local.branches.feature ? { why: "A branch called 'feature' already exists. Pick it with git switch feature.", out: ["fatal: a branch named 'feature' already exists"] } : null),
    run() {
      G.opNewBranch("feature");
      return {
        cmd: "git switch -c feature", out: ["Switched to a new branch 'feature'"], zones: ["local"],
        explain: ex("git switch -c feature", "Creates a new branch called <code>feature</code> at your current commit and moves you onto it. The <code>-c</code> means create.", [
          "A branch is just a movable label. Creating one is instant and copies nothing.", "You are now <b>on</b> feature. New commits will move the <code>feature</code> label, and <code>main</code> stays put.",
          "Your files do not change yet: both branches point at the same commit.",
        ], "Branching lets you experiment safely. If it goes badly, delete the branch and main never knew."),
      };
    },
  });
  const sw = (name, extra) =>
    def({
      id: "switch" + name, tab: "branch", btn: `git switch ${name}`, cmd: `git switch ${name}`,
      desc: `Move onto the ${name} branch`, when: name === "main" ? "To go back to the main line of work." : "To go back to your feature work.",
      can: () => {
        if (!S.hasLocal) return G.notRepo();
        if (S.conflict) return { why: "You are in the middle of a merge. Finish or abort it before switching branches.", out: ["fatal: cannot switch branch while merging", "Consider \"git merge --abort\"."] };
        if (!S.local.branches[name]) return noBranch(name);
        if (S.head === name) return { why: `You are already on ${name}.`, out: [`Already on '${name}'`] };
        const over = G.wouldOverwrite(G.snapOf(S.local.branches[name]));
        if (over.length) return { why: "You have unsaved changes to files that are different on the other branch. Git refuses to switch so it cannot lose your work. Commit or stash first.", out: [{ t: "error: Your local changes to the following files would be overwritten by checkout:", c: "err" }, ...over.map((n) => `\t${n}`), "Please commit your changes or stash them before you switch branches.", "Aborting"] };
        return null;
      },
      run() {
        const hs = Object.keys(G.headSnap()), before = { ...S.work };
        G.opSwitch(name);
        const changed = Object.keys({ ...before, ...S.work }).filter((n) => before[n] !== S.work[n]);
        const ab = G.aheadBehind(name);
        const out = [`Switched to branch '${name}'`];
        if (ab) out.push(ab.ahead || ab.behind ? `Your branch is ${ab.ahead ? "ahead of" : "behind"} 'origin/${name}' by ${plural(ab.ahead || ab.behind, "commit")}.` : `Your branch is up to date with 'origin/${name}'.`);
        return {
          cmd: `git switch ${name}`, out, zones: ["local", "wd"], anim: changed.length ? [{ from: "local", to: "wd", label: changed.slice(0, 2).join(", ") }] : [],
          explain: ex(`git switch ${name}`, `Moves you onto the <code>${name}</code> branch. Git rewrites the files in your folder to match that branch's latest commit.`, [
            changed.length ? `Files changed in your folder: ${changed.map((n) => `<code>${esc(n)}</code>`).join(", ")}. Look at the Working Directory box.` : "Both branches have the same files, so nothing in your folder changed.",
            "Nothing is lost. The other branch still has all its commits, and you can come back any time.", `<code>HEAD</code> now points at <code>${name}</code>.`,
          ], "This is the 'wow' moment of branches: files appear and vanish as you switch."),
        };
      },
    });
  sw("main");
  sw("feature");
  const del = (id, flag, desc) =>
    def({
      id, tab: "branch", btn: `git branch ${flag} feature`, cmd: `git branch ${flag} feature`, desc, when: flag === "-d" ? "After a branch has been merged and you no longer need it." : "To throw away a branch you do NOT want to keep, even if unmerged.",
      can: () => {
        if (!S.hasLocal) return G.notRepo();
        const t = S.local.branches.feature;
        if (!t) return noBranch("feature");
        if (S.head === "feature") return { why: "You cannot delete the branch you are standing on. Switch to another branch first.", out: ["error: Cannot delete branch 'feature' checked out"] };
        if (flag === "-d" && !G.isAnc(t, G.headId())) return { why: "Git refuses -d because the branch has commits that are not merged into your current branch. Deleting would lose them. Merge it first, or use -D if you really want to throw the work away.", out: ["error: The branch 'feature' is not fully merged.", "If you are sure you want to delete it, run 'git branch -D feature'."] };
        return null;
      },
      run() {
        const t = S.local.branches.feature;
        delete S.local.branches.feature;
        return {
          cmd: `git branch ${flag} feature`, out: [`Deleted branch feature (was ${t}).`], zones: ["local"], events: ["branch-deleted"],
          explain: ex(`git branch ${flag} feature`, "Deletes the <code>feature</code> label. The commits are not deleted: if they were merged, they live on inside main.", [
            flag === "-d" ? "<code>-d</code> is the safe delete: it only works if the branch is fully merged." : "<code>-D</code> is the forced delete: it removes the label even if its commits exist nowhere else.",
            "Only the local branch is removed. A copy on GitHub is not affected.",
          ], flag === "-d" ? "Delete merged branches to keep your branch list tidy." : "After -D, the unmerged commits are hard to find again (only the reflog remembers them)."),
        };
      },
    });
  del("branchd", "-d", "Delete the feature branch (only if merged)");
  del("branchD", "-D", "Force-delete the feature branch");

  /* ================= MERGE & REBASE ================= */
  const mergeBtn = (id, src) =>
    def({
      id, tab: "merge", btn: `git merge ${src}`, cmd: `git merge ${src}`,
      desc: src === "feature" ? "Bring the feature branch's work into this branch" : "Bring main's newest work into this branch", when: src === "feature" ? "When feature work is finished and you are on main." : "To update your feature branch with the latest main.",
      can: () => needCommit() || G.midMerge() || (!S.local.branches[src] ? noBranch(src) : S.head === src ? { why: `You cannot merge ${src} into itself. Switch to the branch that should receive the work.`, out: [`Already up to date.`] } : null),
      run() {
        const r = G.opMerge(S.local.branches[src], src, `Merge branch '${src}'`);
        const anim = r.kind === "ff" && r.changed.length ? [{ from: "local", to: "wd", label: r.changed[0] }] : [];
        return { cmd: `git merge ${src}`, out: G.mergeLines(r), events: r.kind === "conflict" ? ["merge-conflict"] : r.kind === "merge" ? ["merge-commit"] : r.kind === "ff" ? ["merge-ff"] : [], zones: ["local", "wd"], anim, explain: G.mergeExplain(r, `git merge ${src}`, src) };
      },
    });
  mergeBtn("mergefeature", "feature");
  mergeBtn("mergemain", "main");
  def({
    id: "resolve", tab: "merge", btn: "Fix the conflict", cmd: "# open the file, keep what you want, delete the markers",
    desc: "In your editor: keep what you want, delete the markers", when: "When a merge stopped on a conflict.",
    can: () => (S.conflict && G.conflicted().some((f) => f.w.includes("<<<<<<<")) ? null : { why: "There is no unresolved conflict to fix right now.", out: [] }),
    run() {
      const names = G.conflicted().filter((f) => f.w.includes("<<<<<<<")).map((f) => f.name);
      names.forEach((n) => {
        const d = S.conflict.detail[n] || {};
        S.work[n] = [d.ours, d.theirs].filter((x) => x !== undefined).join(" + ") + " (resolved)";
      });
      return {
        cmd: `# in your editor: open ${names[0]}, keep the lines you want, delete <<<<<<<, ======= and >>>>>>>`, out: [], zones: ["wd"], anim: [{ from: "wd", to: "wd", label: names[0] }],
        explain: ex("Fix the conflict in your editor", "This is the human part. You open the conflicted file, decide what the final text should be, and remove the three marker lines.", [
          "Here you kept <b>both</b> versions, joined together. You could also keep only one.", "The file is still marked as conflicted. Git does not know you are done until you <code>git add</code> it.",
        ], "Editors like VS Code show buttons above the conflict: Accept Current, Accept Incoming, Accept Both."),
      };
    },
  });
  def({
    id: "mergeabort", tab: "merge", btn: "git merge --abort", cmd: "git merge --abort",
    desc: "Cancel the merge and go back to how things were", when: "When a merge goes wrong and you want to start over.",
    can: () => (S.conflict ? null : { why: "There is no merge in progress to abort.", out: ["fatal: There is no merge to abort (MERGE_HEAD missing)."] }),
    run() {
      G.opAbortMerge();
      return {
        cmd: "git merge --abort", out: [], zones: ["wd", "stage"],
        explain: ex("git merge --abort", "Cancels the half-finished merge. Your branch and files return to exactly how they were before you ran git merge.", ["Nothing is lost. The other branch is untouched.", "You can try the merge again later."], "This is your escape hatch. Conflicts are never a trap."),
      };
    },
  });
  def({
    id: "rebase", tab: "merge", btn: "git rebase main", cmd: "git rebase main",
    desc: "Replay your branch's commits on top of the latest main", when: "To keep a straight history before merging your branch.",
    can: () => {
      if (!S.hasLocal) return G.notRepo();
      if (S.conflict) return G.midMerge();
      if (S.head === "main") return { why: "You are on main. Rebase is normally run from your feature branch: switch to it first.", out: ["Current branch main is up to date."] };
      if (!S.local.branches.main) return noBranch("main");
      if (G.dirtyNames().length) return { why: "Rebase needs a clean working tree. Commit or stash your changes first.", out: ["error: cannot rebase: You have unstaged changes.", "error: Please commit or stash them."] };
      return null;
    },
    run() {
      const r = G.opRebase(S.local.branches.main);
      if (r.kind === "uptodate") return { cmd: "git rebase main", out: [`Current branch ${S.head} is up to date.`], zones: ["local"], explain: ex("git rebase main", "Your branch is already built on top of the latest main. Nothing to replay.", ["No commits needed moving."], "Rebase is only needed when main has moved on.") };
      if (r.kind === "merges") return { cmd: "git rebase main", out: ["error: this sandbox does not replay merge commits"], zones: ["local"], explain: ex("git rebase main", "This sandbox cannot replay merge commits.", ["Use git merge instead."], null, true) };
      if (r.kind === "conflict") return { cmd: "git rebase main", out: [{ t: `CONFLICT (content): Merge conflict in ${r.files[0]}`, c: "err" }, { t: "(This sandbox does not simulate resolving rebase conflicts. The rebase was cancelled. Use git merge main instead.)", c: "hint" }], zones: ["local"], explain: ex("git rebase main (conflict)", "Replaying your commits hit a conflict. In real Git you would fix it and run <code>git rebase --continue</code>. This sandbox cancels instead.", ["Nothing changed.", "Merge is easier for conflicts."], null, true) };
      return {
        cmd: "git rebase main", out: [`Successfully rebased and updated refs/heads/${S.head}.`], zones: ["local", "wd"], links: [],
        explain: ex("git rebase main", "Takes the commits you made on this branch and <b>replays</b> them, one by one, on top of the latest main. It is like pretending you had started your work from today's main.", [
          `${plural(r.count, "commit")} replayed. They get <b>new IDs</b> because their parent changed. The old copies are no longer in the history chart.`, "The result is a perfectly straight line with no merge commit.", "Your files now include the newest work from main as well.",
        ], "Golden rule: never rebase commits you already pushed and others use. Rebase rewrites history, and a rewritten branch needs a force-push."),
      };
    },
  });

  /* ================= PULL REQUESTS (GitHub website) ================= */
  const openPr = () => S.prs.find((p) => p.state === "open");
  const prCan = (type) => () => {
    const pr = openPr();
    if (!pr) return { why: "There is no open pull request to merge. Open one first.", out: [] };
    const B = S.remote.branches[pr.base], F = S.remote.branches[pr.from];
    const res = G.mergeSnaps(G.snapOf(G.mergeBase(B, F)), G.snapOf(B), G.snapOf(F), pr.from);
    if (res.conflicts.length) return { why: "GitHub says: 'This branch has conflicts that must be resolved.' Merge main into your feature branch on your computer, fix the conflict, and push. Then the button works.", out: [] };
    const chk = G.latestRun(F);
    if (chk && chk.status === "failed") return { why: "GitHub says: 'Merging is blocked. Required check CI failed.' Branch protection stops a pull request from merging while its checks are red. Fix the problem, push again, and wait for the checks to pass.", out: [] };
    return null;
  };
  const prMerge = (type) => {
    const pr = openPr(), B = S.remote.branches[pr.base], F = S.remote.branches[pr.from];
    let id;
    if (type === "rebase") {
      const aB = G.ancestors(B);
      const mine = [...G.ancestors(F)].filter((c) => !aB.has(c)).sort(G.bySeq);
      id = B;
      mine.forEach((c) => {
        const cm = S.commits[c];
        const res = G.mergeSnaps(G.snapOf(cm.parents[0]), G.snapOf(id), cm.snap, pr.from);
        id = G.mkCommit([id], cm.msg, res.snap, "main", "github");
      });
    } else {
      const res = G.mergeSnaps(G.snapOf(G.mergeBase(B, F)), G.snapOf(B), G.snapOf(F), pr.from);
      id = type === "squash" ? G.mkCommit([B], `${pr.title} (#${pr.n})`, res.snap, "main", "github") : G.mkCommit([B, F], `Merge pull request #${pr.n} from you/${pr.from}`, res.snap, "main", "github");
    }
    G.give(S.remote.objs, id);
    S.remote.branches[pr.base] = id;
    pr.state = "merged";
    pr.how = type;
    pr.run = G.opCI(id, pr.base);
    const issue = pr.closes && S.issues.find((i) => i.n === pr.closes && i.state === "open");
    if (issue) { issue.state = "closed"; issue.by = pr.n; }
    pr.closedIssue = issue ? issue.n : null;
    return pr;
  };
  def({
    id: "openpr", tab: "github", btn: "Open a pull request", cmd: "# github.com > Compare & pull request > Create pull request",
    desc: "Ask for your branch to be merged into main", when: "After pushing a branch that is ready for review.",
    can: () => {
      if (!S.hasRemote) return { why: "There is no GitHub repository.", out: [] };
      if (!S.remote.branches.feature) return { why: "GitHub can only open a pull request for a branch that exists on GitHub. Push your feature branch first.", out: [] };
      if (openPr()) return { why: "There is already an open pull request for this branch.", out: [] };
      if (G.isAnc(S.remote.branches.feature, S.remote.branches.main)) return { why: "GitHub says: 'There isn't anything to compare.' The feature branch has no new commits compared with main.", out: [] };
      return null;
    },
    run() {
      const F = S.remote.branches.feature;
      const pr = { n: S.prs.length + 1, title: S.commits[F].msg, from: "feature", base: "main", state: "open", approved: false, closes: (S.issues.find((i) => i.state === "open") || {}).n || null };
      S.prs.push(pr);
      return {
        cmd: `# github.com > Compare & pull request: "${pr.title}" (feature -> main)${pr.closes ? ` + description "Closes #${pr.closes}"` : ""}`, out: [], zones: ["remote"], anim: [{ from: "remote", to: "remote", label: `PR #${pr.n}` }],
        explain: ex("Open a pull request", "A <b>pull request</b> (PR) is a proposal on GitHub: 'please merge my branch into main'. It is where your team reviews the change before it goes in.", [
          "Nothing is merged yet. GitHub just shows the difference between the two branches and starts a conversation.", "Reviewers can comment, request changes, or approve.",
          "If you push more commits to the same branch, the PR updates automatically.",
          ...(pr.closes ? [`The description says <code>Closes #${pr.closes}</code>. That links the PR to issue #${pr.closes}, so merging the PR will close the issue automatically.`] : []),
          ...(G.latestRun(F) ? [`GitHub Actions already ran on this branch: checks <b>${G.latestRun(F).status}</b>. Results show on the PR page.`] : []),
        ], "A PR is a GitHub feature, not a Git command. Git itself only knows about branches and merges."),
      };
    },
  });
  def({
    id: "review", tab: "github", btn: "Teammate reviews and approves", cmd: "# a teammate clicks: Review changes > Approve",
    desc: "A colleague reads the change and approves it", when: "Practice: before merging, someone else should review.",
    can: () => (!openPr() ? { why: "There is no open pull request to review.", out: [] } : openPr().approved ? { why: "This pull request is already approved.", out: [] } : null),
    run() {
      openPr().approved = true;
      return {
        cmd: "# a teammate clicks: Review changes > Approve", out: [], zones: ["remote"], anim: [{ from: "remote", to: "remote", label: "Approved" }],
        explain: ex("Review and approve", "A second pair of eyes reads your change and approves it. This catches bugs and shares knowledge.", [
          "Reviewers can leave comments on individual lines and ask for changes.", "Many teams use branch protection so main <b>cannot</b> be merged without an approval.",
        ], "Review is the main reason pull requests exist."),
      };
    },
  });
  const mergeBtnPr = (id, type, btn, desc, expl) =>
    def({
      id, tab: "github", btn, cmd: `# github.com > ${btn}`, desc, when: "After approval, to put the branch into main on GitHub.", can: prCan(type),
      run() {
        const pr = prMerge(type);
        return {
          cmd: `# github.com > ${btn} > Confirm`, out: [], events: ["pr-merged"].concat(pr.closedIssue ? ["issue-closed"] : []), zones: ["remote"], anim: [{ from: "remote", to: "remote", label: `PR #${pr.n} merged` }],
          explain: ex(btn, expl.what, expl.steps.concat(pr.closedIssue ? [`Because the pull request said <code>Closes #${pr.closedIssue}</code>, GitHub closed issue #${pr.closedIssue} automatically.`] : []).concat(pr.run ? [`The merge triggered a GitHub Actions run on main: <b>${pr.run.status}</b>.`] : []), "Your computer does not know yet. GitHub's main moved forward. Run git pull to catch up."),
        };
      },
    });
  mergeBtnPr("mergepr", "merge", "Merge pull request", "Merge with a merge commit (keeps all commits)", {
    what: "GitHub merges the branch into <code>main</code> on the website and records a merge commit.", steps: ["All the branch's commits are kept in the history.", "A merge commit with two parents joins the lines.", "The PR is marked <b>Merged</b>."] });
  mergeBtnPr("squashpr", "squash", "Squash and merge", "Combine all commits into one new commit on main", {
    what: "GitHub squashes every commit of the branch into <b>one</b> new commit on main.", steps: ["Main gets a single tidy commit, with a plain straight history.", "The original branch commits are not part of main's history.", "Because of that, <code>git branch -d</code> will say the branch is 'not fully merged'. That is expected: use -D."] });
  mergeBtnPr("rebasepr", "rebase", "Rebase and merge", "Replay the commits onto main (no merge commit)", {
    what: "GitHub replays each commit of the branch on top of main, one by one, with no merge commit.", steps: ["History stays a straight line and keeps every commit.", "The replayed commits get new IDs."] });
  def({
    id: "delremote", tab: "github", btn: "Delete branch on GitHub", cmd: "# github.com > Delete branch",
    desc: "Remove the finished branch from GitHub", when: "After a pull request is merged.",
    can: () => (S.remote.branches.feature ? null : { why: "There is no feature branch on GitHub to delete.", out: [] }),
    run() {
      delete S.remote.branches.feature;
      return {
        cmd: "# github.com > Pull request > Delete branch", out: [], zones: ["remote"],
        explain: ex("Delete branch on GitHub", "GitHub offers this button right after a merge. The branch has done its job, and its commits are safe inside main.", [
          "Only the branch label on GitHub is removed.", "Your computer still has an <code>origin/feature</code> bookmark. <code>git fetch --prune</code> cleans it up.",
        ], "Tidy repos have few branches."),
      };
    },
  });
})();
