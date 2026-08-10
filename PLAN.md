# PLAN.md

## Status

**Second pivot, drafted 2026-08-10.** The site is changing topic entirely,
away from the hidden-state-probe guessing game (shipped at
[`fc82a45`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/commit/fc82a45))
to a pathfinding visualizer. Proceeding straight to implementation under this
plan — flag anything below that isn't what you meant and it changes; the
"adjustable" content (exact maze layout, exact copy) is genuinely adjustable.

## Brief (Hadi, 2026-08-10)

> I want to change the topics. to visualize the A* or RRT

> A*, but if the result is not what I meant, we will change into RRT.

A* is the committed topic. RRT is the pre-agreed fallback if this build
doesn't land the way Hadi meant — that's not a fresh negotiation if invoked,
it's already-granted permission to pivot a third time.

## Point of view (the one strong idea)

"Watch A* find the shortest path on a grid" is the generic version of this
topic — it's been built as a student demo hundreds of times and proves
nothing you couldn't get from a Wikipedia gif. The sharper claim:

**Dijkstra's algorithm, A*, and greedy best-first search are the same
algorithm at three settings of one dial — and turning that dial past "A*"
quietly breaks the shortest-path guarantee.**

All three compute `f(n) = g(n) + weight × h(n)` (cost-so-far plus a weighted
heuristic estimate to the goal) and expand the lowest-`f` node first. Weight
0 ignores the heuristic entirely and degrades to Dijkstra — slow but
provably optimal. Weight 1 is textbook A* — still provably optimal, faster
because the heuristic guides the search. Weight above 1 overweights the
heuristic into greedy best-first — fast, but the optimality proof no longer
holds, and it can be *caught* failing on a hand-built maze designed so
greedy commits to a trap that looks close to the goal.

The visitor doesn't just read this — they drag one slider between those
three settings on the same maze and watch the "shortest path" guarantee
hold, hold, then quietly stop holding, while a stats readout says exactly
how much speed that cost bought and exactly how much correctness it lost.

## Decisions (settled in chat, unless noted as still open)

| Question | Decision |
|---|---|
| Movement model | 4-directional (N/S/E/W) only, unit cost per step. No diagonals — keeps the heuristic (Manhattan distance) and the trap-maze design tractable in the time available. |
| Heuristic | Manhattan distance to the goal, admissible at weight ≤ 1. |
| The "dial" | A single continuous slider, weight 0–3, step 0.1, with three labeled snap zones: **0 = Dijkstra**, **1 = A\***, **>1 = Greedy best-first**. The live label above the slider names whichever algorithm the current weight corresponds to — reinforcing "this is one algorithm," not three. |
| Grid size | Fixed logical grid, 16 columns × 10 rows, same at every viewport — cell *pixel* size shrinks responsively, but the underlying data model (and anything the visitor has drawn) never changes shape on resize. |
| Wall drawing | Visitor-driven: click/tap a cell to toggle it between empty and wall in "Draw" mode; a mode switch (Draw / Erase / Set start / Set end) governs what a cell-activation does. Pointer-drag painting is an additive enhancement for mouse users; tap-per-cell always works and is the only thing keyboard/touch depend on. |
| Guaranteed "gotcha" | A visitor drawing their own maze might never build one where greedy actually fails — so a **"Load trap maze"** preset button loads a hand-designed grid engineered so weight > 1 provably returns a longer-than-optimal path (verified by a unit test, not just eyeballed). Mirrors the probe game's earlier decision to curate the moments that matter rather than leave them to chance. |
| Comparison | Every run also silently computes the weight-1 (true A*) path length for the same start/end/walls. If the run's own path is longer, the result banner says so explicitly ("This path is 14 steps — the shortest possible is 11. Greedy got fooled.") instead of leaving the visitor to notice on their own. |
| Run history | Each run appends a row to a visible table: weight, algorithm name, path length, optimal? (yes/no), cells expanded. Lets a visitor run 0 → 1 → 2 on the same maze and compare rows directly, which is where the "speed vs. correctness" trade-off actually becomes visible (Dijkstra expands the most cells, greedy the fewest). |
| Animation | Compute the full visited-order + path synchronously up front (no risk of animating something that turns out wrong mid-reveal), then stagger the *reveal* of visited cells via `setTimeout`, same `runId`-guarded pattern as `RoundController` used, so re-running mid-animation or resizing cancels cleanly. Respects `prefers-reduced-motion` (near-instant reveal). |
| Accessibility for the animation | Visual cell-by-cell reveal for sighted visitors, mirrored by a plain-sentence `aria-live="polite"` status region ("Expanding 42 cells… path found, 11 steps, optimal."). |
| Keyboard grid interaction | Standard accessible-grid pattern: roving `tabindex` (one cell is `tabindex="0"`, the rest `-1`), arrow keys move focus between cells, Enter/Space applies the current mode to the focused cell. No drag dependency for any interaction. |

