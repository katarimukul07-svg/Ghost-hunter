# Echo Steps Development Workflow

This repository is managed as a release project, not as a collection of direct edits to the live page.

## Branch and review policy

1. Start each change from the latest `main`.
2. Use a focused branch such as `fix/input-drag-state` or `feat/mobile-shell`.
3. Keep behavior changes separate from large mechanical refactors when practical.
4. Run `npm test` before opening a pull request.
5. Review the changed-file list and diff before merging.
6. Merge only when automated checks pass and the change has a clear rollback commit.

The CI/CD workflow runs structural validation and Playwright smoke tests in desktop and mobile Chromium. The GitHub Pages deployment job depends on that test job and cannot run when tests fail.

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

The prototype currently keeps most HTML, CSS, and game logic in `index.html`, while `gameplay-fixes.js` changes several functions at runtime. This is temporary. The M0 roadmap milestone will replace that patching model with explicit modules and tests before mobile packaging begins.

## Useful commands

```bash
npm install
npx playwright install chromium
npm test
npm run serve
```

The live web build is <https://katarimukul07-svg.github.io/Ghost-hunter/> and the release plan is maintained in [ROADMAP.md](ROADMAP.md).
