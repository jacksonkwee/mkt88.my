# GONGXIFACAI — live4dresult.net site clone

Pixel-faithful static clone of https://live4dresult.net/ built with Next.js (App Router),
self-hosted assets and the original site's Bootstrap/theme CSS.

## Run locally (port 8888)

The dev server binds 0.0.0.0 so it is reachable at `http://gongxifacai888:8888` from this machine's
network name/IP, or simply `http://localhost:8888`. (`gongxifacai888` is mapped to 127.0.0.1 / ::1
in this machine's hosts file.)

Requirements: Node.js 18.17+ (this repo was scaffolded with the Codex runtime Node 24 + pnpm).

```powershell
pnpm install            # or: npm install
pnpm dev                # dev server on http://0.0.0.0:8888
pnpm build && pnpm start   # production build + start
```

Note: pnpm 11 blocks `sharp`'s postinstall by default; `pnpm-workspace.yaml` sets
`strictDepBuilds: false`, so installs/builds pass. Images use plain `<img>`, so sharp is not required.

## Cloned routes (all working navigation)
| Route | Content |
|---|---|
| `/` | Live results homepage (9 games, 2026-09-06 draws) |
| `/sabah-sarawak-4d-results` | East 4D: Sandakan 4D, Special CashSweep, Sabah 88 4D |
| `/singapore-4d-results` | SG: Singapore 4D + Singapore Toto |
| `/cambodia-4d-results` | Cambodia: Grand Dragon, Perdana, Nine Lotto, Lucky HariHari |
| `/lotto-4d` | Lotto 4D (Grand Dragon / Perdana / Nine Lotto / Lucky HariHari) |
| `/past-results` | Past results page for the captured draw date; Cambodia toggle opens the Cambodia page |

Navigation wired up: header brand + "Live 4d Results", "Results by Regions" dropdown
(Sabah Sarawak / Singapore / Cambodia), "Past Results", and the four region buttons
(4D Result 马来西亚 / Lotto 4D 柬埔寨 / East 4D 東馬 / SG 新加坡).

## Layout fidelity
Homepage verified headless against the live site (ads hidden on both): identical scroll height,
card/column geometry, pixel diff ≈ 0 at 1440px and 390px. Sabah/Singapore pages match live geometry
exactly; Cambodia/Lotto/Past pages reproduce captured static content (ad-slot scaffolding makes the
live page's total height vary by a few tens of px between loads).

## Structure
- src/app/ — routes (/, region pages, past results), global CSS (bootstrap, font-awesome, theme)
- src/components/sites/live4dresult-net-0600c55d/root-8a5edab2/ — components, captured card data,
  and `snapshots/*.content.json` (static content for the extra pages)
- public/sites/live4dresult-net-0600c55d/root-8a5edab2/ — namespaced assets
- docs/research/live4dresult-net-0600c55d/ — extraction artifacts & specs
- docs/design-references/live4dresult-net-0600c55d/ — reference screenshots

## Scope / limitations
Static demo clone (no backend). Real-time updates, AJAX loaders, Google AdSense/Advanced-Ads
placements and Facebook SDK are not reproduced; ad units render as their empty/placeholder states.
Per-game "More ... Result" links and footer legal links point to other un-cloned pages (inert `#`).
Draw data is a 2026-09-06 snapshot (date picker/Prev-Next on Past Results are informational;
selecting Cambodia navigates to the Cambodia page). See docs/research/live4dresult-net-0600c55d/root-8a5edab2/ARTIFACT_MANIFEST.md.



