# Process overview

## What I built

"Dijkstra, Traced" — a single fixed 7-node directed graph walked by plain
Dijkstra, where every step of the pop-and-relax loop is shown twice at once:
as animation on the graph (frontier, visited, and shortest-path node/edge
states) and as the exact line of real Python or Java source that caused it,
highlighted in a VS-Code-style code panel a visitor can switch between via
tabs. Run auto-plays all 7 pops; Prev and Next step through the same sequence
by hand from the same control block. A result banner states the found path
and its total cost once the walkthrough finishes.

This is the site's third topic. It started as a tool-selection pipeline
visualizer, became a hidden-state-probe guessing game, then "One Dial, Three
Pathfinders" (a weight-dial grid comparing Dijkstra/A*/greedy) after a second
unprompted request to change topics, and became this after a third: dropping
the multi-algorithm dial for one algorithm shown against its own real source
instead of pseudocode. See the moments below for how each turn was handled,
not just what it produced.

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

6. **A third pivot, and rebuilding the spec file from the mechanic outward
   instead of patching it.** "One Dial, Three Pathfinders" gave way to a
   single fixed directed graph walked by plain Dijkstra, with a real
   Python/Java source panel line-synced to each pop-and-relax step standing
   in for pseudocode — the wall-drawing grid, maze presets, weight dial, and
   run-history table are gone outright, not hidden behind a flag.
   `spec/assignment-1.test.ts` was rewritten from the new mechanic rather
   than edited line-by-line, so its assertions (7 nodes, 11 edges, one
   shared Run/Prev/Next control block, the code panel's line count matching
   the actual committed source) trace to what the page now does, not what it
   used to. Manual browser verification against the dev server (not just
   `pnpm check` going green) caught a real bug this rewrite left behind: the
   finish-step state replay indexed one entry past the end of the recorded
   pop sequence, throwing on every completed run and silently keeping the
   result banner hidden — a build that typechecked, built, and passed all 38
   tests while the core "here's the shortest path" payoff never rendered.
   [`a4c3b19`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/commit/a4c3b19)

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that the
current reflection entry is in `reflections/`, and that your `CLAUDE.md` is
there --- before a marker ever opens the file. It checks that your map is
traceable, not that it is good: the marker judges whether your small,
deliberately chosen set of moments shows real judgement and reflection. A green
check is not a substitute for that curation.

Images are deliberately not checked, because whether one renders is visible the
moment you look. Open this file on GitHub and look at it before you ship.
