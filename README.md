# Git, Visualized

An interactive web page for learning **Git and GitHub** by doing. Pick a real-world situation, click commands, and watch files and commits move between the four places your work lives, while a plain-English coach tells you what is happening and whether your choice was right.

It runs entirely in your browser. There is nothing to install, nothing is sent anywhere, and nothing real is touched: it is a simulation.

## What you can do

- **Watch Git work.** Four animated boxes show the **working folder**, **staging area**, **local repository** and **GitHub**. A live chart draws every commit, branch, merge and tag.
- **Try 17 guided scenarios.** Each one sets up a situation and gives you a checklist. For each step you read where you are, pick a command, and get told if it was right or wrong and why.
- **Make mistakes safely.** Commands that would fail show the real error message and explain it.
- **Use 58 commands** across setup, daily work, syncing, branches, merging, pull requests, undoing mistakes, Issues, GitHub Actions and extras.
- **Test yourself** with a 54-question quiz.
- **Keep four cheat sheets.** Browse sandbox commands, account checks for pushing and Copilot chat, a quick PowerShell guide to switching GitHub accounts, and the difference between add, commit and push.
- **Switch between dark and light themes.**

## Run it

1. Download or clone this repository.
2. Open `index.html` in a current browser (Chrome, Edge, Firefox or Safari). Double-clicking the file is enough.

Keep `index.html`, `style.css`, `assets/` and `js/` together in the same folder.

## How to use it

1. Scroll to **Try it yourself** and choose a **scenario**.
2. Read **Step 1: Where you are right now**.
3. In **Step 2**, choose a command. Not sure? Press **Show me a hint**.
4. Read **Step 3** to see whether it was the right choice, why, and what the command does.
5. Watch the boxes and the commit history react. Tick off the checklist to finish the scenario.

## The 17 scenarios

| # | Scenario |
|---|----------|
| 1 | Start a project |
| 2 | Save and share your work |
| 3 | Start from an existing folder |
| 4 | Get your teammates' changes |
| 5 | When histories diverge |
| 6 | Work on a branch |
| 7 | Merge: fast-forward |
| 8 | Merge: merge commit |
| 9 | Fix a merge conflict |
| 10 | Rebase for a straight history |
| 11 | Pull request workflow |
| 12 | Undo changes before committing |
| 13 | Fix the last commit |
| 14 | Undo a pushed commit |
| 15 | Ignore files and tag a release |
| 16 | Track work with Issues |
| 17 | Automatic checks with GitHub Actions |

There is also **Free play**, which starts from an empty sandbox with no checklist.

## Cheat sheets

Open **Cheat sheets** in the top bar.

- **Commands:** every command from the sandbox with what it does and when to use it, plus golden rules and common errors. Use **Print** for a clean black-and-white copy.
- **Which GitHub account am I using?** A one-page guide to checking the account used for commits, for pushing, and for Copilot chat in VS Code. The image is also at [`assets/github-account-cheatsheet.png`](assets/github-account-cheatsheet.png).
- **Switch GitHub accounts:** a printable PowerShell quick reference for checking and switching logins, clearing token overrides, adding accounts, configuring HTTPS Git credentials, and troubleshooting repository access. Includes a pre-push checklist and the distinction between login, remote URL and commit author.
- **Add, commit & push:** a beginner-friendly explanation of what each command does, when to use it, and the shopping-basket/photo analogy, followed by a three-step flow summary.

## Project structure

```
index.html            Page structure and overlays
style.css             Styling, themes, animations and print styles
assets/               Account-check cheat sheet (PNG and its HTML source)
js/
  core.js             The simulated Git engine and shared state
  actions-*.js        The commands (basic, branch, undo, ci)
  coach.js            Plain-English guidance and the 17 scenarios
  ui.js               Rendering: boxes, commit chart, terminal, animation
  cheatsheet.js       Cheat sheet overlay
  quiz-data.js        Quiz questions
  quiz.js             Quiz logic
  main.js             Wiring and start-up
```

The scripts are plain files that share one global object, so the page works straight from disk with no build step.

## Full design and build guide

[`GIT-VISUALIZER-DESIGN-PLANNING-AND-BUILD-GUIDE.md`](GIT-VISUALIZER-DESIGN-PLANNING-AND-BUILD-GUIDE.md) records the planning, design decisions, complete source, tests and troubleshooting. It is detailed enough to rebuild the project from scratch.

## Publish it with GitHub Pages (optional)

1. On GitHub open the repository, then **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
3. Choose branch `main` and folder `/ (root)`, then **Save**.
4. After a short wait GitHub shows the public address of the page.

## Limitations

- It simulates Git. The output imitates real Git but is not produced by Git.
- Not covered: forks with an `upstream` remote, `cherry-pick`, interactive rebase, and file deletions with `git rm`.

## License

No license has been specified for this project.
