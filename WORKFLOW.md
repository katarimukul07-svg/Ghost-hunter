# Echo Steps — Dev Workflow

How this game actually gets built without me losing my mind.

**Live game:** https://katarimukul07-svg.github.io/Ghost-hunter/
**Repo:** https://github.com/katarimukul07-svg/Ghost-hunter
**Local folder:** `~/Documents/GitHub/Ghost-hunter`

---

## The cast of characters

| Who | Job |
|-----|-----|
| **Claude (chat)** | Thinks up features, argues about design, writes the big stuff. Sits at a desk, drinks imaginary coffee. |
| **Claude Code (VS Code)** | Actually touches the repo — edits, commits, pushes. The one with its hands dirty. |
| **GitHub + Pages** | Where the code lives and where the game actually runs for real humans. |

The entire game is **one file: `index.html`**. HTML, CSS, JS, all crammed in together like a college roommate situation. No dependencies, no build step, no drama.

---

## The one rule that saves me every time

**Don't edit the same thing in two places.** If chat hands you a whole `index.html` AND you also poke at it directly in Claude Code, they'll fight and one version wins by accident. Pick a lane per change:

- **Big feature / new system** → built in chat, dropped in as `index.html`, you push it.
- **Small tweak** (rename a button, nudge a number, fix a typo) → just tell Claude Code. Don't bother chat with it.

---

## Actually shipping something

### Path A — chat built a feature
1. Chat hands you a fresh `index.html`.
2. Download it.
3. Drop it into `~/Documents/GitHub/Ghost-hunter/`, **overwriting** the old one.
4. Tell Claude Code: `I replaced index.html — read it, commit and push with a summary.`
5. Wait about a minute, then go **verify** it's real (below).

### Path B — a quick tweak in Claude Code
1. Just say the thing plainly: `On the game-over screen, rename SHOP to MENU. Commit and push.`
2. Look at the diff before saying yes.
3. **Verify.**

---

## Verifying a deploy (aka don't trust your own eyes)

The cache has lied to me more times than I'd like to admit. Here's how to actually know what's live:

1. **GitHub is the truth.** Open the repo → `index.html` → Ctrl/Cmd+F for something you know is new. There if it's there, the push worked. No caching nonsense here.
2. **The live page can still be stale.** Force a fresh look:
   - Incognito / private tab, or
   - iPhone Safari: hold the reload button → *Reload Without Content Blockers*.
3. **GitHub Pages takes ~1 minute** to rebuild. A 404 or the old version right after pushing usually just means "give it a second," not "it's broken."

---

## Things that have already bitten me

- **Stale cache** makes a real change look like nothing happened. Check GitHub, go incognito, don't panic.
- **`index.html` in the wrong folder.** It has to live at the **repo root** or Pages won't serve it.
- **Two different logins.** GitHub Desktop and the terminal don't share auth. Claude Code pushes from the terminal, so `gh auth login` needs to be done once there.
- **Mixing edit paths.** Chat-handed file + direct Claude Code edits on the same code = merge headache. See "the one rule" above.

---

## Repo layout

```
Ghost-hunter/
├── index.html      # the whole game, yes really
├── README.md       # what this thing is
├── WORKFLOW.md      # this file, my sanity notes
└── .gitignore
```

---

## Tuning knobs (`CFG` block up top in index.html)

| Key | Does what |
|-----|-----------|
| `SPEED_FRAC` | Player speed, as a slice of screen size |
| `GC_MOVES` | Sweep (ghost cleanup) fires every N rounds |
| `GC_KEEP` | Ghosts kept around before the sweep starts trimming |
| `RAMP_START` | Round where walls start drifting + ghosts speed up |
| `GHOST_RAMP` | How much faster ghosts get per round past `RAMP_START` |
| `WALL_DRIFT` | How twitchy the walls get once they start moving |
| `OBSTACLES_START` / `OBSTACLES_ADD_EVERY` / `OBSTACLES_MAX` | Start with this many obstacles, add one every N rounds, never go past the cap |
| `SIZE_EVERY` / `SIZE_GROW` / `SIZE_MAX` | Obstacles grow by `SIZE_GROW` every `SIZE_EVERY` rounds, capped at `SIZE_MAX` |
| `GRACE_TICKS` | Free frames at round start so you don't die on spawn like a chump |

Skins and prices live in the **`SKINS`** array right below `CFG`.

---

## Where everyone's data actually lives

Coins, best rounds, unlocked skins, name, mute — all stashed in browser **localStorage** on that one device. Clear your browser data and it's gone. Doesn't sync anywhere. If we want a real leaderboard across devices, that's a backend project, not a checkbox (see Roadmap).

---

## Roadmap

**Already done:** core loop, echo-ghosts, garbage-collector sweep, obstacles that grow and now come in different shapes, juice (trail, particles, screen shake, haptics), name entry, skin shop, coins + best-rounds saved, pause-on-blur, remembered mute.

**Ideas kicking around:**
- **Global leaderboard** (Supabase backend) — so "best 7 rounds" means something against strangers.
- **Daily challenge** (same seed for everyone, same day) — good bragging-rights bait.
- More skins / unlockable trails.
- **Arena max-width** so it doesn't look silly stretched across a giant monitor.
- Privacy-friendly analytics — where people quit, how long they stick around.
- **PWA install** + maybe an itch.io page, for main-character energy.

---

## Setting up on a new machine (in case future me forgets)

1. Install Git, sign into GitHub (Desktop app is easiest), and set up terminal auth once: `gh auth login`.
2. Install Claude Code: `curl -fsSL https://claude.ai/install.sh | bash`.
3. `git clone https://github.com/katarimukul07-svg/Ghost-hunter.git`
4. `cd Ghost-hunter`, then `claude`. Off you go.
