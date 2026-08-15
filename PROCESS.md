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
Pathfinders" (a weight-dial grid comparing Dijkstra/A*/greedy), and became
this after dropping the multi-algorithm dial for one algorithm shown against
its own real source instead of pseudocode. See the moments below for how each
turn was handled, not just what it produced.

## The moments that mattered

1. **The first build passed every check and still wasn't good.** A rule-based
   `decideTool()` function animated across a six-stage pipeline satisfied
   `pnpm check` at both viewports, but the "decision" was a regex restating
   its own input — nothing a reader couldn't have guessed themselves. Green
   checks told me it worked; they couldn't tell me it was worth building.
   [`1eb6511...e6a2e97`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/compare/1eb6511...e6a2e97)

2. **Throwing the spec-compliant build away for a real idea, gated behind an
   explicit sign-off.** Rather than keep polishing the pipeline, the concept
   was re-grounded in an actual finding — that a probe on a model's hidden
   state predicts tool need more reliably than its own verbalized reasoning.
   That meant discarding working code, so the new shape went down in
   `PLAN.md` first and waited for an explicit go-ahead — one word, "Agreed" —
   rather than assuming green checks on the old build meant it was fine to
   keep iterating on.
   [`78c4f59...fc82a45`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/compare/78c4f59...fc82a45)

3. **Installing a skill before redesigning, instead of hand-guessing a
   palette.** Before restyling the UI, Anthropic's frontend-design skill was
   installed rather than picking colors by eye. Its actual argument — ground
   the palette and signature element in the assignment's own subject, not a
   generic AI-default look — is what produced the blueprint-navy,
   graph-paper aesthetic: monospace technical-drawing type, and a two-tone
   verified/redline slider marking the exact weight where the optimality
   guarantee broke. The look traces back to the subject (a weighted search),
   not an arbitrary trend.
   [`17aff88...8d679e0`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/compare/17aff88...8d679e0)

4. **A third pivot, and rebuilding the spec file from the mechanic outward
   instead of patching it.** "One Dial, Three Pathfinders" gave way to a
   single fixed directed graph walked by plain Dijkstra, with a real
   Python/Java source panel line-synced to each pop-and-relax step standing
   in for pseudocode. `spec/assignment-1.test.ts` was rewritten from the new
   mechanic rather than edited line-by-line, so its assertions trace to what
   the page now does, not what it used to. Manual browser verification
   against the dev server (not just `pnpm check` going green) caught a real
   bug this rewrite left behind: the finish-step state replay indexed one
   entry past the end of the recorded pop sequence, throwing on every
   completed run and silently keeping the result banner hidden — a build
   that typechecked, built, and passed all 38 tests while the core "here's
   the shortest path" payoff never rendered.
   [`a4c3b19`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/commit/a4c3b19)
