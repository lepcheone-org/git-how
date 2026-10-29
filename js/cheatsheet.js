/* Printable cheat sheet, built from the same command list the sandbox uses. */
(function () {
  "use strict";
  const G = window.GV, { esc } = G;
  const $ = (id) => document.getElementById(id);
  const SKIP = new Set(["teammate", "teammateindex", "mkdebuglog", "bugedit", "fixbug", "review", "editshared"]);

  const RULES = [
    "Pull before you start work, and before you push.",
    "Commit small and often. Write messages that say <b>why</b>.",
    "On a team, never commit straight to <code>main</code>. Use a branch and a pull request.",
    "Run <code>git status</code> whenever you are unsure.",
    "Never rewrite commits you already pushed (amend, reset, rebase). Use <code>git revert</code> instead.",
    "Never force-push a shared branch.",
    "Keep logs, builds and secrets out with <code>.gitignore</code>.",
    "Committed work is very hard to lose. Uncommitted work is not: commit it or stash it.",
  ];
  const ERRORS = [
    ["Author identity unknown", "Git does not know who you are.", "<code>git config --global user.name \"Name\"</code> and <code>user.email</code>"],
    ["nothing added to commit", "Nothing is staged.", "<code>git add .</code> then commit"],
    ["! [rejected] ... (fetch first)", "GitHub has commits you do not have.", "<code>git pull</code>, then <code>git push</code>"],
    ["CONFLICT (content): Merge conflict in ...", "Both sides changed the same lines.", "Edit the file, delete the markers, <code>git add</code>, <code>git commit</code> (or <code>git merge --abort</code>)"],
    ["Your local changes would be overwritten", "Unsaved edits are in the way.", "Commit them, or <code>git stash</code>"],
    ["fatal: not a git repository", "You are not inside a repo folder.", "<code>cd</code> into the project, or <code>git init</code> / <code>git clone</code>"],
    ["The branch is not fully merged", "The branch has work that is not merged yet.", "Merge it first, or <code>git branch -D</code> to throw it away"],
    ["PR: required check failed", "GitHub Actions tests are red.", "Fix the code, push again, wait for green"],
  ];
  const WORDS = [
    ["Repository", "A project tracked by Git, with its full history."],
    ["Commit", "A saved snapshot with a message."],
    ["Branch", "A separate line of work. <code>main</code> is the default."],
    ["Remote / origin", "The copy on GitHub, and its nickname."],
    ["HEAD", "'You are here': the commit you are on."],
    ["Fast-forward", "A merge that just moves the branch forward."],
    ["Pull request", "A GitHub proposal to merge a branch, with review."],
    ["Issue", "A numbered bug report or task on GitHub."],
    ["GitHub Actions", "GitHub's robot that runs tests and tasks automatically."],
  ];

  function build() {
    const sections = G.TABS.map((t) => {
      const rows = G.ACTIONS.filter((a) => a.tab === t.id && !SKIP.has(a.id)).map((a) => {
        const real = !a.cmd.startsWith("#");
        return `<tr><td><code>${esc(a.btn)}</code>${real ? "" : '<span class="cs-note">not a git command</span>'}</td><td>${esc(a.desc)}<span class="cs-when">${esc(a.when)}</span></td></tr>`;
      }).join("");
      return `<section class="cs-sec"><h2>${esc(t.name)}</h2><table><tbody>${rows}</tbody></table></section>`;
    }).join("");

    $("cheat-page").innerHTML =
      '<header class="cs-head"><h1 id="cheat-title">Git &amp; GitHub cheat sheet</h1><p>Every command from the sandbox, in plain English.</p></header>' +
      '<section class="cs-flow" aria-label="Where work lives">' +
      '<div class="cs-box cs-wd"><b>Working folder</b><span>files you edit</span></div><div class="cs-arrow"><code>git add</code></div>' +
      '<div class="cs-box cs-st"><b>Staging area</b><span>next commit</span></div><div class="cs-arrow"><code>git commit</code></div>' +
      '<div class="cs-box cs-lo"><b>Local repo</b><span>your history</span></div><div class="cs-arrow"><code>git push</code></div>' +
      '<div class="cs-box cs-re"><b>GitHub</b><span>shared copy</span></div></section>' +
      '<p class="cs-back">Coming back down: <code>git clone</code> (first time), <code>git fetch</code> (look only), <code>git pull</code> (fetch + merge).</p>' +
      `<div class="cs-cols">${sections}` +
      `<section class="cs-sec"><h2>Golden rules</h2><ol>${RULES.map((r) => `<li>${r}</li>`).join("")}</ol></section>` +
      `<section class="cs-sec"><h2>Good commit messages</h2><ul><li>Short first line (about 50 characters).</li><li>Present tense: "Fix login timeout".</li><li>Say why, not just what.</li><li>Link an issue: "Fix heading (Closes #12)".</li></ul></section>` +
      `<section class="cs-sec"><h2>Common errors</h2><table><tbody>${ERRORS.map((e) => `<tr><td><code>${esc(e[0])}</code></td><td>${e[1]}<span class="cs-when">Fix: ${e[2]}</span></td></tr>`).join("")}</tbody></table></section>` +
      `<section class="cs-sec"><h2>Git vs GitHub</h2><dl><dt>Git</dt><dd>The tool on your computer. Records history. Works offline.</dd><dt>GitHub</dt><dd>A website that hosts Git repos and adds pull requests, issues and Actions.</dd><dt>Bridge</dt><dd><code>clone</code> <code>push</code> <code>pull</code> <code>fetch</code> are the Git commands that talk to GitHub.</dd></dl></section>` +
      `<section class="cs-sec"><h2>Key words</h2><dl>${WORDS.map((w) => `<dt>${w[0]}</dt><dd>${w[1]}</dd>`).join("")}</dl></section>` +
      "</div>";
  }

  const overlay = $("cheatsheet");
  let opener = null;
  function open() {
    opener = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add("cheat-open");
    $("cheat-close").focus();
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove("cheat-open");
    if (opener) opener.focus();
  }
  build();
  $("btn-cheat").addEventListener("click", open);
  $("cheat-close").addEventListener("click", close);
  $("cheat-print").addEventListener("click", () => window.print());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(); });
})();
