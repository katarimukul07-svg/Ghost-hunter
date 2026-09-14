# Echo Steps — Development Workflow

A practical guide to how this game gets built, changed, and shipped.

**Live game:** https://katarimukul07-svg.github.io/Ghost-hunter/
**Repo:** https://github.com/katarimukul07-svg/Ghost-hunter
**Local folder:** `~/Documents/GitHub/Ghost-hunter`

---

## The setup: three places, three jobs

| Place | What it's for |
|-------|---------------|
| **Claude (this chat)** | Design decisions, planning, writing new features, and docs. The "engineer's desk." |
| **Claude Code (in VS Code)** | Edits the files in your repo, commits, and pushes to GitHub. The "hands on the repo." |
| **GitHub + Pages** | Stores the code and hosts the live game. The "shipping." |

The whole game is a **single file: `index.html`** (HTML, CSS, and JavaScript together, no dependencies).

---

## The golden rule: one change, one path

Never edit the same thing through **both** the chat file *and* Claude Code — the two versions
will overwrite each other. Pick one path per change:

- **Big features / new systems** → built in chat, handed to you as `index.html`, you push it.
- **Small tweaks** (rename a button, change a number, tweak text) → tell Claude Code directly.

---

## Shipping a change

### Path A — a feature built in chat
1. Chat gives you an updated `index.html`.
2. Download it.
3. Move it into `~/Documents/GitHub/Ghost-hunter/`, **replacing** the old `index.html`.
4. In Claude Code: `I replaced index.html — read it, commit and push with a summary.`
5. Wait ~1 minute, then **verify** (see below).

### Path B — a small tweak via Claude Code
1. In Claude Code: describe the change plainly, e.g.
   `On the game-over screen, rename the SHOP button to MENU. Then commit and push.`
2. Approve the diff it shows.
3. **Verify.**

---

## Verifying a deploy (don't trust the cache)

Caching fooled us more than once. To know what's *actually* live:

1. **Source of truth = GitHub.** Open the repo → click `index.html` → Cmd/Ctrl+F for a word
   you know is new (e.g. `skin`, `MENU`). If it's there, the code is committed. No caching here.
2. **Live page** can serve a stale copy. To force the newest:
   - Open the URL in a **private / incognito tab**, or
   - iPhone Safari: hold the reload button → *Reload Without Content Blockers*.
3. **Pages needs ~1 minute** to rebuild after each push. A 404 or old view right after pushing
   is usually just the build finishing.

---

## Gotchas that already bit us

- **Stale cache** makes it look like nothing changed. Check the GitHub source, use incognito.
- **File in the wrong place.** `index.html` must sit at the **repo root** for Pages to serve it.
  Don't let it land inside a subfolder.
- **Two separate logins.** GitHub Desktop and the terminal have *separate* auth. Claude Code
  pushes from the terminal, so terminal auth must be set up once (`gh auth login`).
- **Divergence.** Don't mix a chat-handed file with direct Claude Code edits on the same code.

---

## Repo layout

```
Ghost-hunter/
├── index.html      # the entire game
├── README.md       # what the game is + how to run/deploy
├── WORKFLOW.md      # this file
└── .gitignore
```

---

## Tuning knobs (`CFG` block at the top of index.html)

| Key | Meaning |
|-----|---------|
| `SPEED_FRAC` | Player dot speed (as a fraction of screen size) |
| `GC_MOVES` | Sweep fires every N rounds |
| `GC_KEEP` | Ghosts kept before the sweep starts trimming |
| `RAMP_START` | Round after which walls move + ghosts speed up |
| `GHOST_RAMP` | Ghost speed increase per round past `RAMP_START` |
| `WALL_DRIFT` | How fast walls oscillate |
| `OBSTACLES` | How many walls spawn each game |
| `SIZE_EVERY` / `SIZE_GROW` / `SIZE_MAX` | Walls grow by `SIZE_GROW` every `SIZE_EVERY` rounds, capped at `SIZE_MAX` |
| `GRACE_TICKS` | Collision-free frames at each round start |

Skins and their prices live in the **`SKINS`** array just below `CFG`.

---

## Where player data lives

Coins, best rounds, unlocked skins, name, and mute are saved in the browser's **localStorage**
on that one device. Clearing browser data wipes it, and it does **not** sync between devices.
Cloud save + a worldwide leaderboard is a backend step (see Roadmap).

---

## Roadmap

**Done:** core loop, echo-ghosts, garbage-collector sweep, random + growing walls, juice
(trail, particles, screen shake, haptics), name entry, skin shop, coins + best-rounds saved,
pause-on-blur, remembered mute.

**Next options:**
- **Global leaderboard** (Supabase backend) — turns "best 7 rounds" into a world rank.
- **Daily challenge** (same seed for everyone that day) — very shareable.
- More skins / unlockable trails.
- **Arena max-width** so big desktop screens stay punchy.
- Privacy-friendly analytics (where players quit, session length).
- **PWA install** + an **itch.io** release.

---

## Setting up on a new machine (recap)

1. Install Git + sign in (GitHub Desktop is easiest), and set up terminal auth: `gh auth login`.
2. Install Claude Code (native installer): `curl -fsSL https://claude.ai/install.sh | bash`.
3. `git clone https://github.com/katarimukul07-svg/Ghost-hunter.git`
4. `cd Ghost-hunter`, then run `claude`.
