# Owner-controlled project automation

The owner manages multiple projects. Automate observable, reversible work and
keep spending, credentials, releases, and merges under owner control.

## Existing Ghost Hunter automation

GitHub Actions already opens a PR when a permitted feature branch is pushed.
The owner approves it; CI gates web tests, native builds, and Pages deployment.
This is the correct starting boundary for an engineering bot: it can prepare
branches and PRs, but cannot merge or submit apps on behalf of the owner.

## Bot design across repositories

1. A scheduled/orchestrated **project coordinator** reads selected repositories'
   issues, pull requests, CI status, releases, and approved backlog. It reports
   one prioritized digest with failed checks and blockers. Start read-only.
2. A **coding worker** may take only an explicitly labeled, scoped task, create
   a short-lived branch, run relevant tests, and open a draft PR with evidence
   and rollback notes. Use separate installation credentials scoped to the
   selected repositories. Never grant organization-wide write by default.
3. A **review gate** requires the owner's approval, protected `main`, required
   CI, and a human release decision. Do not grant the bot `admin`, secret
   management, billing, store publishing, or production database credentials.
4. A **monitor** watches CI, Pages, crash/error budgets, unusual billing, and
   backend reconciliation. It creates an issue/alert with links and evidence;
   it may cancel a dangerous deployment through a predefined runbook only if
   the owner has separately approved that authority.

## Safety and reliability controls

- Repository allowlist and per-repo scopes; per-task budget/time limits.
- Full audit trail: task source, branch, commit, tests, PR, approval, outcome.
- Deduplicate work; cap parallel PRs; avoid triggering one automation from
  another indefinitely. Pause after repeated CI failures.
- Never place user or player data in LLM prompts, traces, PR logs, or summaries.
- Separate staging/prod; require human review for schema migrations and any
  data deletion, purchase, auth, privacy, or permission changes.
- Make the coordinator's action policy configurable per project: read-only,
  draft PRs, or owner-approved execution. Start read-only plus draft PRs.

## Rollout

Select repository names and desired digest cadence; inventory existing CI and
branch protection. Run the coordinator read-only for a week, then enable draft
PRs for low-risk labeled issues. Measure false alerts, failed tasks, review
load, and time saved before expanding scope. No automation is configured by
this document; creating a cross-repository bot requires the owner's account
permissions and an agreed repository allowlist.
