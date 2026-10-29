/* Actions, part 4: GitHub Issues and GitHub Actions (all on the GitHub website). */
(function () {
  "use strict";
  const G = window.GV, S = G.S, { esc, ex } = G;
  const def = (o) => G.ACTIONS.push(o);
  const needRepo = () => (S.hasLocal ? null : G.notRepo());
  const needRemote = () => (S.hasRemote ? null : { why: "There is no GitHub repository yet.", out: [] });
  const openIssue = () => S.issues.find((i) => i.state === "open");
  const TITLES = ["Homepage heading is wrong", "Add a contact page", "Page loads slowly"];

  /* ================= ISSUES ================= */
  def({
    id: "openissue", tab: "ci", btn: "Open an issue", cmd: "# github.com > Issues > New issue",
    desc: "Write down a bug, task or idea on GitHub", when: "Before you start work, so the team knows what is being fixed and why.", can: needRemote,
    run() {
      const issue = { n: S.issues.length + 1, title: TITLES[S.issues.length % TITLES.length], state: "open" };
      S.issues.push(issue);
      return {
        cmd: `# github.com > Issues > New issue: "${issue.title}"`, out: [], zones: ["remote"], anim: [{ from: "remote", to: "remote", label: `Issue #${issue.n}` }],
        explain: ex("Open an issue", "An <b>issue</b> is a numbered note on GitHub: a bug report, a task or an idea. It is where the team discusses the work before and while it is done.", [
          `GitHub gave it the number <b>#${issue.n}</b>. People refer to it by that number.`,
          "Issues have a title, a description, comments, labels and an assignee.",
          "Issues are not part of your Git history. They live on GitHub only, so they never appear in the commit chart.",
        ], "Tip: a pull request that says 'Closes #1' in its description will close the issue automatically when it is merged."),
      };
    },
  });
  def({
    id: "closeissue", tab: "ci", btn: "Close the issue", cmd: "# github.com > Issues > Close issue",
    desc: "Mark the issue as finished", when: "When the work is done and it was not closed by a pull request.",
    can: () => needRemote() || (openIssue() ? null : { why: "There is no open issue to close.", out: [] }),
    run() {
      const i = openIssue();
      i.state = "closed";
      return {
        cmd: `# github.com > Issue #${i.n} > Close issue`, out: [], events: ["issue-closed"], zones: ["remote"], anim: [{ from: "remote", to: "remote", label: `#${i.n} closed` }],
        explain: ex("Close an issue", "Marks the issue as done. It stays on GitHub as a record, and you can reopen it.", ["You can close it by hand like this, or let a pull request close it automatically with <code>Closes #" + i.n + "</code>."], "Closing by pull request is neater: the issue, the code change and the review are all linked together."),
      };
    },
  });

  /* ================= GITHUB ACTIONS ================= */
  def({
    id: "addworkflow", tab: "ci", btn: "Add a workflow file", cmd: `# create ${G.WORKFLOW} in your editor`,
    desc: "In your editor: tell GitHub Actions what to run", when: "To make GitHub automatically test your code on every push.",
    can: () => needRepo() || (G.WORKFLOW in S.work ? { why: "The workflow file already exists.", out: [] } : null),
    run() {
      S.work[G.WORKFLOW] = "name: CI\non: [push, pull_request]\njobs: run the tests";
      return {
        cmd: `# in your editor: create ${G.WORKFLOW}`, out: [], zones: ["wd"], anim: [{ from: "wd", to: "wd", label: "ci.yml" }],
        explain: ex("Add a workflow file", "<b>GitHub Actions</b> is GitHub's built-in robot. You describe what it should do in a small text file, and GitHub runs it for you.", [
          `The file lives at <code>${G.WORKFLOW}</code> inside your project, so it is versioned like any other file.`,
          "This one says: <code>on: [push, pull_request]</code> (run whenever someone pushes or opens a PR) and <code>jobs:</code> (run the tests).",
          "It does nothing yet. It is just a new untracked file. It has to be committed and pushed before GitHub sees it.",
        ], "Actions can run tests, build your site, check formatting, or deploy. The common word for this is CI (continuous integration)."),
      };
    },
  });
  def({
    id: "bugedit", tab: "ci", btn: "Edit app.js (add a bug)", cmd: "# edit app.js in your editor and save",
    desc: "Practice: make a change that breaks the tests", when: "Practice only: to see GitHub Actions catch a mistake.", can: needRepo,
    run() {
      S.work["app.js"] = "app.js: BUG - this line breaks the tests";
      return {
        cmd: "# in your editor: change app.js (oops, you add a bug)", out: [], zones: ["wd"], anim: [{ from: "wd", to: "wd", label: "app.js" }],
        explain: ex("A mistake slips in", "Everyone makes mistakes. This edit contains a bug that the tests will catch.", ["Nothing happens until you commit and push. Then GitHub Actions will run the tests on your commit."], "This is exactly why CI exists: to catch problems before they reach main."),
      };
    },
  });
  def({
    id: "fixbug", tab: "ci", btn: "Fix the bug in app.js", cmd: "# fix app.js in your editor and save",
    desc: "Practice: repair the change so the tests pass", when: "After the checks failed.",
    can: () => needRepo() || (/BUG/.test(S.work["app.js"] || "") ? null : { why: "There is no bug in app.js to fix.", out: [] }),
    run() {
      S.work["app.js"] = "app.js: fixed";
      return {
        cmd: "# in your editor: fix app.js", out: [], zones: ["wd"], anim: [{ from: "wd", to: "wd", label: "app.js" }],
        explain: ex("Fix the bug", "You corrected the mistake. As always: add, commit and push to send the fix.", ["When you push to the same branch, the pull request updates and GitHub Actions runs again on the new commit."], "A new run replaces the red check with a green one."),
      };
    },
  });
  def({
    id: "viewactions", tab: "ci", ro: true, btn: "Look at the Actions tab", cmd: "# github.com > Actions",
    desc: "See the results of the automatic checks", when: "After a push, to see whether the checks passed.", can: needRemote,
    run() {
      const out = ["# github.com > Actions tab"];
      if (!S.runs.length) out.push("No workflow runs yet.");
      [...S.runs].reverse().forEach((r) => out.push({ t: `${r.status === "passed" ? "PASS" : "FAIL"}  CI #${r.n}  branch ${r.branch}  commit ${r.sha}`, c: r.status === "passed" ? "ok" : "err" }));
      return {
        cmd: "# github.com > Actions", out, zones: ["remote"],
        explain: ex("The Actions tab", "GitHub lists every workflow run here, with a green tick (passed) or red cross (failed), plus the full log of what happened.", [
          S.runs.length ? "Each line is one run, triggered by a push or merge." : "No runs yet: a workflow only runs once a <code>" + esc(G.WORKFLOW) + "</code> file has been pushed.",
          "On a pull request the same result shows as 'checks' near the merge button.",
        ], "Teams usually protect main so a pull request cannot be merged while its checks are red."),
      };
    },
  });
})();
