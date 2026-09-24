# Echo Steps Development Workflow

This repository is managed as a release project, not as a collection of direct edits to the live page.

## Branch and review policy

1. Start each change from the latest `main`.
2. Use a focused branch such as `fix/input-drag-state` or `feat/mobile-shell`.
3. Keep behavior changes separate from large mechanical refactors when practical.
4. Run `npm test` before opening a pull request.
5. Review the changed-file list and diff before merging.
6. Merge only when automated checks pass and the change has a clear rollback commit.

Branches under `codex/`, `fix/`, `feature/`, `chore/`, `release/`, or `setup/`
automatically receive a pull request authored by GitHub Actions. This keeps the
proposal author separate from the repository owner, so `@katarimukul07-svg` can
provide the sole required approval. Never merge a pull request automatically.

The CI/CD workflow runs structural validation, Playwright smoke tests in desktop and mobile Chromium, an Android API 36 build, and an iOS simulator build. The existing protected status is now an aggregate gate and cannot pass unless every platform job succeeds. GitHub Pages deployment depends on that gate.

Routine engineering decisions may be made without owner interruption. Ask the owner only for material product direction, spending, credentials, legal/privacy declarations, or final store-submission approval.

## Definition of done

A change is complete when:

- The intended behavior is implemented without unrelated edits.
- Automated validation passes.
- New logic has an appropriate deterministic test or browser test once the test harness exists.
- Mobile layout, touch input, pause/resume, and offline behavior have been considered.
- Documentation and release notes are updated when user-visible behavior changes.
- The pull request is merged and the GitHub Pages build is verified when it affects the web game.

## Release safety

- Never commit passwords, API keys, signing material, store credentials, or production ad secrets.
- Never enable a fake purchase path or grant currency before a provider confirms payment/ad completion.
- Use test ad identifiers until the release candidate is approved.
- Keep the game playable offline; ads and analytics must fail safely.
- Prefer staged store rollout and retain a known-good release commit for rollback.

## Current technical debt

The web source is now separated into game, rendering, UI, platform, and style
boundaries. The files are still loaded as ordered classic scripts to preserve
the prototype's shared runtime state. Future architectural changes should replace
those shared globals with explicit module imports incrementally, with the existing
browser tests acting as the behavior contract.

## Useful commands

```bash
npm install
npx playwright install chromium
npm test
npm run serve
npm run cap:sync
npm run android:debug
```

The live web build is <https://katarimukul07-svg.github.io/Ghost-hunter/> and the release plan is maintained in [ROADMAP.md](ROADMAP.md).
