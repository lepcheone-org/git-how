/* Actions, part 1: setup, daily loop, syncing with GitHub. */
(function () {
  "use strict";
  const G = window.GV, S = G.S, { esc, plural, ex } = G;
  const A = (G.ACTIONS = []);
  const def = (o) => A.push(o);

  G.TABS = [
    { id: "setup", name: "Setup", intro: "Get a repository onto your computer. Two routes: start on GitHub and clone, or start locally with git init and connect later." },
    { id: "daily", name: "Daily loop", intro: "The cycle you repeat all day: edit, check, stage, commit. Everything here happens on your computer." },
    { id: "sync", name: "Sync with GitHub", intro: "Share your commits and get your teammates' commits. This is where Git meets GitHub." },
    { id: "branch", name: "Branches", intro: "A branch is a separate line of work, so you can try things without touching the main line." },
    { id: "merge", name: "Merge & rebase", intro: "Bring the work from one branch into another. Sometimes Git needs your help (a conflict)." },
    { id: "github", name: "Pull requests", intro: "The GitHub way to propose, review and merge changes. These buttons happen on the GitHub website." },
    { id: "ci", name: "Issues & Actions", intro: "Issues track the work to be done. GitHub Actions runs automatic checks (like tests) every time you push. Both live on GitHub." },
    { id: "undo", name: "Undo & fix", intro: "Everyone makes mistakes. Git has a different undo for each situation. Pick the one that matches yours." },
    { id: "extras", name: "Extras", intro: "Things you will meet sooner or later: ignoring files and tagging releases." },
  ];

  const notRepo = () => ({
    why: "There is no Git repository here yet, so Git has nothing to work with. Start with git init (new project) or git clone (copy of a GitHub project).",
    out: ["fatal: not a git repository (or any of the parent directories): .git"],
  });
  const midMerge = () =>
    S.conflict
      ? { why: "You are in the middle of a merge that stopped on conflicts. Fix them and commit, or abort the merge, before doing this.", out: ["error: You have not concluded your merge (MERGE_HEAD exists).", "hint: Please, commit your changes before you merge."] }
      : null;
  G.notRepo = notRepo;
  G.midMerge = midMerge;
  const needRepo = () => (S.hasLocal ? null : notRepo());
  const needCommit = () => needRepo() || (G.headId() ? null : { why: "There are no commits yet.", out: [`fatal: your current branch '${S.head}' does not have any commits yet`] });

  const diffstat = (names) => [...names.map((n) => ` ${n} | 1 +`), ` ${plural(names.length, "file")} changed, ${plural(names.length, "insertion")}(+)`];
  const fetchLines = (f) => {
    if (!f.ups.length && !f.tags.length) return [];
    const o = [`From ${G.URL_HTTP}`];
    f.ups.forEach((u) => o.push(u.old ? `   ${u.old}..${u.id}  ${u.b.padEnd(10)} -> origin/${u.b}` : ` * [new branch]      ${u.b.padEnd(10)} -> origin/${u.b}`));
    f.tags.forEach((t) => o.push(` * [new tag]         ${t} -> ${t}`));
    return o;
  };
  G.fetchLines = fetchLines;

  G.mergeLines = (r) => {
    if (r.kind === "uptodate") return ["Already up to date."];
    if (r.kind === "ff") return [`Updating ${r.from}..${r.to}`, "Fast-forward", ...diffstat(r.changed)];
    if (r.kind === "merge") return ["Merge made by the 'ort' strategy.", ...diffstat(r.changed)];
    if (r.kind === "conflict")
      return [...r.files.map((n) => `Auto-merging ${n}`), ...r.files.map((n) => ({ t: `CONFLICT (content): Merge conflict in ${n}`, c: "err" })), { t: "Automatic merge failed; fix conflicts and then commit the result.", c: "err" }];
    return [{ t: "error: Your local changes to the following files would be overwritten by merge:", c: "err" }, ...r.files.map((n) => `\t${n}`), "Please commit your changes or stash them before you merge.", "Aborting"];
  };
  G.mergeExplain = (r, cmd, src) => {
    const s = esc(src);
    if (r.kind === "uptodate") return ex(cmd, `Nothing to do. Your branch already contains everything from <code>${s}</code>.`, ["Git checked and found no commits on the other side that you do not have."], "'Already up to date' is good news, not an error.");
    if (r.kind === "ff")
      return ex(
        `${cmd} (fast-forward)`,
        `Your branch had nothing new of its own, so Git simply slid it forward to catch up with <code>${s}</code>. This is called a <b>fast-forward</b>.`,
        ["No new commit is created. The branch label just moves to a newer commit.", "Your working files were updated to match.", "History stays a single straight line."],
        "Fast-forward is the simplest merge. It is only possible when the branches have not drifted apart."
      );
    if (r.kind === "merge")
      return ex(
        `${cmd} (merge commit)`,
        `Both sides had new commits, so Git combined them with a special <b>merge commit</b>.`,
        ["A merge commit has <b>two parents</b>: the tip of your branch and the tip of the branch you merged. See the two lines join in the history chart.", "The two sides changed different files, so Git merged them automatically.", "The branch you merged from is untouched."],
        "If both sides edit the same file in different ways, you get a merge conflict instead."
      );
    if (r.kind === "conflict")
      return ex(
        `${cmd} (conflict)`,
        `Both sides changed the same file in different ways, and Git cannot guess which version you want. It <b>stopped halfway</b> and is waiting for you.`,
        [
          "A merge is now <b>in progress</b>. Nothing is lost, and you can still abort.",
          "In each conflicted file Git added markers: <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD</code> (your version), <code>=======</code>, then <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code> (their version).",
          "To finish: edit the file so it holds what you want and delete the markers, then <code>git add</code> it and <code>git commit</code>.",
        ],
        "Conflicts are normal, not a failure. Git only asks because only a human knows which change is right."
      );
    return ex(`${cmd} (refused)`, "Git refused to merge because it would overwrite changes you have not saved yet.", ["Your uncommitted edits touch files that the merge would change.", "Commit them or stash them, then try again."], "Git protects unsaved work. This refusal is on purpose.", true);
  };

  /* ================= SETUP ================= */
  def({
    id: "config", tab: "setup", btn: "git config", cmd: "git config --global user.name",
    desc: "Tell Git who you are", when: "Once, the first time you use Git on a computer.",
    can: () => (S.configured ? { why: "Already done. This is a one-time setup per computer.", out: [] } : null),
    run() {
      S.configured = true;
      return {
        cmd: ['git config --global user.name "You"', 'git config --global user.email "you@example.com"'], out: [],
        explain: ex("git config", "Every commit is stamped with an author name and email. This saves yours so Git can sign your work.", [
          "Saved in a file on your computer (<code>~/.gitconfig</code>). <code>--global</code> means it applies to every repository you use.",
          "Nothing is sent anywhere. GitHub matches commits to your account using the email.",
          "Without this, <code>git commit</code> refuses to run.",
        ], "Use the same email as your GitHub account so your commits show up under your profile."),
      };
    },
  });
  def({
    id: "ghcreate", tab: "setup", btn: "New repo on GitHub", cmd: "# github.com > New repository",
    desc: "Create the online copy (github.com)", when: "When starting a new project that should live on GitHub.",
    can: () => (S.hasRemote ? { why: "The GitHub repository already exists.", out: [] } : null),
    run() {
      const empty = S.hasLocal;
      G.opRemoteCreate(!empty);
      return {
        cmd: `# In your browser: github.com > New repository > "${G.REPO}"${empty ? "" : " (tick: Add a README)"}`, out: [], zones: ["remote"],
        anim: [{ from: "remote", to: "remote", label: "new repo" }],
        explain: ex("Create a repository on GitHub", "This happens on the GitHub website, not in Git. You are making an empty home on GitHub's servers where your project can live and be shared.",
          empty
            ? ["Because you already have a local repo, create the GitHub one <b>empty</b> (no README). GitHub then shows you the commands to connect them.", "Next: <code>git remote add origin</code> to link your computer to it, then <code>git push</code>."]
            : ["You ticked 'Add a README', so GitHub created the first commit for you. In the commit history it is a dashed circle: it exists only on GitHub.", "Your computer knows nothing about it yet. Next: <code>git clone</code> to download it."],
          "Git is the tool on your computer. GitHub is a website that hosts Git repositories. You can use Git without GitHub."),
      };
    },
  });
  def({
    id: "init", tab: "setup", btn: "git init", cmd: "git init",
    desc: "Turn a folder into a new local repo", when: "When you want to start tracking a folder on your own computer.",
    can: () =>
      S.hasLocal ? { why: "This folder is already a Git repository.", out: [`Reinitialized existing Git repository in ~/${G.REPO}/.git/`] }
      : S.hasRemote ? { why: "In this sandbox, if the GitHub repo already exists (with a README), use git clone instead. Connecting an unrelated local repo to it is a classic beginner trap.", out: [] } : null,
    run() {
      S.hasLocal = true;
      return {
        cmd: "git init", out: [`Initialized empty Git repository in ~/${G.REPO}/.git/`], zones: ["wd", "stage", "local"],
        explain: ex("git init", "Creates a hidden <code>.git</code> folder inside your project folder. That folder is the repository: it is where Git stores every commit.", [
          "Your folder becomes a Git project. Your files are untouched.", "The repository is empty. There are no commits yet.", "It exists only on your computer. GitHub does not know about it.",
        ], "Delete the .git folder and the project is just a normal folder again, with all your history gone."),
      };
    },
  });
  def({
    id: "remoteadd", tab: "setup", btn: "git remote add", cmd: `git remote add origin ${G.URL_SSH}`,
    desc: "Link your local repo to GitHub", when: "After git init, to connect your folder to a GitHub project.",
    can: () => needRepo() || (S.linked ? { why: "origin is already set up.", out: ["error: remote origin already exists."] } : !S.hasRemote ? { why: "There is no GitHub repository to point at yet. Create it first.", out: [] } : null),
    run() {
      S.linked = true;
      return {
        cmd: `git remote add origin ${G.URL_SSH}`, out: [], zones: ["local", "remote"], links: ["l-push", "l-fetch"],
        explain: ex("git remote add origin", "Saves a nickname (origin) for the GitHub address, so you can type <code>git push</code> instead of the full URL every time.", [
          "Nothing is sent over the network. It only stores the address in <code>.git/config</code>.", "<code>origin</code> is just the conventional name. <code>git clone</code> sets it up for you automatically.",
        ], "You only need this when you start local-first with git init. If you start with git clone, origin is already there."),
      };
    },
  });
  def({
    id: "clone", tab: "setup", btn: "git clone", cmd: `git clone ${G.URL_SSH}`,
    desc: "Download a GitHub repo to your computer", when: "To download an existing GitHub project to your computer.",
    can: () => S.hasLocal ? { why: "You already have a local copy.", out: [`fatal: destination path '${G.REPO}' already exists and is not an empty directory.`] }
      : !S.hasRemote ? { why: "There is nothing to clone yet. Create the repository on GitHub first.", out: [`fatal: repository '${G.URL_HTTP}' not found`] } : null,
    run() {
      G.opClone();
      return {
        cmd: `git clone ${G.URL_SSH}`,
        out: [`Cloning into '${G.REPO}'...`, "remote: Enumerating objects: 3, done.", "remote: Total 3 (delta 0), reused 0 (delta 0)", "Receiving objects: 100% (3/3), done."],
        zones: ["remote", "local", "wd"], links: ["l-fetch"],
        anim: [{ from: "remote", to: "local", label: "full history" }, { from: "local", to: "wd", label: "README.md", delay: 700 }],
        explain: ex("git clone", "Makes a complete copy of the GitHub repository on your computer: every file, every commit, the whole history.", [
          "Creates the project folder and the hidden <code>.git</code> folder (your local repository).",
          "Fills your working directory with the latest files so you can start editing.",
          "Sets up <code>origin</code> automatically, pointing at the GitHub repo.",
          "Creates <code>origin/main</code>, your computer's bookmark of where GitHub's main branch was at that moment.",
        ], "Clone once per project. After that you use pull to get new changes. You do not clone again."),
      };
    },
  });

  /* ================= DAILY LOOP ================= */
  const NAMES = ["index.html", "style.css", "app.js", "notes.txt"];
  def({
    id: "edit", tab: "daily", btn: "Edit a file", cmd: "# edit a file in your editor and save",
    desc: "Not a git command: change files in your editor", when: "Any time. This is you doing your real work.",
    can: () => (S.hasLocal ? null : { why: "There is no project folder yet. Run git init or git clone first.", out: [] }),
    run() {
      let name = NAMES.find((n) => !(n in S.work));
      const isNew = !!name;
      if (!name) name = NAMES[S.counters.edit % NAMES.length];
      S.work[name] = G.contentFor(name);
      return {
        cmd: isNew ? `# create ${name} in your editor and save` : `# change ${name} in your editor and save`, out: [], zones: ["wd"],
        anim: [{ from: "wd", to: "wd", label: name }],
        explain: ex(isNew ? `Create ${name}` : `Edit ${name}`, "This is just you working. Git does not run and does not notice until you ask it to (git status).", [
          isNew ? "A brand-new file is <b>untracked</b>: it exists in your folder, but Git is not watching it yet." : "The file is now <b>modified</b>: it differs from the last commit.",
          "Changes live only in your working directory at this point. They are not safe in history yet.",
        ], "Edit a file that is already staged and it appears twice: the staged version AND a newer unstaged one. Staging takes a snapshot of the file at the moment you run git add."),
      };
    },
  });
  def({
    id: "editshared", tab: "daily", btn: "Edit index.html", cmd: "# change index.html in your editor and save",
    desc: "Change the main page (the same file on every branch)", when: "To make a change that can clash with someone else's edit of the same file.",
    can: () => (S.hasLocal ? null : { why: "There is no project folder yet. Run git init or git clone first.", out: [] }),
    run() {
      const isNew = !("index.html" in S.work);
      S.work["index.html"] = G.contentFor("index.html");
      return {
        cmd: `# ${isNew ? "create" : "change"} index.html in your editor and save`, out: [], zones: ["wd"],
        anim: [{ from: "wd", to: "wd", label: "index.html" }],
        explain: ex("Edit index.html", "You changed the main page. Because every branch has this same file, two people changing it differently is how merge conflicts happen.", [
          "The file is now <b>modified</b> in your working directory.", "Nothing is saved to history until you add and commit.",
        ], "Small, focused commits make conflicts rarer and easier to solve."),
      };
    },
  });
  def({
    id: "status", tab: "daily", ro: true, btn: "git status", cmd: "git status",
    desc: "What has changed? What is staged?", when: "Any time you are unsure what state things are in.",
    can: needRepo,
    run() {
      const out = [`On branch ${S.head}`];
      if (!G.headId()) out.push("", "No commits yet");
      const ab = G.aheadBehind();
      if (ab) {
        const T = `'origin/${S.head}'`;
        if (!ab.ahead && !ab.behind) out.push(`Your branch is up to date with ${T}.`);
        else if (ab.ahead && !ab.behind) out.push(`Your branch is ahead of ${T} by ${plural(ab.ahead, "commit")}.`, '  (use "git push" to publish your local commits)');
        else if (!ab.ahead && ab.behind) out.push(`Your branch is behind ${T} by ${plural(ab.behind, "commit")}, and can be fast-forwarded.`, '  (use "git pull" to update your local branch)');
        else out.push(`Your branch and ${T} have diverged,`, `and have ${ab.ahead} and ${ab.behind} different commits each, respectively.`, '  (use "git pull" to merge the remote branch into yours)');
      }
      const fl = G.fileList(), st = fl.filter((f) => f.staged), un = fl.filter((f) => f.unstaged), ut = fl.filter((f) => f.untracked), cf = fl.filter((f) => f.conflicted);
      if (S.conflict) {
        out.push("", "You have unmerged paths.", '  (fix conflicts and run "git commit")', '  (use "git merge --abort" to abort the merge)');
        if (cf.length) { out.push("", "Unmerged paths:"); cf.forEach((f) => out.push({ t: `\tboth modified:   ${f.name}`, c: "err" })); }
      }
      if (st.length) { out.push("", "Changes to be committed:"); st.forEach((f) => out.push({ t: `\t${f.isNew ? "new file:   " : "modified:   "}${f.name}`, c: "ok" })); }
      if (un.length) { out.push("", "Changes not staged for commit:"); un.forEach((f) => out.push({ t: `\tmodified:   ${f.name}`, c: "err" })); }
      if (ut.length) { out.push("", "Untracked files:"); ut.forEach((f) => out.push({ t: `\t${f.name}`, c: "err" })); }
      if (!st.length && !un.length && !ut.length && !cf.length) out.push("", G.headId() ? "nothing to commit, working tree clean" : 'nothing to commit (create/copy files and use "git add" to track)');
      return {
        cmd: "git status", out, zones: ["wd", "stage"],
        explain: ex("git status", "Your dashboard. It reports what Git sees in your working directory and staging area. It never changes anything.", [
          "<b>Green</b>: staged, will go into the next commit.", "<b>Red</b>: changed or new, but not staged yet.", "The 'ahead / behind' line compares your branch with your <i>last known</i> copy of GitHub.",
        ], "Status does not contact GitHub. If a teammate pushed, you will not see 'behind' until you run git fetch or git pull. Run git status often."),
      };
    },
  });
  def({
    id: "diff", tab: "daily", ro: true, btn: "git diff", cmd: "git diff",
    desc: "Show line-by-line changes not yet staged", when: "To see exactly which lines you changed.", can: needRepo,
    run() {
      const out = [];
      G.fileList().filter((f) => f.unstaged || f.conflicted).forEach((f) => {
        if (f.conflicted) { out.push(`diff --cc ${f.name}`); f.w.split("\n").forEach((l) => out.push({ t: `++${l}`, c: "out" })); return; }
        out.push(`diff --git a/${f.name} b/${f.name}`, `--- a/${f.name}`, `+++ b/${f.name}`, "@@ -1 +1 @@", { t: `-${f.i}`, c: "err" }, { t: `+${f.w}`, c: "ok" });
      });
      return {
        cmd: "git diff", out, zones: ["wd"],
        explain: ex("git diff", "Shows exactly which lines changed in your working directory compared with what is staged (or committed, if nothing is staged).", [
          "<b>-</b> lines were removed, <b>+</b> lines were added.", out.length ? "Only tracked files that changed after your last git add are shown." : "No output means there are no unstaged changes to tracked files.",
        ], "Gotcha: git diff ignores brand-new untracked files, and ignores anything already staged. Use git diff --staged to review what you are about to commit."),
      };
    },
  });
  def({
    id: "diffstaged", tab: "daily", ro: true, btn: "git diff --staged", cmd: "git diff --staged",
    desc: "Review what you are about to commit", when: "Right before committing, to double-check.", can: needRepo,
    run() {
      const out = [];
      G.staged().forEach((f) => {
        out.push(`diff --git a/${f.name} b/${f.name}`);
        if (f.isNew) out.push("new file mode 100644", "@@ -0,0 +1 @@");
        else { out.push("@@ -1 +1 @@"); out.push({ t: `-${f.h}`, c: "err" }); }
        out.push({ t: `+${f.i}`, c: "ok" });
      });
      return {
        cmd: "git diff --staged", out, zones: ["stage"],
        explain: ex("git diff --staged", "Shows the changes sitting in the staging area: exactly what the next commit will contain.", ["A good habit is to run this right before every commit.", out.length ? "These are the changes that git commit will record." : "Nothing is staged right now."], "Also written as git diff --cached. Both mean the same thing."),
      };
    },
  });
  def({
    id: "add", tab: "daily", btn: "git add .", cmd: "git add .",
    desc: "Stage changes for the next commit", when: "After changing files, to choose what goes in the next commit.",
    can: () => {
      if (!S.hasLocal) return notRepo();
      const fl = G.fileList();
      if (fl.some((f) => f.conflicted && f.w.includes("<<<<<<<")))
        return { why: "The conflicted file still contains conflict markers (<<<<<<<, =======, >>>>>>>). Edit the file to fix it first. (Git itself would let you add it, but you would commit the markers.)", out: [] };
      if (!fl.some((f) => f.unstaged || f.untracked || f.conflicted)) return { why: "There is nothing new to stage. Change a file first.", out: [] };
      return null;
    },
    run() {
      const names = G.opStageAll();
      return {
        cmd: "git add .", out: [], zones: ["wd", "stage"], links: ["l-wd-stage"],
        anim: names.slice(0, 4).map((n, i) => ({ from: "wd", to: "stage", label: n, delay: i * 150 })),
        explain: ex("git add", "Moves your changes into the staging area: a waiting room where you choose exactly what goes into the next commit.", [
          "The <code>.</code> means 'everything in this folder'. You can also name one file: <code>git add index.html</code>.",
          "Git takes a snapshot of each file right now. Edit it again later and you must add again.", "Nothing is saved to history yet. This is just preparation.",
        ], "Why have a staging area? So you can change five files but commit only two of them as one tidy, logical change."),
      };
    },
  });
  def({
    id: "commit", tab: "daily", btn: "git commit", cmd: 'git commit -m "message"',
    desc: "Save the staged snapshot to history", when: "When your staged changes make one complete, sensible unit of work.",
    can: () => {
      if (!S.hasLocal) return notRepo();
      if (!S.configured) return { why: "Git does not know who you are yet. Run git config on the Setup tab first, then try again.", out: ["Author identity unknown", "", "*** Please tell me who you are.", "", "Run", '  git config --global user.email "you@example.com"', '  git config --global user.name "Your Name"', "", "fatal: unable to auto-detect email address"] };
      if (S.conflict) {
        if (S.conflict.files.length) return { why: "Some conflicted files are not resolved yet. Fix each file, then git add it, then commit.", out: S.conflict.files.map((n) => ({ t: `U\t${n}`, c: "err" })).concat([{ t: "error: Committing is not possible because you have unmerged files.", c: "err" }]) };
        return null;
      }
      if (!G.staged().length) return { why: "Nothing is staged, so there is nothing to commit. Use git add first.", out: ["On branch " + S.head, 'nothing added to commit but untracked files present (use "git add" to track)'] };
      return null;
    },
    run() {
      const merging = !!S.conflict;
      const staged = G.staged();
      const parent = G.headId();
      const custom = (G.ui.msg || "").trim();
      const msg = merging ? S.conflict.msg : custom || (staged.length === 1 ? `${staged[0].isNew ? "Add" : "Update"} ${staged[0].name}` : `Update ${staged.length} files`);
      const events = merging ? ["commit-merge"] : [];
      const id = G.opCommitIndex(msg, merging ? { parents: [parent, S.conflict.theirs] } : {});
      if (merging) S.conflict = null;
      G.ui.msg = "";
      const out = [`[${S.head}${parent ? "" : " (root-commit)"} ${id}] ${msg}`];
      if (!merging) {
        out.push(` ${plural(staged.length, "file")} changed, ${plural(staged.length, "insertion")}(+)`);
        staged.filter((f) => f.isNew).forEach((f) => out.push(` create mode 100644 ${f.name}`));
      }
      return {
        cmd: merging ? "git commit --no-edit" : `git commit -m "${msg}"`, out, events, zones: ["stage", "local"], links: ["l-stage-local"],
        anim: [{ from: "stage", to: "local", label: id }],
        explain: merging
          ? ex("git commit (finish the merge)", "You fixed the conflicts and told Git. This commit finishes the merge.", [
              `A <b>merge commit</b> <code>${id}</code> is created with two parents: your branch and the branch you merged.`, "Git pre-filled the commit message, so you do not have to write one.", "The merge is no longer in progress.",
            ], "After resolving a conflict the work is only on your computer. Push it to share it.")
          : ex("git commit", "Takes everything in the staging area and permanently records it as one commit: a labelled snapshot of your project at this moment.", [
              `A new commit <code>${id}</code> is added to your local history, pointing back to its parent. That chain of parents is the 'history'.`,
              `Your branch (<code>${esc(S.head)}</code>) and <code>HEAD</code> move forward to the new commit.`, "The staging area is now empty again.", "Still only on your computer. GitHub does not have it until you push.",
            ], "Write messages that say WHY, in the present tense: 'Fix login timeout'. Future you will be grateful."),
      };
    },
  });
  def({
    id: "log", tab: "daily", ro: true, btn: "git log --oneline", cmd: "git log --oneline",
    desc: "Show the history of commits", when: "To see the list of saved snapshots.", can: needCommit,
    run() {
      const ids = [...G.ancestors(G.headId())].sort((a, b) => G.bySeq(b, a));
      const out = ids.map((id) => {
        const deco = [];
        if (id === G.headId()) deco.push(`HEAD -> ${S.head}`);
        Object.entries(S.local.branches).forEach(([b, t]) => { if (t === id && b !== S.head) deco.push(b); });
        Object.entries(S.local.tracking).forEach(([b, t]) => { if (t === id) deco.push(`origin/${b}`); });
        Object.entries(S.local.tags).forEach(([t, tid]) => { if (tid === id) deco.push(`tag: ${t}`); });
        return `${id}${deco.length ? ` (${deco.join(", ")})` : ""} ${S.commits[id].msg}`;
      });
      return {
        cmd: "git log --oneline", out, zones: ["local"],
        explain: ex("git log", "Lists the commits in your local history, newest first. <code>--oneline</code> keeps it to one short line per commit.", [
          "The 7-character code is the start of the commit's unique ID (its hash).", "<code>HEAD -> main</code> means 'you are here, on main'. <code>origin/main</code> marks where GitHub's main was when you last talked to it.",
        ], "Press q to leave the log if it opens a scrolling view in a real terminal."),
      };
    },
  });

  /* ================= SYNC ================= */
  const pushCan = () => {
    if (!S.hasLocal) return notRepo();
    if (!S.hasRemote || !S.linked) return { why: "Git does not know where to push. Create the GitHub repo and run git remote add (or use git clone).", out: ["fatal: No configured push destination."] };
    if (!G.headId()) return { why: "You have no commits to push yet.", out: [`error: src refspec ${S.head} does not match any`, `error: failed to push some refs to '${G.URL_SSH}'`] };
    return midMerge();
  };
  def({
    id: "push", tab: "sync", btn: "git push", cmd: "git push -u origin main",
    desc: "Upload your commits to GitHub", when: "After committing, to upload your work to GitHub.", can: pushCan,
    run() {
      const r = G.opPush(false);
      const b = S.head;
      if (r.kind === "uptodate")
        return { cmd: `git push origin ${b}`, out: ["Everything up-to-date"], zones: ["local", "remote"], explain: ex("git push", "GitHub already has everything you have.", ["No commits are ahead of GitHub, so nothing was uploaded."], "Make a new commit first, then push.") };
      if (r.kind === "rejected")
        return {
          cmd: `git push origin ${b}`, events: ["push-rejected"], zones: ["remote"], links: ["l-push"],
          out: [
            { t: ` ! [rejected]        ${b} -> ${b} (${r.known ? "non-fast-forward" : "fetch first"})`, c: "err" }, { t: `error: failed to push some refs to '${G.URL_SSH}'`, c: "err" },
            { t: "hint: Updates were rejected because the remote contains work that you do", c: "hint" }, { t: "hint: not have locally. Integrate the remote changes (e.g. 'git pull')", c: "hint" }, { t: "hint: before pushing again.", c: "hint" },
          ],
          explain: ex("git push (rejected)", "GitHub refused your push. It has commits on this branch that are not in your history, so accepting yours would overwrite them.", [
            "Git protects shared history: a push is only allowed if it simply adds on top of what GitHub already has.",
            "Most often a teammate pushed first. Fix: run <code>git pull</code> to bring their commits in and combine them with yours, then push again.",
            "It also happens if you rewrote commits that were already pushed (amend, reset, rebase).",
          ], "Never be tempted by a plain git push --force here. It would erase your teammate's work on GitHub.", true),
        };
      const out = [`Enumerating objects: ${r.count * 3}, done.`, `Writing objects: 100% (${r.count * 3}/${r.count * 3}), done.`, `To ${G.URL_SSH}`, r.old ? `   ${r.old}..${r.L}  ${b} -> ${b}` : ` * [new branch]      ${b} -> ${b}`];
      if (r.first) out.push(`branch '${b}' set up to track 'origin/${b}'.`);
      const run = G.opCI(r.L, b);
      const events = (b !== "main" ? ["push-branch"] : []).concat(run ? [`ci-${run.status}`] : []);
      const anim = [{ from: "local", to: "remote", label: plural(r.count, "commit") }];
      if (run) anim.push({ from: "remote", to: "remote", label: `Actions: ${run.status}`, delay: 900 });
      return {
        cmd: `git push${r.first ? " -u" : ""} origin ${b}`, out, events, zones: ["local", "remote"], links: ["l-push"], anim,
        explain: ex("git push", "Uploads your new local commits to GitHub so they are backed up and visible to others.", [
          `Git works out which commits GitHub is missing (${plural(r.count, "commit")}) and sends only those.`,
          `GitHub's <code>${esc(b)}</code> branch ${r.old ? "moves forward to your latest commit" : "is created"}.`,
          `Your <code>origin/${esc(b)}</code> bookmark moves too, since you now know exactly where GitHub is.`,
          r.first ? "<code>-u</code> links your local branch to the GitHub one, so from now on plain <code>git push</code> and <code>git pull</code> just work." : "Only committed work is pushed. Uncommitted edits stay on your computer.",
          ...(run ? [`The push triggered a <b>GitHub Actions</b> workflow run: the checks <b>${run.status}</b>. See the Actions line in the GitHub box.`] : []),
        ], "Push sends commits, not your working files. If you forgot to commit, nothing happens."),
      };
    },
  });
  def({
    id: "forcepush", tab: "sync", btn: "git push --force-with-lease", cmd: "git push --force-with-lease",
    desc: "Overwrite GitHub's branch with yours (dangerous)", when: "Only on your own branch, after rewriting history you already pushed.",
    can: () => pushCan() || (!S.remote.branches[S.head] ? { why: "This branch is not on GitHub yet, so a normal push works. Force is only for overwriting.", out: [] } : null),
    run() {
      const r = G.opPush(true);
      if (r.kind === "uptodate") return { cmd: "git push --force-with-lease", out: ["Everything up-to-date"], zones: ["remote"], explain: ex("git push --force-with-lease", "GitHub already matches your branch.", ["Nothing to overwrite."], "Force is only needed after rewriting history.") };
      return {
        cmd: "git push --force-with-lease", zones: ["local", "remote"], links: ["l-push"], anim: [{ from: "local", to: "remote", label: "overwrite" }],
        out: [`To ${G.URL_SSH}`, ` + ${r.old ? r.old : "0000000"}...${r.L} ${S.head} -> ${S.head} (forced update)`],
        explain: ex("git push --force-with-lease", "Replaces GitHub's copy of this branch with yours, even though that throws away commits GitHub had.", [
          "The old commits disappear from the GitHub branch.", "<code>--force-with-lease</code> is the safer kind of force: it refuses if someone pushed something you have not seen.",
        ], "Rule of thumb: force-push only to your own feature branches. Never to main on a shared project."),
      };
    },
  });
  def({
    id: "fetch", tab: "sync", btn: "git fetch", cmd: "git fetch",
    desc: "Download GitHub's new commits (safe, no merge)", when: "To see what is new on GitHub without changing your work.",
    can: () => needRepo() || (!S.linked || !S.hasRemote ? { why: "There is no remote to fetch from.", out: ["fatal: No remote repository specified."] } : null),
    run() {
      const f = G.opFetch();
      const n = f.ups.reduce((s, u) => s + [...G.ancestors(u.id)].filter((c) => !u.old || !G.ancestors(u.old).has(c)).length, 0);
      if (!f.ups.length && !f.tags.length)
        return { cmd: "git fetch", out: [], zones: ["remote"], links: ["l-fetch"], explain: ex("git fetch", "Asked GitHub for news. There was none, so nothing changed.", ["Fetch prints nothing when there is nothing new. That is normal."], "Fetch is always safe: it never changes your files or branches.") };
      return {
        cmd: "git fetch", out: fetchLines(f), zones: ["remote", "local"], links: ["l-fetch"], anim: [{ from: "remote", to: "local", label: n ? plural(n, "commit") : "tags" }],
        explain: ex("git fetch", "Downloads new commits from GitHub into your local repository, but does NOT touch your branches or your files.", [
          "Only the <code>origin/...</code> bookmarks move. Your own branches stay where they were.", "Now <code>git status</code> can tell you that you are behind. You can inspect the new commits before deciding to merge.",
        ], "Fetch = look at what is new. Pull = fetch + merge. When in doubt, fetch first."),
      };
    },
  });
  def({
    id: "fetchprune", tab: "sync", btn: "git fetch --prune", cmd: "git fetch --prune",
    desc: "Fetch, and forget bookmarks of branches deleted on GitHub", when: "After a branch was deleted on GitHub, to tidy your origin/... bookmarks.",
    can: () => needRepo() || (!S.linked || !S.hasRemote ? { why: "There is no remote to fetch from.", out: ["fatal: No remote repository specified."] } : null),
    run() {
      const f = G.opFetch();
      const gone = G.opPrune();
      const out = fetchLines(f);
      if (gone.length) { if (!out.length) out.push(`From ${G.URL_HTTP}`); gone.forEach((b) => out.push(` - [deleted]         (none)     -> origin/${b}`)); }
      return {
        cmd: "git fetch --prune", out, zones: ["remote", "local"], links: ["l-fetch"],
        explain: ex("git fetch --prune", gone.length ? "Downloaded news and removed your bookmarks for branches that no longer exist on GitHub." : "Nothing to clean up. Every bookmark still has a matching branch on GitHub.", [
          "Without <code>--prune</code>, a stale <code>origin/branch</code> bookmark hangs around after the branch is deleted on GitHub.", "Only the bookmarks are removed. Your own local branches are never touched.",
        ], "Many people turn this on permanently with: git config --global fetch.prune true"),
      };
    },
  });
  def({
    id: "pull", tab: "sync", btn: "git pull", cmd: "git pull",
    desc: "Fetch from GitHub, then merge into your branch", when: "Before starting work, or when GitHub has new commits.",
    can: () => needRepo() || midMerge() || (!S.linked || !S.hasRemote ? { why: "There is no remote to pull from.", out: ["fatal: No remote repository specified."] }
      : !S.remote.branches[S.head] ? { why: `Branch '${S.head}' does not exist on GitHub yet, so there is nothing to pull. Push it first.`, out: ["There is no tracking information for the current branch.", `  git branch --set-upstream-to=origin/<branch> ${S.head}`] } : null),
    run() {
      const f = G.opFetch();
      const T = S.remote.branches[S.head];
      const r = G.opMerge(T, `origin/${S.head}`, `Merge branch '${S.head}' of ${G.URL_HTTP}`);
      const n = f.ups.reduce((s, u) => s + [...G.ancestors(u.id)].filter((c) => !u.old || !G.ancestors(u.old).has(c)).length, 0);
      const anim = [];
      if (n) anim.push({ from: "remote", to: "local", label: plural(n, "commit") });
      if (r.changed && r.changed.length) anim.push({ from: "local", to: "wd", label: r.changed[0], delay: 800 });
      const ex2 = G.mergeExplain(r, "git pull", `origin/${S.head}`);
      if (r.kind === "ff") ex2.steps.unshift("Pull is two steps in one: <code>git fetch</code> then <code>git merge</code>.");
      return { cmd: "git pull", out: [...fetchLines(f), ...G.mergeLines(r)], events: r.kind === "merge" ? ["pull-merge"] : r.kind === "conflict" ? ["merge-conflict"] : [], zones: ["remote", "local"], links: ["l-fetch"], anim, explain: ex2 };
    },
  });
  const teammate = (id, btn, files, msg, desc) =>
    def({
      id, tab: "sync", btn, cmd: "# a teammate pushes to GitHub", desc, when: "Practice only: see what happens when someone else pushes.",
      can: () => (!S.hasRemote || !S.remote.branches.main ? { why: "GitHub needs a repository with at least one commit first.", out: [] } : null),
      run() {
        S.counters.team++;
        const f = typeof files === "function" ? files() : files;
        G.opTeammate(f, typeof msg === "function" ? msg() : msg, "main");
        return {
          cmd: "# a teammate pushes a commit to GitHub from their own computer", out: [], zones: ["remote"], anim: [{ from: "remote", to: "remote", label: "teammate commit" }],
          explain: ex("Teammate pushes to GitHub", "This is a simulation of a colleague working on their own computer and pushing to the same GitHub repository.", [
            "GitHub's <code>main</code> now has a commit that you do not have. In the history chart it is a dashed circle that exists only on GitHub.",
            "Your computer has no idea yet. <code>git status</code> still says 'up to date' because it only knows what you last fetched.",
            "Try <code>git fetch</code> or <code>git pull</code> next.",
          ], "This is why shared projects need pull and push: everyone has their own full copy, and GitHub is the meeting point."),
        };
      },
    });
  teammate("teammate", "Teammate pushes", () => ({ "team-notes.md": `team-notes.md: notes #${S.counters.team}` }), () => (S.counters.team === 1 ? "Add team notes" : "Update team notes"), "Simulate a colleague adding a commit to main on GitHub");
  teammate("teammateindex", "Teammate edits index.html", () => ({ "index.html": `index.html: edit by teammate #${S.counters.team}` }), "Update index.html (teammate)", "Simulate a colleague changing index.html and pushing it");
})();
