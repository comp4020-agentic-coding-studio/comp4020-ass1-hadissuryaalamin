# Process overview

## What I built

"One Dial, Three Pathfinders" — an interactive explainer that argues Dijkstra's
algorithm, A*, and greedy best-first search aren't three algorithms but one
weighted search (`f(n) = g(n) + weight × h(n)`) at three settings of a single
dial, and that turning the dial past "A*" quietly breaks the shortest-path
guarantee it was giving you. A visitor draws walls on a grid (or loads a
hand-built "trap maze"), drags a weight slider from 0 to 3, and hits Run: the
search animates its expansion and final path, then a result banner says
plainly whether that path was actually shortest — and on the trap maze, past
roughly weight 2.6, it wasn't. A run-history table lets a visitor compare
weight against path length and cells expanded across repeated runs on the same
maze, which is where the speed-vs-correctness trade-off actually becomes
visible rather than asserted.

This is the site's second topic. It started as a tool-selection pipeline
visualizer, became a hidden-state-probe guessing game, and became this after a
second, unprompted request to change topics entirely — see the moments below
for how each turn was handled, not just what it produced.

## The moments that mattered

1. **Turning the brief into failing tests before writing a single feature.**
   Before any UI existed, `spec/assignment-1.test.ts` encoded the shape the
   brief demanded, and started red on purpose. Re-running `pnpm check` and
   watching that file go green was the actual signal a build was done, not my
   own read of the page. The same file was rewritten from scratch, the same
   way, for both later pivots below — the habit outlasted the topic.
   [`46a94b2`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/commit/46a94b2)

2. **The first build passed every check and still wasn't good.** A rule-based
   `decideTool()` function animated across a six-stage pipeline satisfied
   `pnpm check` at both viewports, but the "decision" was a regex restating
   its own input — nothing a reader couldn't have guessed themselves. Green
   checks told me it worked; they couldn't tell me it was worth building.
   [`1eb6511...e6a2e97`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/compare/1eb6511...e6a2e97)

3. **Throwing the spec-compliant build away for a real idea, gated behind an
   explicit sign-off.** Rather than keep polishing the pipeline, the concept
   was re-grounded in an actual finding — that a probe on a model's hidden
   state predicts tool need more reliably than its own verbalized reasoning.
   That meant discarding working code, so the new shape went down in
   `PLAN.md` first and waited for an explicit go-ahead — one word, "Agreed" —
   rather than assuming green checks on the old build meant it was fine to
   keep iterating on.
   [`78c4f59...fc82a45`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/compare/78c4f59...fc82a45)

4. **A second, direct instruction to change topics entirely — and validating
   the new idea's central claim before building any UI on top of it.** Told
   to pivot to visualizing A* (with RRT pre-agreed as the fallback if this
   didn't land), the sharper claim — "one dial, three algorithms, and the
   guarantee quietly breaks" — went into `PLAN.md` before any code changed,
   including exactly what would make weight > 1 provably fail (a maze with a
   near gap that lures a greedy search away from a farther gap it actually
   needs). That claim was then proven as a unit test against the real search
   engine — trap maze returns length 21 at weight 0 and 1, a strictly longer
   27 at weight 3 — *before* the grid, the slider, or a single pixel of
   animation existed. If the maze hadn't produced that gap, this is where it
   would have been caught, not after wiring up a visualization on top of a
   claim that didn't hold.
   [`00d7728...9a18770`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/compare/00d7728...9a18770)

5. **Checking the interaction actually worked, not just that it built.**
   `pnpm check` passing after the grid controller was wired up proved the
   markup existed and typechecked — not that tapping a cell painted a wall,
   that arrow keys actually moved a roving `tabindex`, or that Run at weight 3
   on the trap maze really rendered the "got fooled" banner and an
   `Optimal? No` history row. Same discipline as the probe game's equivalent
   check: a throwaway jsdom test instantiated the real `GridController`
   against the built page and dispatched real pointer/keyboard/click events
   through the full interaction, including both the honest and the fooled
   Run outcome. It caught one bug in the *test's own assumptions* about
   focus state, not in the controller — and was deleted before this commit,
   since it was a one-off check rather than part of the shipped contract.
   [`9a41362`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/commit/9a41362)

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that the
current reflection entry is in `reflections/`, and that your `CLAUDE.md` is
there --- before a marker ever opens the file. It checks that your map is
traceable, not that it is good: the marker judges whether your small,
deliberately chosen set of moments shows real judgement and reflection. A green
check is not a substitute for that curation.

Images are deliberately not checked, because whether one renders is visible the
moment you look. Open this file on GitHub and look at it before you ship.
