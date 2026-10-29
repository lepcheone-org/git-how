/* Coach: plain-English description of where you are, which commands are the right next step, and the guided scenarios. */
(function () {
  "use strict";
  const G = window.GV, S = G.S, { esc, plural } = G;
  const ev = (n) => (S.ev[n] || 0) > 0;
  const list = (arr) => arr.map((x) => `<code>${esc(typeof x === "string" ? x : x.name)}</code>`).join(", ");
  const step = (situation, best, reasons, fine) => ({ situation, best, reasons: reasons || {}, fine: fine || {} });
  const linked = () => S.hasRemote && S.linked;
  const L = () => G.headId();
  const R = () => S.remote.branches[S.head];
  const news = () => linked() && R() && (!L() || !G.ancestors(L()).has(R()));
  const unpushed = () => linked() && L() && (!S.remote.objs.has(L()) || (S.head === "main" && !R()));
  const unmerged = (b) => S.local.branches[b] && L() && !G.isAnc(S.local.branches[b], L());

  /* ---------- building blocks ---------- */
  const commitStep = () => {
    const st = G.staged(), rest = [...G.unstaged(), ...G.untracked()];
    return step(
      `<p><b>You have picked changes for your next save point.</b> These files are in the <b>Staging Area</b>: ${list(st)}.</p>` +
        '<p>Staged means "ready to be saved". They are not in your history yet. A <b>commit</b> permanently records them as one snapshot, with a short message that describes the change.</p>' +
        (rest.length ? `<p class="note"><b>Heads-up:</b> ${list(rest)} changed but not staged. A commit now would leave ${rest.length === 1 ? "it" : "them"} out.</p>` : ""),
      ["commit"],
      { commit: "<b>git commit</b> takes everything in the Staging Area and saves it permanently as one snapshot with a message. Your work is now safely recorded in your local history." },
      { diffstaged: "Excellent habit: reviewing exactly what you are about to commit.", add: "That works. It re-stages newer edits so they join the commit. But the files already staged are still waiting to be committed." }
    );
  };
  const addStep = () =>
    step(
      `<p><b>You have changed files, but Git has not saved anything yet.</b> In your Working Directory (the normal folder on your computer) these have changes: ${list([...G.unstaged(), ...G.untracked()])}.</p>` +
        "<p>Think of a commit as taking a photo of your project. Before the photo, you decide <b>what goes in the frame</b>. That choosing step is called <b>staging</b>.</p>",
      ["add"],
      { add: "<b>git add</b> moves your changes into the Staging Area, which means you are choosing what goes into the next snapshot. Git only saves what is staged, so this has to come before the commit." }
    );
  const pushStep = () => {
    const k = L() ? [...G.ancestors(L())].filter((c) => !S.remote.objs.has(c)).length : 0;
    const branchOnly = S.head !== "main" && !R();
    return step(
      branchOnly
        ? `<p><b>Your branch <code>${esc(S.head)}</code> exists only on your computer.</b> GitHub has never heard of it, so nobody else can see it and you cannot open a pull request for it.</p><p>Publishing it means pushing it to GitHub.</p>`
        : `<p><b>You have saved work that only exists on your computer.</b> ${plural(k, "commit")} in your local history ${k === 1 ? "has" : "have"} not been uploaded to GitHub (the ring-shaped dots in the history).</p><p>Until you <b>push</b>, nobody else can see your work, and if your computer breaks, it is gone.</p>`,
      ["push"],
      { push: branchOnly ? "<b>git push</b> creates the branch on GitHub and uploads your commits. The first push also links your local branch to the GitHub one." : "<b>git push</b> uploads your new commits to GitHub. That backs your work up and shares it. Afterwards the ring-shaped dots become solid, meaning both places have them." + (S.local.tracking[S.head] ? "" : " The first push also links your local branch to the one on GitHub.") }
    );
  };
  const pullStep = () => {
    const n = [...G.ancestors(R())].filter((c) => !L() || !G.ancestors(L()).has(c)).length;
    const div = unpushed();
    return step(
      `<p><b>GitHub has new work that your computer does not have.</b> Someone else added ${plural(n, "commit")} to GitHub. In the commit history, those are the dashed circles.</p>` +
        (div ? "<p>You <i>also</i> have commits that GitHub does not have, so the two histories have <b>diverged</b> (gone in different directions). GitHub will refuse your push until you combine them.</p>" : "<p>Your computer cannot see them yet, because Git only talks to GitHub when you tell it to.</p>"),
      ["pull"],
      { pull: div ? "<b>git pull</b> downloads your teammate's commits and <b>merges</b> them with yours into one history. You must do this before GitHub will accept your push." : "<b>git pull</b> downloads the new commits and updates your files so you are working on the latest version. Always pull before starting new work." },
      { fetch: "<b>git fetch</b> is the careful half of pull: it downloads the new commits but does not change your files or branch. It is a safe way to look first. To bring them into your work, you still need to pull." }
    );
  };
  const editStep = () =>
    step(
      (L()
        ? "<p><b>Everything is in sync.</b> Your folder, your local history, and GitHub all match. Nothing is waiting to be staged, committed, or pushed.</p>"
        : "<p><b>The repository is empty.</b> There are no files and no commits yet.</p>") + "<p>This is the start of the everyday cycle: <b>edit, then add, then commit, then push</b>. It begins with you changing a file in your editor.</p>",
      ["edit"],
      { edit: "Everything in Git starts with you changing something. Git does not create changes. It keeps track of them. Edit or create a file, then Git can notice it." },
      { teammate: "Good experiment: this pretends a colleague pushed to GitHub, so you can practise pulling. In real life this happens on their computer.", pull: "That works, but there was nothing new to download. Pulling before you start work is still a good habit.", fetch: "That works, but there was nothing new to download." }
    );

  /* ---------- interrupt: a merge stopped on conflicts ---------- */
  const conflictStep = () => {
    const cf = G.conflicted(), unresolved = cf.filter((f) => f.w.includes("<<<<<<<"));
    const head =
      `<p><b>A merge stopped on a conflict.</b> Git could not combine ${cf.length ? list(cf) : "some files"} automatically.</p>` +
      "<p>Both sides changed the same lines. Git marked the clash inside the file with <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code>, <code>=======</code> and <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code>, then paused and is waiting for you. Nothing is lost.</p>";
    const fine = { mergeabort: "That is a valid escape: it cancels the merge and puts everything back as it was. You can try again later.", diff: "Useful: you can see the conflicting lines.", status: "Good: status shows which files are in conflict." };
    if (unresolved.length) {
      if (!ev("status")) return step(head, ["status"], { status: "Always look first. <b>git status</b> lists exactly which files are 'both modified' (in conflict) and what to do next." }, { resolve: "That works too. Checking status first is a good habit, but you can jump straight to fixing the file.", ...fine });
      return step(head + "<p>Next you open the file and decide what the final text should be.</p>", ["resolve"], { resolve: "Only you know which change is right (or whether to keep both). You edit the file so it holds the final text and delete the three marker lines." }, fine);
    }
    if (S.conflict.files.length) return step(head + `<p>You fixed ${list(cf)}, but Git does not know yet. You must stage it.</p>`, ["add"], { add: "<b>git add</b> tells Git 'this file is resolved, I am happy with it'. Git will not finish the merge until every conflicted file is staged." }, fine);
    return step(head + "<p>Every conflicted file is resolved and staged. One step left.</p>", ["commit"], { commit: "<b>git commit</b> finishes the merge. Git has already prepared a commit message for the merge, so you do not need to write one." }, fine);
  };

  /* ---------- generic coach (free play and scenario fallback) ---------- */
  G.generic = () => {
    const st = G.staged(), un = G.unstaged(), ut = G.untracked();
    if (!S.configured && !S.hasLocal && !S.hasRemote)
      return step(
        "<p><b>You are at the very beginning.</b> Git is installed on your computer, but there is no project yet. All the boxes above are empty.</p><p>Before anything else, Git needs to know <b>who you are</b>. Every time you save your work in Git (called a <b>commit</b>), your name and email are stamped on it, so teammates can see who made which change.</p>",
        ["config"],
        { config: "Git needs your name and email before it will let you save (commit) anything. You do this <b>once per computer</b>, and it is the normal first step." },
        { ghcreate: "That works, and the order here is flexible. But Git will refuse your first commit until you set your identity, so it is simplest to do it first.", init: "That works, and the order is flexible. But Git will refuse your first commit until you set your identity." }
      );
    if (!S.configured && st.length)
      return step(`<p><b>You are about to make your first commit, but Git still does not know who you are.</b> Staged and ready: ${list(st)}.</p><p>Git stamps your name and email on every commit, and it will refuse to commit without them.</p>`, ["config"], { config: "A commit needs an author name and email. You set them once per computer, and then commits work from now on." });
    let r;
    if (!S.hasLocal && !S.hasRemote)
      r = step(
        "<p><b>Your identity is saved. Now you need a project.</b> There is nothing on GitHub and nothing on your computer yet.</p><p>There are two common ways to start:</p><ul><li><b>Route A:</b> create the project on GitHub, then <b>clone</b> (download) it to your computer.</li><li><b>Route B:</b> make a repo on your computer with <code>git init</code>, then connect it to GitHub later.</li></ul>",
        ["ghcreate"],
        { ghcreate: "GitHub is where your project lives online, so you have a backup and can share it. Creating it first also gives you something to <b>clone</b> next. This happens on the GitHub website, not with a Git command." },
        { init: "That is Route B and it is valid: you create the repo on your computer first and connect it to GitHub afterwards. Route A has fewer steps for a beginner." }
      );
    else if (S.hasRemote && !S.hasLocal)
      r = step("<p><b>The project exists on GitHub, but not on your computer.</b> The GitHub box above has a commit called <code>Initial commit</code> with a README file. Your three local boxes are empty and dimmed.</p><p>To work on it, you need your own copy on your computer.</p>", ["clone"], { clone: "<b>git clone</b> downloads a complete copy of the GitHub project (all files and the full history) and automatically connects the copy back to GitHub. It is the standard way to start working on an existing project." });
    else if (st.length) r = commitStep();
    else if (un.length || ut.length) r = addStep();
    else if (S.hasLocal && !S.hasRemote && !L()) r = editStep();
    else if (S.hasLocal && !S.hasRemote)
      r = step("<p><b>You have a repository with commits on your computer, but nothing on GitHub.</b> Right now your project exists in only one place: no backup, and nobody else can see it.</p><p>You need a matching project on GitHub to send your work to.</p>", ["ghcreate"], { ghcreate: "A local repo needs an online partner to push to. You create it <b>empty</b> (no README) because your computer already has the starting point. Two different starting points would clash." });
    else if (!S.linked)
      r = step("<p><b>Both repositories exist, but they do not know about each other.</b> There is one on your computer and one on GitHub, with no connection between them yet.</p>", ["remoteadd"], { remoteadd: "This saves the GitHub address under the nickname <code>origin</code>. After that, <code>git push</code> knows where to send your work. (Cloning does this for you automatically.)" });
    else if (news()) r = pullStep();
    else if (unpushed()) r = pushStep();
    else r = editStep();
    if (!S.configured && !r.best.includes("config")) r.fine.config = "Good to do now. Git will need your name and email before your first commit.";
    return r;
  };

  /* ---------- scenarios ---------- */
  const C = (ev_, text) => ({ ev: ev_, text });
  const scn = (o) => o;
  const SC = [];
  const add = (o) => SC.push(o);

  add(scn({
    id: "s1", title: "Start a project", tab: "setup",
    blurb: "Set up Git, create a project on GitHub, and download it.",
    intro: "Every Git journey starts here. You will tell Git who you are, create a project on GitHub, and download a copy to your computer.",
    setup() { G.reset(); },
    checklist: [C("config", "Tell Git who you are"), C("ghcreate", "Create the project on GitHub"), C("clone", "Download it (clone)")],
    coach: () => G.generic(),
  }));

  add(scn({
    id: "s2", title: "Save and share your work", tab: "daily",
    blurb: "Edit, stage, commit, push. The loop you will repeat every day.",
    intro: "You have a project on your computer. Now you will do the loop that makes up most of daily Git: change a file, save a snapshot (commit), and upload it to GitHub (push).",
    setup() { G.reset(); S.configured = true; G.opRemoteCreate(true); G.opClone(); },
    checklist: [C("edit", "Change a file"), C("status", "Check what Git sees"), C("add", "Stage the change"), C("commit", "Commit it"), C("push", "Push to GitHub"), C("log", "Look at the history")],
    coach() {
      const g = G.generic();
      if (g.best[0] === "add" && !ev("status")) { g.best = ["status"]; g.reasons.status = "Always look before you stage. <b>git status</b> shows which files changed and which are staged, so there are no surprises in your commit."; g.fine.add = "That works. It is a good habit to run git status first, but nothing went wrong."; }
      if (g.best[0] === "edit" && ev("push") && !ev("log")) { g.best = ["log"]; g.situation = "<p><b>Your work is on GitHub.</b> Everything matches. Let us look at the history you created.</p>"; g.reasons.log = "<b>git log</b> lists your commits, newest first. It is how you review what happened in a project."; }
      return g;
    },
  }));

  add(scn({
    id: "s3", title: "Start from an existing folder", tab: "setup",
    blurb: "Use git init, then connect the folder to GitHub.",
    intro: "Sometimes you already have a folder of files and want to put it under Git. You will turn it into a repo with git init, make the first commit, then create an empty GitHub repo and connect them.",
    setup() { G.reset(); S.configured = true; },
    checklist: [C("init", "Make the folder a repo (init)"), C("edit", "Create a file"), C("commit", "Make the first commit"), C("ghcreate", "Create an empty repo on GitHub"), C("remoteadd", "Connect them (remote add)"), C("push", "Push")],
    coach() {
      if (!S.hasLocal)
        return step("<p><b>You have a folder of work and want Git to track it.</b> Right now it is a normal folder: Git is not watching anything, and nothing is on GitHub.</p><p>The first move is to turn the folder into a Git repository.</p>", ["init"], { init: "<b>git init</b> creates the hidden <code>.git</code> folder that turns an ordinary folder into a repository. It is the starting gun for tracking a project locally." }, { ghcreate: "That works, but the usual order is to set up your local repo first, then create the GitHub one to match." });
      return G.generic();
    },
  }));

  add(scn({
    id: "s4", title: "Get your teammates' changes", tab: "sync",
    blurb: "A teammate pushes. You fetch and pull.",
    intro: "On a team, other people push to the same GitHub project. Your computer does not find out by itself. You will see how fetch and pull bring their work to you.",
    setup() { G.sim.base(); },
    checklist: [C("teammate", "A teammate pushes"), C("fetch", "Fetch (look, safely)"), C("pull", "Pull (bring it in)")],
    coach() {
      if (!ev("teammate")) return step("<p><b>Everything is in sync.</b> You and GitHub have the same commits. But you are on a team, and teammates push whenever they like.</p><p>Let us pretend one just did.</p>", ["teammate"], { teammate: "This simulates a colleague pushing a commit to GitHub from their own computer. You will then practise the commands that bring it to you." });
      if (news() && !ev("fetch")) {
        const g = pullStep();
        return step(g.situation + "<p>A careful first step is to <b>fetch</b>: download without changing your files.</p>", ["fetch"], { fetch: "<b>git fetch</b> downloads the new commits but leaves your files and branch alone, so it is perfectly safe. Afterwards you can see what is new before you decide to combine it with your work." }, { pull: "That works too: pull does a fetch and a merge in one go. Fetching first is the cautious option." });
      }
      return G.generic();
    },
  }));

  add(scn({
    id: "s5", title: "When histories diverge", tab: "sync",
    blurb: "GitHub rejects your push. Learn why and how to fix it.",
    intro: "You committed on your computer. Meanwhile a teammate pushed to GitHub. Now your history and GitHub's have gone in different directions. This is the most common 'Git error' beginners see.",
    setup() { G.sim.base(); G.sim.commit({ "style.css": "style.css: Basic styles" }, "Add style.css"); G.opTeammate({ "team-notes.md": "team-notes.md: Meeting notes" }, "Add team notes"); },
    checklist: [C("push-rejected", "Try to push and see it refused"), C("pull", "Pull to combine the histories"), C("push", "Push the combined result")],
    coach() {
      if (!ev("push-rejected") && news() && unpushed())
        return step("<p><b>You committed <code>Add style.css</code> on your computer. A teammate pushed <code>Add team notes</code> to GitHub.</b> You each added a commit on top of the same starting point, so the histories have <b>diverged</b>.</p><p>Let us try to push and see what GitHub does.</p>", ["push"], { push: "Go ahead and push. GitHub will <b>refuse</b>, and reading that error is the whole lesson. Git never lets you overwrite someone else's commits by accident." }, { pull: "That also works and fixes the problem, but you would skip seeing the rejection, which is worth experiencing once." });
      return G.generic();
    },
  }));

  add(scn({
    id: "s6", title: "Work on a branch", tab: "branch",
    blurb: "Create a branch, commit on it, and switch back to see the difference.",
    intro: "A branch is a separate line of work. You will create one, make a commit on it, and then switch back to main to see that main did not change at all.",
    setup() { G.sim.base(); },
    checklist: [C("switchnew", "Create and switch to a branch"), C("edit", "Change a file"), C("commit", "Commit on the branch"), C("switchmain", "Switch back to main"), C("branchlist", "List the branches")],
    coach() {
      if (!ev("switchnew"))
        return step("<p><b>You are on <code>main</code>, the main line of your project, and everything is saved.</b> You want to build something new without risking it.</p><p>The safe way is a <b>branch</b>: a separate line of work that does not touch main until you decide.</p>", ["switchnew"], { switchnew: "<b>git switch -c feature</b> creates a new branch called feature and moves you onto it. From now on your commits go on feature and main stays untouched." });
      const feat = S.local.branches.feature;
      if (S.head === "feature") {
        if (G.staged().length) return commitStep();
        if (G.unstaged().length || G.untracked().length) return addStep();
        if (feat === S.local.branches.main) return step("<p><b>You are on the new branch <code>feature</code>.</b> It points at the same commit as main for now, so nothing is different yet.</p><p>Make some work to put on it.</p>", ["edit"], { edit: "A branch only becomes interesting when it has its own commits. Change a file, then stage and commit it." });
        if (!ev("switchmain")) return step("<p><b>Your commit lives on <code>feature</code>.</b> Look at the history chart: feature has a commit that main does not.</p><p>Now go back to main and notice what happens to your files.</p>", ["switchmain"], { switchmain: "<b>git switch main</b> moves you back. Watch the Working Directory: the files from your feature commit disappear, because main does not have them. They are safe on feature." });
      }
      if (S.head === "main" && ev("switchmain") && !ev("branchlist")) return step("<p><b>You are back on <code>main</code>, and your feature file is gone from the folder.</b> It is not deleted: it lives on the feature branch.</p>", ["branchlist"], { branchlist: "<b>git branch -a</b> lists every branch and marks the one you are on with *. It is a quick way to see the lay of the land." });
      return G.generic();
    },
  }));

  const mergeScenario = (id, title, blurb, intro, setup, kind) =>
    add(scn({
      id, title, blurb, intro, tab: "merge", setup,
      checklist: [C("mergefeature", kind === "ff" ? "Merge feature (fast-forward)" : "Merge feature (merge commit)"), C("log", "Look at the history"), C("branch-deleted", "Delete the finished branch"), C("push", "Push")],
      coach() {
        if (S.head !== "main" && !ev("mergefeature")) return step("<p><b>You are on <code>feature</code>.</b> To merge feature <i>into</i> main you must stand on main, the branch that receives the work.</p>", ["switchmain"], { switchmain: "A merge always brings another branch into the one you are on. So first switch to main." });
        if (unmerged("feature"))
          return step(kind === "ff"
            ? "<p><b>You are on <code>main</code>. The <code>feature</code> branch has 2 commits that main does not.</b> Main itself has not moved since feature started.</p><p>Time to bring the finished work into main.</p>"
            : "<p><b>You are on <code>main</code>. Both <code>main</code> and <code>feature</code> have new commits</b> (on different files). The two lines have split apart.</p><p>Time to join them.</p>", ["mergefeature"], { mergefeature: kind === "ff" ? "<b>git merge feature</b> pulls feature's commits into main. Because main has not moved, Git just slides main forward: a <b>fast-forward</b>, with no extra commit." : "<b>git merge feature</b> combines both lines. Because each side has its own commits, Git creates a <b>merge commit</b> with two parents. The two sides touched different files, so it merges cleanly." });
        if (!ev("log")) return step("<p><b>The merge is done.</b> Main now contains the feature work.</p><p>Look at the history to see the shape it made.</p>", ["log"], { log: kind === "ff" ? "<b>git log</b> shows one straight line. A fast-forward leaves no trace of the branch." : "<b>git log</b> shows the merge commit at the top. The history chart shows two lines joining." });
        if (S.local.branches.feature) return step("<p><b>The feature branch has done its job.</b> All of its commits are now inside main.</p><p>Tidy up by deleting the label.</p>", ["branchd"], { branchd: "<b>git branch -d feature</b> deletes the branch label. It is the <b>safe</b> delete: Git only allows it because the work is already merged into main." }, { branchD: "That works, but -D is the forced delete. Use -d when the work is merged so Git can protect you." });
        if (unpushed()) return pushStep();
        return G.generic();
      },
    }));
  mergeScenario("s7", "Merge: fast-forward", "Bring a finished branch into main the simple way.", "Your feature branch is finished. You will merge it into main. Because main has not changed in the meantime, this is the easiest kind of merge: a fast-forward.",
    () => { G.sim.base(); G.opNewBranch("feature"); G.sim.commit({ "style.css": "style.css: Basic styles" }, "Add style.css"); G.sim.commit({ "app.js": "app.js: App code" }, "Add app.js"); G.opSwitch("main"); }, "ff");
  mergeScenario("s8", "Merge: merge commit", "Both branches moved. Git joins them with a merge commit.", "While you worked on a feature, main also got a new commit. The two lines have split. When you merge, Git creates a special merge commit to join them.",
    () => { G.sim.base(); G.opNewBranch("feature"); G.sim.commit({ "style.css": "style.css: Basic styles" }, "Add style.css"); G.opSwitch("main"); G.sim.commit({ "notes.txt": "notes.txt: Project notes" }, "Add notes.txt"); }, "merge");

  add(scn({
    id: "s9", title: "Fix a merge conflict", tab: "merge",
    blurb: "Two branches changed the same line. Resolve it by hand.",
    intro: "Main and feature both changed the same line of index.html. When you merge, Git cannot choose, so it asks you. Conflicts sound scary but follow a simple routine: look, fix, add, commit.",
    setup() { G.sim.base(); G.opNewBranch("feature"); G.sim.commit({ "index.html": "index.html: Welcome from the feature branch" }, "Change heading on feature"); G.opSwitch("main"); G.sim.commit({ "index.html": "index.html: Welcome from main" }, "Update heading on main"); },
    checklist: [C("merge-conflict", "Merge and hit the conflict"), C("status", "Check status"), C("resolve", "Fix the file"), C("add", "Mark it resolved (add)"), C("commit-merge", "Finish with a commit"), C("push", "Push")],
    coach() {
      if (!S.conflict && !ev("merge-conflict")) return step("<p><b>You are on <code>main</code>.</b> Both main and feature changed the heading line in <code>index.html</code>, in different ways.</p><p>Merge feature into main and see what Git does.</p>", ["mergefeature"], { mergefeature: "Git will try to merge feature into main automatically. Because the same line was changed on both sides, it cannot decide, and it will pause and ask you. That is the conflict you came here to practise." });
      if (!S.conflict && unpushed()) return pushStep();
      return G.generic();
    },
  }));

  add(scn({
    id: "s10", title: "Rebase for a straight history", tab: "merge",
    blurb: "Replay your branch on top of the latest main.",
    intro: "Main has moved on since you started your feature branch. Instead of a merge commit, you can rebase: Git replays your commits on top of the newest main, giving a clean straight line.",
    setup() { G.sim.base(); G.opNewBranch("feature"); G.sim.commit({ "style.css": "style.css: Basic styles" }, "Add style.css"); G.opSwitch("main"); G.sim.commit({ "notes.txt": "notes.txt: Project notes" }, "Add notes.txt"); G.opPush(); G.opSwitch("feature"); },
    checklist: [C("rebase", "Rebase onto main"), C("switchmain", "Switch to main"), C("mergefeature", "Merge (fast-forward)"), C("push", "Push")],
    coach() {
      if (S.head === "feature" && !ev("rebase")) return step("<p><b>You are on <code>feature</code>.</b> While you worked, main got a new commit (<code>Add notes.txt</code>). Your branch is built on the older main.</p><p>Look at the history chart: the lines have split.</p>", ["rebase"], { rebase: "<b>git rebase main</b> lifts your feature commits and replays them on top of the newest main, as if you had started today. The result is one straight line, with no merge commit." }, { mergemain: "That also works, but it adds a merge commit. This scenario is about the rebase alternative." });
      if (S.head === "feature") return step("<p><b>Your feature commits now sit on top of the newest main.</b> The history is a straight line.</p><p>To finish, go to main and bring them in.</p>", ["switchmain"], { switchmain: "Merging happens on the branch that receives the work, so move onto main." });
      if (unmerged("feature")) return step("<p><b>You are on <code>main</code>.</b> Feature is directly ahead of main in a straight line.</p>", ["mergefeature"], { mergefeature: "Because feature was rebased onto main, merging it is a clean <b>fast-forward</b>: main simply slides forward. No merge commit is needed." });
      if (unpushed()) return pushStep();
      return G.generic();
    },
  }));

  add(scn({
    id: "s11", title: "Pull request workflow", tab: "branch",
    blurb: "The full GitHub team workflow, from branch to merged PR.",
    intro: "This is how most teams work: never commit straight to main. You work on a branch, push it, open a pull request, a teammate reviews it, and it is merged on GitHub. Then you update your computer.",
    setup() { G.sim.base(); },
    checklist: [C("switchnew", "Create a branch"), C("commit", "Commit your work"), C("push-branch", "Push the branch"), C("openpr", "Open a pull request"), C("review", "Get it reviewed"), C("pr-merged", "Merge the PR"), C("pull", "Pull main"), C("branch-deleted", "Delete the local branch")],
    coach() {
      const pr = S.prs[0], feat = S.local.branches.feature;
      if (!pr) {
        if (!feat) return step("<p><b>You are on <code>main</code>.</b> On a team, nobody commits directly to main. All work happens on a branch and goes through a pull request.</p>", ["switchnew"], { switchnew: "Start every piece of work with a new branch: <b>git switch -c feature</b>. It keeps main safe and gives reviewers something to look at." });
        if (S.head !== "feature") return step("<p>You have a feature branch but you are not on it.</p>", ["switchfeature"], { switchfeature: "Move onto your feature branch to keep working on it." });
        if (G.staged().length) return commitStep();
        if (G.unstaged().length || G.untracked().length) return addStep();
        if (unpushed() || !S.remote.branches.feature) {
          if (feat === S.local.branches.main) return step("<p><b>You are on <code>feature</code>, but it has no work of its own yet.</b></p>", ["edit"], { edit: "Make your change in your editor first. Then stage and commit it." });
          return pushStep();
        }
        return step("<p><b>Your branch is on GitHub.</b> GitHub can now show the difference between <code>feature</code> and <code>main</code>.</p><p>To ask for it to be merged, you open a <b>pull request</b>.</p>", ["openpr"], { openpr: "A pull request is a proposal: 'please merge my branch into main'. It opens a discussion page where teammates review the change before it is merged." });
      }
      if (pr.state === "open") {
        if (!pr.approved) return step(`<p><b>Pull request #${pr.n} is open.</b> It is waiting for a review. Teams do this so a second person catches mistakes before they reach main.</p>`, ["review"], { review: "A teammate reads your change and approves it. Many teams <b>require</b> an approval before the merge button works." }, { mergepr: "That works (nothing forces a review here), but on real teams you would wait for approval first.", squashpr: "That works, but get the review first on a real team.", rebasepr: "That works, but get the review first on a real team." });
        return step(`<p><b>Pull request #${pr.n} is approved.</b> It is ready to merge.</p><p>GitHub offers three ways to merge. The default keeps every commit and adds a merge commit.</p>`, ["mergepr"], { mergepr: "<b>Merge pull request</b> merges the branch into main on GitHub with a merge commit. It keeps all your commits in the history." }, { squashpr: "<b>Squash and merge</b> works too: it collapses all the branch's commits into one on main. Note that afterwards git branch -d will complain, because Git does not see the original commits as merged.", rebasepr: "<b>Rebase and merge</b> works too: it replays the commits onto main with no merge commit." });
      }
      if (S.head === "feature") return step(`<p><b>Pull request #${pr.n} was merged on GitHub.</b> But your computer does not know yet, and you are still on the old feature branch.</p>`, ["switchmain"], { switchmain: "Go back to main, then pull to download the merge that happened on GitHub." });
      if (news()) return step("<p><b>The merge happened on GitHub, but your local main is behind.</b> GitHub's main has the merged work, your computer's main does not.</p>", ["pull"], { pull: "<b>git pull</b> brings GitHub's updated main down to your computer. Always do this after a PR is merged." }, { fetch: "That downloads the new commits but does not update main. Pull is what you want." });
      if (feat) return step("<p><b>Your computer is up to date with the merged PR.</b> The local feature branch is no longer needed.</p>", [G.isAnc(feat, L()) ? "branchd" : "branchD"], { branchd: "<b>git branch -d feature</b> removes the finished branch safely. Git allows it because the work is merged into main.", branchD: "Because the PR was squashed or rebased, Git does not see feature's original commits inside main, so the safe -d would refuse. <b>-D</b> (force) is correct here: the work is already on main in another form." }, { delremote: "Good housekeeping: GitHub also offers to delete the remote branch after a merge.", fetchprune: "Good housekeeping: this removes your stale origin/feature bookmark." });
      return G.generic();
    },
  }));

  add(scn({
    id: "s12", title: "Undo changes before committing", tab: "undo",
    blurb: "Unstage, stash, and discard edits you have not committed.",
    intro: "You are mid-work with some changes staged and some not, and things got messy. You will learn three ways to handle uncommitted work: unstage, stash, and discard.",
    setup() { G.sim.base(); S.work["index.html"] = "index.html: half-finished idea"; S.work["style.css"] = "style.css: new styles"; S.index["style.css"] = S.work["style.css"]; },
    checklist: [C("unstage", "Unstage a file"), C("stash", "Stash your work"), C("stashpop", "Bring it back"), C("restore", "Discard the edits")],
    coach() {
      if (G.staged().length && !ev("unstage")) return step(`<p><b>You staged <code>style.css</code> by mistake</b> (it is in the Staging Area), and you also have an unfinished edit to <code>index.html</code>.</p><p>You do not want <code>style.css</code> in the next commit.</p>`, ["unstage"], { unstage: "<b>git restore --staged .</b> takes files back out of the staging area. Your edits stay in your folder. It is the safe undo for git add." }, { restore: "Careful: restore discards edits, but it only affects <i>unstaged</i> changes, so it would not unstage style.css." });
      if (!ev("stash") && G.dirtyNames().length) return step("<p><b>Your unfinished edit to <code>index.html</code> is not ready to commit.</b> Suddenly you are asked to switch tasks.</p><p>You need a clean folder without throwing the work away.</p>", ["stash"], { stash: "<b>git stash</b> puts your uncommitted changes on a shelf and gives you a clean folder, exactly like the last commit. Perfect when you must switch tasks but are not ready to commit." }, { restore: "That would throw the work away, but you want to keep it. Stash saves it." });
      if (S.stash.length) return step("<p><b>Your work is on the shelf.</b> The folder is clean. Imagine you finished the urgent task.</p><p>Now get your unfinished work back.</p>", ["stashpop"], { stashpop: "<b>git stash pop</b> takes the most recent shelved changes, puts them back in your files, and removes them from the shelf." });
      if (!ev("restore") && G.unstaged().length) return step("<p><b>Your edit to <code>index.html</code> is back, and you have decided it was a bad idea.</b> You want to throw it away.</p>", ["restore"], { restore: "<b>git restore .</b> replaces your edited files with the last saved version. It is permanent: Git never saw those edits, so it cannot bring them back." }, { stash: "That saves it instead. Fine if you might want it later, but you decided to bin it." });
      return G.generic();
    },
  }));

  add(scn({
    id: "s13", title: "Fix the last commit", tab: "undo",
    blurb: "Amend, reset, and recover with the reflog.",
    intro: "You made two commits that you have not pushed. The last message is sloppy and the last change was an experiment you now regret. Because nothing is pushed, you can safely rewrite them.",
    setup() { G.sim.base(); G.sim.commit({ "style.css": "style.css: Basic styles" }, "Add style.css"); G.sim.commit({ "app.js": "app.js: experimental code" }, "Add experimental code (WIP)"); },
    checklist: [C("amend", "Amend the last commit"), C("resetsoft", "Undo it but keep the changes"), C("resethard", "Throw the commit away"), C("reflog", "Look in the reflog"), C("resetundo", "Recover the lost commit")],
    coach() {
      if (G.staged().length) return commitStep();
      if (!ev("amend")) return step("<p><b>Your last commit is called <code>Add experimental code (WIP)</code>.</b> 'WIP' means work in progress, which is not what you want in history. Nothing is pushed yet.</p>", ["amend"], { amend: "<b>git commit --amend</b> replaces the last commit with a new one, so you can fix its message. Because it has not been pushed, nobody else is affected. (Type a message in the box first, or leave it empty for an automatic fix.)" }, { resetsoft: "That also works as a way to redo the commit, but amend is the direct tool for a message fix." });
      if (!ev("resetsoft")) return step("<p><b>The last commit is fine now, but imagine you committed too early.</b> You would like to undo the commit while keeping the changes so you can commit again.</p>", ["resetsoft"], { resetsoft: "<b>git reset --soft HEAD~1</b> moves the branch back one commit but keeps all the changes staged. It is 'un-commit, keep the work'." }, { resetmixed: "Also valid: it un-commits but leaves the changes unstaged." });
      if (!ev("resethard")) return step("<p><b>You recommitted. Now you decide that experiment was wrong.</b> You want it completely gone: the commit and its changes.</p>", ["resethard"], { resethard: "<b>git reset --hard HEAD~1</b> moves the branch back one commit AND rewinds your files, discarding the changes. It is powerful and only safe for commits you have not pushed." });
      if (!ev("reflog")) return step("<p><b>The commit has vanished from the history chart.</b> Did Git really lose it? Not yet.</p>", ["reflog"], { reflog: "<b>git reflog</b> is Git's private diary of every place HEAD has been. Even after a hard reset, the 'lost' commit is listed here." });
      if (!ev("resetundo")) return step("<p><b>The reflog still lists the commit you threw away.</b> You have changed your mind.</p>", ["resetundo"], { resetundo: "<b>git reset --hard HEAD@{1}</b> jumps back to where HEAD was one move ago, which is the commit you discarded. Committed work is very hard to lose for good." });
      return G.generic();
    },
  }));

  add(scn({
    id: "s14", title: "Undo a pushed commit", tab: "undo",
    blurb: "Use revert when the bad commit is already on GitHub.",
    intro: "You pushed a commit that broke the homepage and your teammates may already have it. You must not rewrite shared history. The safe tool is git revert.",
    setup() { G.sim.base(); G.sim.commit({ "index.html": "index.html: BROKEN page" }, "Break the homepage"); G.opPush(); },
    checklist: [C("revert", "Revert the bad commit"), C("push", "Push the fix")],
    coach() {
      if (!ev("revert")) return step("<p><b>The latest commit, <code>Break the homepage</code>, is already on GitHub.</b> Others may have downloaded it.</p><p>You need to undo it without rewriting history that people already have.</p>", ["revert"], { revert: "<b>git revert HEAD</b> adds a <b>new</b> commit that does the exact opposite of the bad one. History is only added to, never rewritten, so it is safe for shared commits." }, { resethard: "That would undo it on your computer, but GitHub already has the bad commit, so your push would be rejected. For pushed commits, revert is the safe choice.", resetsoft: "That would undo it on your computer, but GitHub already has the bad commit, so your push would be rejected. Use revert for pushed commits." });
      if (unpushed()) return pushStep();
      return G.generic();
    },
  }));

  add(scn({
    id: "s15", title: "Ignore files and tag a release", tab: "extras",
    blurb: "Keep junk out of Git with .gitignore, then mark version 1.0.",
    intro: "Two everyday extras. First, keep files like logs out of your repository with a .gitignore file. Then mark a release with a tag and share it on GitHub.",
    setup() { G.sim.base(); },
    checklist: [C("mkdebuglog", "A log file appears"), C("status", "See it in status"), C("gitignore", "Create .gitignore"), C("commit", "Commit .gitignore"), C("push", "Push"), C("tag", "Tag a release"), C("pushtags", "Push the tag")],
    coach() {
      if (!ev("mkdebuglog")) return step("<p><b>Your project is in sync.</b> Now imagine your program creates a log file while it runs.</p>", ["mkdebuglog"], { mkdebuglog: "Running your app creates <code>debug.log</code>, a file that should never be in a repository. Click it to simulate that." });
      if (!ev("status")) return step("<p><b>A file called <code>debug.log</code> has appeared in your folder.</b></p>", ["status"], { status: "<b>git status</b> will show <code>debug.log</code> as untracked. It shows up every time, and <code>git add .</code> would commit it by accident." });
      if (!ev("gitignore")) return step("<p><b>Git lists <code>debug.log</code> as untracked, every single time.</b> It is noise, and one careless <code>git add .</code> would commit it.</p><p>You want Git to ignore it for good.</p>", ["gitignore"], { gitignore: "A <b>.gitignore</b> file lists patterns Git should ignore. <code>*.log</code> means 'every .log file'. Ignored files disappear from status and are skipped by git add." });
      if (G.staged().length) return commitStep();
      if (G.unstaged().length || G.untracked().length) return addStep();
      if (unpushed()) return pushStep();
      if (!ev("tag")) return step("<p><b>Everything is pushed.</b> You have reached a good moment to call it version 1.0.</p>", ["tag"], { tag: "<b>git tag v1.0</b> puts a permanent label on the current commit. Unlike a branch, a tag never moves, so it always marks exactly that release." });
      if (!ev("pushtags")) return step("<p><b>The tag exists only on your computer.</b> A normal git push does not send tags.</p>", ["pushtags"], { pushtags: "<b>git push --tags</b> uploads your tags so GitHub lists them under Tags and Releases." });
      return G.generic();
    },
  }));

  const prFlow = SC.find((s) => s.id === "s11").coach;
  const work = () => {
    if (G.staged().length) return commitStep();
    if (G.unstaged().length || G.untracked().length) return addStep();
    if (unpushed()) return pushStep();
    return null;
  };

  add(scn({
    id: "s16", title: "Track work with Issues", tab: "ci",
    blurb: "Open an issue, fix it on a branch, and let the PR close it.",
    intro: "On GitHub, work usually starts with an issue: a numbered note describing a bug or task. You will open one, fix it through a pull request that says 'Closes #1', and watch GitHub close the issue for you when the PR is merged.",
    setup() { G.sim.base(); },
    checklist: [C("openissue", "Open an issue"), C("switchnew", "Create a branch"), C("commit", "Commit the fix"), C("push-branch", "Push the branch"), C("openpr", "Open a PR linked to the issue"), C("review", "Get it reviewed"), C("issue-closed", "Merge: the issue closes itself"), C("pull", "Pull main"), C("branch-deleted", "Delete the local branch")],
    coach() {
      if (!S.issues.length) return step("<p><b>Everything is in sync.</b> A teammate tells you that the heading on the homepage is wrong.</p><p>Before you start, write it down so the team can see what is being fixed and why.</p>", ["openissue"], { openissue: "An <b>issue</b> is a numbered note on GitHub for a bug or task. Opening one first means the problem is recorded, discussed and trackable. It gets a number like #1 that you can link to." });
      const g = prFlow();
      const pr = S.prs[0], open = S.issues.find((i) => i.state === "open");
      if (pr && pr.state === "open" && pr.closes) g.situation += `<p>This pull request is linked to <b>issue #${pr.closes}</b> (its description says <code>Closes #${pr.closes}</code>), so merging it will close the issue.</p>`;
      if (open) g.fine.closeissue = "That works, but closing by hand skips the nicer way: a pull request that says 'Closes #" + open.n + "' closes the issue itself when it is merged.";
      return g;
    },
  }));

  add(scn({
    id: "s17", title: "Automatic checks with GitHub Actions", tab: "ci",
    blurb: "Add a workflow, watch checks fail, fix them, and merge.",
    intro: "GitHub Actions can run tests automatically every time you push. You will add a workflow, push a deliberate mistake to see a red failed check block the merge, fix it, and merge once the checks are green.",
    setup() { G.sim.base(); },
    checklist: [C("addworkflow", "Add a workflow file"), C("ci-passed", "Push it: checks pass"), C("viewactions", "Look at the Actions tab"), C("ci-failed", "Push a bug: checks fail"), C("fixbug", "Fix the bug"), C("pr-merged", "Merge the PR"), C("pull", "Pull main")],
    coach() {
      const pr = S.prs[0];
      if (!ev("ci-passed")) {
        if (!(G.WORKFLOW in S.work) && !(G.WORKFLOW in G.headSnap())) return step("<p><b>Your project has no automatic checks.</b> Every change relies on someone remembering to run the tests by hand.</p><p>GitHub Actions can do it for you, on every push.</p>", ["addworkflow"], { addworkflow: "A <b>workflow file</b> in <code>.github/workflows/</code> tells GitHub Actions when to run and what to do. Add it to your project like any other file." });
        return work() || G.generic();
      }
      if (!ev("viewactions")) return step("<p><b>You pushed the workflow, and GitHub ran it on your commit.</b> The result is in the GitHub box above (Actions: CI), and on GitHub itself in the Actions tab.</p>", ["viewactions"], { viewactions: "The <b>Actions</b> tab lists every run with a pass or fail result and the full log. Knowing where to look is half the skill." });
      if (!S.local.branches.feature) return step("<p><b>Checks are working.</b> Now work the safe way: on a branch.</p>", ["switchnew"], { switchnew: "Create a branch so your change goes through a pull request, where the checks will run before anything reaches main." });
      if (!pr) {
        if (!ev("ci-failed")) {
          if (!ev("bugedit")) return step("<p><b>You are on <code>feature</code>.</b> Let us pretend you make a mistake, so you can see the checks catch it.</p>", ["bugedit"], { bugedit: "This edit adds a deliberate bug. Commit and push it, and GitHub Actions will run the tests and report a failure." });
          return work() || G.generic();
        }
        return step("<p><b>Your push failed the checks (a red cross).</b> You still want to propose the change, so open a pull request and see how GitHub treats it.</p>", ["openpr"], { openpr: "The pull request page shows the failing check next to the merge button. This is how a reviewer sees at a glance that something is wrong." });
      }
      const w = work();
      if (w) return w;
      const chk = G.latestRun(S.remote.branches.feature);
      if (pr.state === "open" && chk && chk.status === "failed")
        return step(`<p><b>Pull request #${pr.n} has a failed check.</b> GitHub's branch protection will not let it merge while the check is red.</p>`, ["fixbug"], { fixbug: "Fix the mistake in your editor, then add, commit and push. Pushing to the same branch updates the PR and runs the checks again." }, { mergepr: "Try it if you like: the button is blocked while the check is red." });
      return prFlow();
    },
  }));

  G.SCENARIOS = SC;
  G.scenario = () => SC.find((s) => s.id === G.ui.scn) || null;
  G.scenarioComplete = (s) => !!s && s.checklist.every((c) => ev(c.ev));
  G.startScenario = (id) => {
    const s = SC.find((x) => x.id === id);
    G.ui.scn = id;
    s.setup();
    S.ev = {};
    G.ui.msg = "";
    G.ui.hint = false;
    G.ui.tab = s.tab;
    return s;
  };

  G.coach = () => {
    const s = G.scenario();
    if (!S.conflict && s && G.scenarioComplete(s)) return Object.assign(step("<p><b>Scenario complete.</b> You did every step on the checklist.</p><p>Pick the next scenario above, or keep experimenting with any command.</p>", [], {}, {}), { complete: true });
    const c = S.conflict ? conflictStep() : s ? s.coach() : G.generic();
    return c;
  };
})();