## The mechanic, concretely

1. A 16×10 grid renders as a CSS grid of cells (`data-state`: `empty` /
   `wall` / `start` / `end` / `visited` / `frontier` / `path`). A fixed
   default start (top-left area) and end (bottom-right area) are pre-placed
   so the grid is runnable with zero setup.
2. A control panel beside/below the grid: mode buttons (Draw wall / Erase /
   Set start / Set end), the weight slider with its live algorithm label,
   a **Run** button, a **Clear walls** button, and **Load trap maze**.
3. Pressing Run computes the search at the current weight, then animates the
   visited cells lighting up in expansion order, then draws the final path,
   then shows the result banner (path length, optimal vs. not, cells
   expanded) and appends the run-history row.
4. The visitor can change the weight and re-run on the same maze as many
   times as they like — nothing resets except an explicit Clear.

## Visual/technical sketch

- `src/lib/astar.ts` (replaces `probe-rounds.ts`): the grid model (plain
  2D boolean wall array + start/end coordinates) and **one** weighted search
  function — `search(grid, start, end, weight)` — returning
  `{ visitedOrder, path, expandedCount, pathLength }`. Dijkstra/A*/greedy
  are calls to this one function with `weight` 0, 1, or >1 — not three code
  paths. Backed by a binary min-heap keyed on `f = g + weight*h`, Manhattan
  `h`, insertion-order tiebreak.
- `src/lib/astar.test.ts` (replaces `probe-rounds.test.ts`): unit tests
  proving the property the whole site is built to demonstrate — on the trap
  maze, weight 0 and weight 1 both return the optimal path length; weight
  set past the trap threshold returns a strictly longer path; weight 0
  expands ≥ weight 1's count, which expands ≥ a high-weight run's count. If
  a first-draft trap-maze layout doesn't actually produce that gap, this
  test catches it before the animation is ever built on top of it.
- `src/scripts/grid-controller.ts` (replaces `round-controller.ts`): owns
  mode state, wires cell activation (click/tap/keyboard) to the current
  mode, wires Run to `search()` + the staggered reveal, owns the run-history
  table, owns the roving-tabindex keyboard navigation.
- `src/pages/index.astro`: full rewrite — grid markup, control panel,
  weight slider + live label, result banner, run-history table,
  `aria-live` status region.
- `src/styles/global.css`: keep the accessibility primitives already built
  (`.sr-only`, `:focus-visible`, reduced-motion guards); new grid-cell,
  slider, and table visuals are new work. One responsive rule shrinks cell
  size (not cell *count*) below a viewport-width breakpoint for the 390px
  phone viewport.
- `spec/assignment-1.test.ts`: rewritten to match the new testids (grid
  cells, mode buttons, weight slider, run button, result banner, history
  table) instead of the probe game's round/guess contract.
- Deleted, not adapted: `src/lib/probe-rounds.ts`,
  `src/lib/probe-rounds.test.ts`, `src/scripts/round-controller.ts`.

## Explicitly out of scope

- Diagonal/8-directional movement and any non-Manhattan heuristic.
- RRT, continuous configuration space, or anything sampling-based — that's
  the fallback topic, not built unless this pivot is abandoned.
- Weighted/non-unit edge costs (e.g. "terrain" cells) — walls are binary,
  nothing else affects step cost.
- Multiple simultaneous searches, saving/sharing a drawn maze, or anything
  beyond the single grid + slider + run-history loop above.

## Next step

Implement against this plan. `PROCESS.md` and `reflections/assignment-1.md`
get revisited once there are real commits from this pivot to cite — both
currently describe only the first pivot's history.
