# Process overview

## What I built

An interactive explainer called "Tool or Not?" that argues a specific,
counterintuitive point: a model's hidden state can already know whether it
needs a tool call in the exact moments where what it *says* out loud gets it
wrong. Loosely grounded in recent hidden-state-probing research (kept
illustrative — no numbers cited, since the site is static and has no real
model behind it), the site shows a visitor a prompt and a model's spoken
reasoning, has them guess whether a tool is really needed, then animates a
layer-stack diagram revealing a hidden-state probe's verdict — which
sometimes agrees with the stated reasoning and sometimes catches it being
wrong, in both directions.

## The moments that mattered

1. **Turning the brief into failing tests before writing a single feature.**
   Before any UI existed, `spec/assignment-1.test.ts` encoded the shape of
   the interaction the brief demanded — a prompt input, a visible
   tool-call/no-tool-call decision — and it started red on purpose. Re-running
   `pnpm check` and watching that one file, and only that file, go green was
   the actual signal that the first build was done, not my own read of the
   page.
   [`46a94b2`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/commit/46a94b2)

2. **The first build passed every check and still wasn't good.** I shipped a
   rule-based `decideTool()` function and animated it across a six-stage
   pipeline (prompt → LLM → decision → tool call → tool result → final
   response). `pnpm check` was fully green at both viewports. But the
   "decision" was a regex classifier restating its own input back at the
   visitor — no real point of view, nothing a reader couldn't have guessed
   themselves. Green checks told me it worked; they couldn't tell me it was
   worth building.
   [`1eb6511...e6a2e97`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/compare/1eb6511...e6a2e97)

3. **Throwing the spec-compliant build away for a real idea, gated behind an
   explicit sign-off.** Rather than keep polishing the pipeline, I re-grounded
   the whole concept in an actual finding — that a probe on a model's hidden
   state predicts tool need more reliably than the model's own verbalized
   reasoning does. That meant discarding working code, so before touching any
   implementation the new shape went down in `PLAN.md` (the round data, the
   deliberate mix of agreeing and disagreeing rounds, the file-by-file plan)
   and waited for an explicit go-ahead rather than assuming green checks on
   the old build meant the pipeline was fine to iterate on. The go-ahead was
   one word:

   > Agreed

   which is what turned the plan into the rewrite in the commit below — the
   whole pipeline replaced by the probe-guessing game, `agent-logic.ts` and
   `pipeline.ts` deleted outright rather than adapted.
   [`78c4f59...fc82a45`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/compare/78c4f59...fc82a45)

4. **Checking the interaction actually worked, not just that it built.**
   This environment has no headless-browser tool, so `pnpm check` passing
   only proved the new markup existed — not that clicking a guess button
   actually drove the layer-stack animation, updated the score, or reset
   correctly on "Play again". Rather than call structural checks good enough,
   I wrote a throwaway jsdom test that instantiated the real controller,
   dispatched real click events, and advanced fake timers through a full
   8-round playthrough, asserting on the DOM state after each step. It caught
   nothing wrong this time, but it's the difference between "the tests pass"
   and "I watched it work" — the test itself was deleted before committing,
   since it was a one-off check rather than part of the shipped contract.
   [`fc82a45`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/commit/fc82a45)

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that the
current reflection entry is in `reflections/`, and that your `CLAUDE.md` is
there --- before a marker ever opens the file. It checks that your map is
traceable, not that it is good: the marker judges whether your small,
deliberately chosen set of moments shows real judgement and reflection. A green
check is not a substitute for that curation.

Images are deliberately not checked, because whether one renders is visible the
moment you look. Open this file on GitHub and look at it before you ship.
