# GardenOS — Project Memory System

This directory makes GardenOS **self-documenting**: any future session (human or Claude) can continue development by reading these files, without relying on prior conversation context.

## Read order (new session)
1. **CLAUDE.md** — operating manual & project constitution (read first).
2. **HANDOFF.md** — current state, current sprint, next priority, risks.
3. **PROJECT_STATE.md** — GardenOS exactly as it exists now.
4. **NEXT_SPRINT.md** — only the current sprint.

## The documents
| File | Purpose | Update cadence |
|---|---|---|
| `CLAUDE.md` | Permanent operating manual, standards, constitution | When principles change |
| `HANDOFF.md` | Immediate continuation brief | Every sprint |
| `PROJECT_STATE.md` | Live description of the whole system | Every sprint |
| `NEXT_SPRINT.md` | The next/current sprint only | Replaced every sprint |
| `ENGINEERING_LOG.md` | Chronological milestone journal | Append every sprint |
| `KNOWN_TECH_DEBT.md` | Debt by severity + resolved | Every sprint / audit |
| `ARCHITECTURE_DECISIONS.md` | Consolidated decision log | On decisions / audits |
| `GARDEN_AI_ROADMAP.md` | Long-term AI vision (planning only) | As the vision evolves |
| `PRODUCT_VISION.md` | Mission & 20-year vision | Rarely |

## Standing rule
**After every completed sprint, update:** PROJECT_STATE, HANDOFF, ENGINEERING_LOG, NEXT_SPRINT (and KNOWN_TECH_DEBT if changed). **Architecture audits also update** ARCHITECTURE_DECISIONS. See `CLAUDE.md` → Future Development Rules.

> Detailed design specs remain in the repo-root docs and `docs/adr/`; this system is the operating layer above them.
