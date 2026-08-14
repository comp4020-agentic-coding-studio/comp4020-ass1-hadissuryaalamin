# Process overview

## What I built

"One Dial, Three Pathfinders" — an interactive explainer that argues Dijkstra's
algorithm, A*, and greedy best-first search aren't three algorithms but one
weighted search (`f(n) = g(n) + weight × h(n)`) at three settings of a single
dial, and that turning the dial past "A*" quietly breaks the shortest-path
guarantee it was giving you. A visitor blocks or opens edges on a free-form
weighted graph (or loads a hand-built "trap graph"), drags a weight slider
from 0 to 3, and hits Run: the search animates its expansion and final path
node by node, then a result banner says plainly whether that path was
actually the lowest-cost one — and on the trap graph, past weight 1, it
wasn't. A run-history table lets a visitor compare weight against path cost
and nodes expanded across repeated runs on the same graph, which is where the
speed-vs-correctness trade-off actually becomes visible rather than asserted.

The visualizer started as a fixed 16×10 grid with unit-cost 4-directional
movement, and was rebuilt into the free-form node/edge graph described above
after a reference image made the grid's limits obvious — see moment 6.

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

6. **A reference image triggered a full redesign, not a reskin — and green
   checks after the rebuild still weren't the finish line.** Shown
   `graph.png`, a free-form weighted graph with labeled nodes and arrowed,
   weighted edges, the honest reading was that the grid itself — 4-directional
   unit-cost movement on a fixed rectangle — was the wrong shape for the
   claim, not just wrongly colored. Two scope questions (undirected edges?
   drag-authoring or clicks only?) got asked and answered before any code
   changed, and the rewrite touched the data model, the search algorithm, the
   renderer (CSS-grid → SVG), the controller, and the spec's own hardcoded
   grid-shape assertions in lockstep. `pnpm check` went green after each
   piece, but actually opening the running dev server with Playwright at
   both marking viewports — clicking modes, blocking edges, stepping through
   a run to its finish — surfaced four real bugs no type check or unit test
   touched: a click target silently shadowed by the visible line drawn on
   top of it, an off-by-one crash on the walkthrough's last step, a stray
   focus outline, and a `min-width` that clipped the graph's rightmost nodes
   at 1920×1080 and hid half the graph behind blank space at 390×844. Green
   `pnpm check` meant the markup was correct; only looking at the rendered
   page caught that the layout wasn't.
   [`1250d66`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/commit/1250d66),
   [`eb123fd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/commit/eb123fd)

7. **A terse three-part ask ("run automatic", "background theme math", "more
   stylish") got clarified before any CSS was written, not guessed at.** Each
   phrase had more than one reasonable reading — auto-run could have meant
   re-running the search on every input change instead of auto-advancing the
   walkthrough; "theme math" could have meant a light/dark toggle; "stylish"
   could have meant gradients and motion instead of a quieter polish pass.
   Getting any of the three wrong would mean redoing a styling-heavy change,
   so all three went to `AskUserQuestion` up front instead of being resolved
   by assumption. The build that followed — a Play/Pause auto-advance next
   to Prev/Next, a decorative dot-grid + `f(n)=g+weight·h` watermark behind
   the page, and a shadow/typography/press-state pass — then hit the same
   lesson as moment 6 from a different angle: `pnpm check` and a jsdom test
   asserting `hasAttribute("hidden")` both stayed green through a real bug,
   because neither executes real CSS cascade. `.step-controls` set
   `display: flex` unconditionally, and an author-origin rule overrides the
   browser's default `[hidden] { display: none; }` regardless of selector
   specificity — so the walkthrough controls sat visible on every page load,
   before Run was ever clicked. A Playwright screenshot of the actual
   rendered baseline is what caught it, not a passing test suite; the fix
   was the same one-line override already applied to `.graph[hidden]`
   earlier in the project, just never carried over to the sibling element.
   [`d8437ad`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/commit/d8437ad)

8. **A reused-inspiration prompt named the wrong stack, and the fix was to
   throw away everything about it except the idea.** A slider-component
   prompt arrived written for React/Tailwind/shadcn — installing `clsx`,
   `tailwind-merge`, and a component framework this repo doesn't use would
   have been the literal instruction, and the wrong one. What survived was
   the visual idea (a track/thumb with a triangle-and-square thumb) and the
   behaviors it implied, rebuilt as one vanilla `WeightSlider` class wired
   directly to this page's DOM: `setPointerCapture` drag, click-to-jump,
   keyboard steps, snap-to-marks, and a synced numeric readout, still
   driving the same `aria-valuenow`/label the native input used to. Automated
   checks stayed green throughout, and still missed two real bugs the same
   way moments 6 and 7 did: a `pnpm check` pass says the markup and types are
   right, not that the pixels are. Screenshotting the running page at
   390×844 caught a genuine layout bug — `.weight-control` had no explicit
   width, so once `.controls` switched to a column layout below 30rem, the
   box (and the slider track inside it) shrank and grew with the live label
   text's length *while a drag was in progress*, moving the track out from
   under the pointer. A second look at those same screenshots, taken
   immediately after each action, showed the thumb resting short of its
   target — not a slider bug either, but the 0.12s snap-animation caught
   mid-transition by a screenshot with no settle delay; re-shooting after a
   short wait confirmed the underlying value, fill, and thumb position were
   correct throughout and only the capture timing was off.
   [`1e7dc05`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/commit/1e7dc05)

9. **"I don't really like my site design" plus a pasted reference component
   got split into two separate asks, and the color half turned out to need
   its own search algorithm, not more manual tuning.** The reference was a
   `dev-tool-landing-page.tsx` React/Tailwind/shadcn component; its actual
   content (generic component-library marketing copy) had nothing to do with
   this site, so — same call as moment 8 — only the visual idea carried
   over: near-black surfaces, bordered rounded-xl cards, a subtle inset-
   highlight glow. The toggle was a second, independent ask (light/dark,
   with `prefers-color-scheme` detection and persistence), not implied by
   the restyle. The harder part was the graph's dark categorical palette:
   the dataviz skill is explicit that a dark theme needs its own validated
   colors, not an automatic inversion of the light ones, so each candidate
   set went through `validate_palette.js --pairs all` (all-pairs, not just
   adjacent, since graph states render simultaneously). Two hand-picked
   candidate sets both failed — fixing one colliding pair (violet vs. blue
   under deuteranopia) kept surfacing a different one (magenta vs. violet,
   then orange vs. green, then magenta vs. green) every time a hue got
   nudged by hand. That's whack-a-mole, not progress, so the fix was to stop
   guessing and write a small coordinate-ascent script reimplementing the
   validator's own OKLab/CVD math, holding four hues fixed and grid-searching
   the fifth for the one that clears every check with the most margin,
   repeating until the whole set converged. It found
   `#009d59 #b8007a #0091d7 #703dd8 #944e00` in six rounds — a set no amount
   of further hand-tuning had reached — and a Playwright screenshot of an
   actual animated run (not just the validator's numeric pass) confirmed the
   somewhat muted `#944e00` still reads clearly as its own hue against
   green/magenta/blue, not muddy, on the real dark surface.
   [`83dcd03`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-hadissuryaalamin/commit/83dcd03)

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that the
current reflection entry is in `reflections/`, and that your `CLAUDE.md` is
there --- before a marker ever opens the file. It checks that your map is
traceable, not that it is good: the marker judges whether your small,
deliberately chosen set of moments shows real judgement and reflection. A green
check is not a substitute for that curation.

Images are deliberately not checked, because whether one renders is visible the
moment you look. Open this file on GitHub and look at it before you ship.
