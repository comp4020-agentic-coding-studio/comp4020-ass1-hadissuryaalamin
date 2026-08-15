# PLAN: scroll-pinned, scroll-scrubbed Dijkstra walkthrough

Status: superseding the entire previous `PLAN.md` (see §0). Written as a
refinement plan only — no application code has been touched while writing
this document, per the task that produced it.

## 0. Baseline: what's true, what's stale, what I actually read

**The previous `PLAN.md` is 100% stale — none of it survives.** It documented
a second pivot, "One Dial, Three Pathfinders" (an A\*/Dijkstra/greedy weight
slider over a 16×10 wall-drawing grid, `src/lib/astar.ts`,
`src/scripts/grid-controller.ts`, a run-history table). That pivot was itself
abandoned for a third and final pivot — a single fixed 7-node graph walked by
plain Dijkstra with a real-source-code panel — confirmed by:

- `PROCESS.md` moment 4: "A third pivot, and rebuilding the spec file from the
  mechanic outward instead of patching it... 'One Dial, Three Pathfinders' gave
  way to a single fixed directed graph walked by plain Dijkstra."
- `git log`: `a4c3b19 Pivot to a single fixed-graph Dijkstra walkthrough with
  real source code`.
- None of `src/lib/astar.ts`, `src/scripts/grid-controller.ts`, or any
  wall-drawing/weight-dial testid exists in the current tree —
  `spec/assignment-1.test.ts:85-94` explicitly asserts their *absence*
  (`mode-draw`, `mode-erase`, `mode-start`, `mode-end`, `weight-slider`,
  `clear-walls-button`, `load-trap-button`, `history-table` all
  `toBeFalsy()`).

This document replaces the old plan wholesale rather than editing it, because
there is nothing in it worth keeping.

**Files read in full before writing this plan**: `CLAUDE.md` (already in
context), `PLAN.md` (old, above), `PROCESS.md`, `README.md`, `package.json`,
`astro.config.ts`, `tsconfig.json`, `mise.toml`, `pnpm-workspace.yaml`,
`.oxlintrc.json`, `.stylelintrc.json`, `.githooks/pre-commit`,
`.github/workflows/checks.yml`, `src/pages/index.astro`,
`src/layouts/Layout.astro`, `src/scripts/graph-controller.ts`,
`src/scripts/main.ts`, `src/lib/dijkstra.ts`, `src/lib/dijkstra.test.ts`,
`src/lib/example-graph.ts`, `src/lib/code-samples.ts`,
`src/lib/code-samples.test.ts`, `src/lib/highlight.ts`, `src/styles/global.css`,
`spec/README.md`, `spec/invariants.test.ts`, `spec/assignment-1.test.ts`,
`reflections/assignment-1.md`. I did not open the site in a real or emulated
browser while writing this plan (`agent-browser` is not installed in this
environment; confirmed with `which agent-browser`) — every pixel figure in §2
and §3.4 is derived from CSS arithmetic against the values actually in
`global.css`, not from a rendered screenshot. That's flagged explicitly
wherever it matters, and Phase 3's manual QA is where those numbers get
confirmed or corrected against the real, rendered page.

**Baseline `pnpm check`: green.** Run in full before writing this plan:

| Step | Result |
|---|---|
| `astro check` | 0 errors, 0 warnings, 0 hints (16 files) |
| `astro build` | succeeds, 674ms total, 1 page (`/index.html`) |
| `oxlint` | passes (chain continued) |
| `stylelint` | passes (chain continued) |
| `vitest run` | **5 test files passed, 39 tests passed**, 931ms |

Exit code 0. This is the state every phase below must return to.

**GSAP / ScrollTrigger — already available, zero new dependency.**
`package.json:29` pins `"gsap": "^3.15.0"`. Confirmed installed version via
`node -e "console.log(require('./node_modules/gsap/package.json').version)"`
→ `3.15.0`. Confirmed `node_modules/gsap/ScrollTrigger.js` exists in the
installed package alongside `Draggable.js`, `Flip.js`, `Observer.js`,
`ScrollSmoother.js`, `ScrollToPlugin.js`, `SplitText.js`, etc. — every GSAP
bonus plugin ships free in the core npm package as of GSAP 3.12+, registered
via `import { ScrollTrigger } from "gsap/ScrollTrigger"` +
`gsap.registerPlugin(ScrollTrigger)`. No `package.json`/`pnpm-lock.yaml`
change is needed to use it.

---

## 1. Goal and success criteria

**Goal.** The graph panel currently sits in normal document flow and only
moves when a button is pressed. Make it feel like an instrument that comes
forward when the reader scrolls to it, holds itself in view while they scan
through the algorithm at their own scroll speed, and lets go cleanly when
they're done — without ever taking scroll control away from them, and without
regressing the one thing this site is actually graded on: Run/Prev/Next
driving the same graph+narration+code walkthrough correctly.

**Success criteria — 1920×1080:**

1. Scrolling into the graph section visibly detaches it from the page (shadow/
   elevation change, not just a `position` swap) within one scroll gesture,
   before any step-scrubbing starts.
2. Once pinned, scrolling forward and backward moves `stepIndex` forward and
   backward in lockstep — no lag, no skipped steps, no re-triggering the same
   step repeatedly for a small scroll movement.
3. Run, Prev, and Next all still work while pinned, including via keyboard
   (Tab to the button, Enter/Space to activate) — pressing Next visibly
   advances the pinned card and does not fight the reader's next scroll input.
4. Scrolling past the end of the track releases the graph back into normal
   flow with no visible jump, flash, or leftover transform — the page
   continues exactly as if the graph had never left flow.
5. `prefers-reduced-motion: reduce` removes the pin/scrub behavior entirely;
   Run/Prev/Next still work exactly as they do today, with no scroll-driven
   surprises.

**Success criteria — 390×844:**

1. The same lift/pin/scrub/release mechanic works, with a condensed layout —
   not a smaller version of the desktop bug, an intentionally redesigned
   compact card (see §3.4).
2. The pinned card (graph + controls + code panel) fits inside 844px CSS
   pixels with room to spare, confirmed against the exact source line counts
   in §3.4, not guessed.
3. Run/Prev/Next remain tappable and are not pushed below the fold by the
   pinned card's own height.
4. The currently-highlighted source line stays visible inside the
   height-capped code panel as steps change (scrolls itself into view within
   its own box, not the page).

---

## 2. Current state — exact seams, exact fragility

**Owner of step state**: `GraphController` (`src/scripts/graph-controller.ts`).
A single private field `stepIndex` (line 51, range `0..totalSteps` inclusive)
drives one render pass:

- `renderStep()` (147-195) — recomputes node/edge visual state from
  `computeState()` (129-144), which is a pure replay of
  `result.steps[0..stepIndex)`, then fans out to `renderControls()` (204-214),
  `renderCodeHighlight()` (243-261), and `renderResult()` (263-279).
- Three call sites mutate `stepIndex` directly today: `stepPrev()` (107-111),
  `stepNext()` (113-117), and `run()`'s reset to 0 (76) before
  `scheduleAutoplay()` (81-90) repeatedly calls `stepNext()` on a
  self-rescheduling `window.setTimeout` (delay `AUTOPLAY_DELAY_MS = 900`, or
  `0` under `prefersReducedMotion()` — line 9-15, private to this file).
- `onPrevClick`/`onNextClick` (97-105) already call `stopAutoplay()` before
  stepping — Next/Prev already interrupt Run today. This is the existing
  precedent the new scroll input has to fit into, not compete with.
- `totalSteps` (50, `private readonly`, set once in the constructor at line
  58 as `result.steps.length + 1`) is **not currently exposed** outside the
  class.

**Markup**: `src/pages/index.astro:61-164`. `.visualization` (a flex column)
directly contains `<figure class="graph-figure">` (SVG `.graph-stage` + the
`.controls` panel, side-by-side at desktop via `global.css:237-243`, stacked
via the one existing breakpoint at `global.css:460-465`) and, after it,
`<aside class="code-panel">`. Everything the walkthrough touches —
`[data-testid="graph"]`, `graph-node`×7, `graph-edge`×11, `node-cost`×7,
`controls`, `run-button`, `step-prev`, `step-next`, `step-counter`,
`step-caption`, `code-panel`, `code-tab-{lang}`×2, `code-block`×2 — lives
inside this one `.visualization` subtree. `Layout.astro` is a bare
`<body><slot /></body>` shell (22 lines, no wrapper div, imports
`global.css` only) — there is no existing hook to attach page-level scroll
behavior to other than the page itself.

**No teardown exists anywhere today.** `main.ts` (3 lines) is
`new GraphController(document).start()` and nothing else — no
`destroy()`/cleanup path, no `beforeunload`, no HMR guard. Any new
`ScrollTrigger` instance or scroll listener this plan adds is the first thing
in this codebase that needs an explicit kill path (§4, §9).

**The real layout risk is the code panel, not the graph.** I did the
arithmetic rather than assume "it'll probably fit":

- `PYTHON_SOURCE` (`code-samples.ts:11-46`, closing backtick alone on 46) is
  **35 content lines**; `JAVA_SOURCE` (`:48-94`) is **46 content lines**.
- `.code-block pre` (`global.css:401-407`): `font-size: 0.8rem` (12.8px),
  `line-height: 1.6` → 20.48px per line, `padding: 0.85rem 1rem` (13.6px top
  + bottom = 27.2px).
- Uncapped height ≈ `35 × 20.48 + 27.2 ≈ 744px` (Python) / `46 × 20.48 + 27.2
  ≈ 969px` (Java) for the code block alone, before `.code-panel`'s own
  `h2` + `.code-tabs` + `padding: 1rem 1.25rem` (`global.css:346-353`) are
  added on top (~90px more) — **≈ 830-1060px for the code panel alone**.
- `.graph-figure` at 1920×1080 (`main` capped at `max-width: 64rem` = 1024px,
  `.graph-stage` gets `1024 − 240 (controls, `flex: 0 0 15rem`) − 24 (gap)
  ≈ 760px` wide, SVG at the fixed 800:450 viewBox ⇒ `≈ 427px` tall) plus the
  controls sidebar (three stacked full-width buttons + counter + caption ⇒
  `≈ 320-450px`, roughly matched to the SVG height) is comfortably under
  500px.
- **Sum: graph-figure (~450px) + gap (24px) + code-panel (~830-1060px) ≈
  1300-1530px — taller than the 1080px viewport itself.** An uncapped pin of
  the whole `.visualization` block would pin something bigger than the
  screen, pushing Run/Prev/Next out of reach while pinned. This is true
  **at desktop, not just at 390×844** — the initial assumption that "desktop
  has plenty of room" doesn't survive contact with the actual source line
  counts. §3.4 designs around this directly (a height-capped, internally
  scrollable code block, at both viewports, with different caps).

**Existing reduced-motion mechanism**: one `@media (prefers-reduced-motion:
reduce)` block (`global.css:467-474`) turning off `transition` on four
selectors, plus the private `prefersReducedMotion()` check
(`graph-controller.ts:9-15`) gating GSAP pop tweens and the autoplay delay.
There is no shared/exported motion-preference util and no runtime
`matchMedia` change listener today — anything new that needs to react to the
OS setting changing mid-session has to add that itself.

**Spec-test contracts that must not regress** (both files run against static
`dist/index.html` via JSDOM — neither executes client JS, so neither can
directly test scroll/pin/scrub behavior, but both assert exact DOM shape that
new wrapper markup must not disturb):

- `spec/invariants.test.ts`: `lang` attribute, non-empty title, viewport meta,
  a `nav`, exactly one `h1`, `alt` on every `img` (there are none today, so
  this is vacuous unless the plan adds an `img`).
- `spec/assignment-1.test.ts`: exactly 7 `graph-node`, 11 `graph-edge`, 7
  `node-cost` (S = `g=0`, rest `g=∞`), `controls` containing all three
  buttons, `step-counter`/`step-caption` present, `result-banner` initially
  `hidden`, the eight old wall-drawing testids **absent**, and per-language
  `code-block` line counts matching `CODE_SOURCE[lang].split("\n").length`
  exactly (35 / 46).

None of these query anything about `.visualization`'s parent, so wrapping it
in a new outer element is safe for these tests as long as every testid above
stays exactly where it is, unrenamed, unremoved. Confirmed — no test in
either file queries `.visualization` by class, only by the `data-testid`
attributes nested inside it.

---

## 3. Interaction spec

### 3.1 States

| State | Entered when | Graph position | Scroll behaviour | Step cursor |
|---|---|---|---|---|
| `idle` | Section not yet scrolled to (above the pin trigger) | Normal document flow | Native, unaffected | Whatever it last was (usually 0) |
| `entering` | Trigger crosses viewport top, GSAP's pin engages | Transition to pinned position + lift-off treatment plays once | Native, unaffected | Unchanged during the transition |
| `pinned` | Fully pinned, scroll position inside the track | Fixed in view (GSAP `pin: true`) | Native — reader controls rate | Follows scroll progress (§3.2) |
| `scrubbing` | A sub-state of `pinned`: scroll position is actively changing | Fixed | Native | Recomputed every rAF tick via `ScrollTrigger`'s own throttling |
| `playing` | Run pressed (may start from `idle` or `pinned`) | Fixed if pinned, otherwise unaffected | Autoplay drives scroll to match each step (`syncScrollToStep`, §4) — reader's own scroll always wins and cancels it (§3.3) | Advances on `AUTOPLAY_DELAY_MS` timer, same as today |
| `released` | Scroll passes the track's end | Restored to normal flow, no jump (GSAP's pin-spacer already reserves the exact space, §4) | Native | Holds at `totalSteps` (finish) |

Reduced motion collapses `idle`/`entering`/`pinned`/`scrubbing`/`released`
into a single always-`idle` state — no pin is ever created (§7). `playing`
still exists (Run still works), it just never touches scroll.

### 3.2 Scroll progress → step index

`ScrollTrigger` gives a normalized `self.progress` (0 at trigger start, 1 at
trigger end) for free — no hand-rolled `scrollY`/`getBoundingClientRect` math
needed, and no separate "scroll progress" variable persisted anywhere: it's
read from the DOM (via ScrollTrigger) on demand, not cached, so there is
exactly one thing that owns the step cursor (`GraphController.stepIndex`) and
scroll is only ever an input to it, never a shadow copy of it.

```ts
// src/lib/scroll-step.ts (pure, unit-tested — no DOM, no GSAP)
export function stepFromProgress(
  progress: number,      // 0..1, already clamped by ScrollTrigger
  totalSteps: number,    // GraphController.totalSteps, e.g. 8
  currentStep: number,   // GraphController.currentStep, for hysteresis
  hysteresis = 0.06,     // fraction of one step's width
): number {
  const raw = progress * totalSteps;
  const lower = currentStep - 0.5 - hysteresis;
  const upper = currentStep + 0.5 + hysteresis;
  if (raw >= lower && raw <= upper) return currentStep; // inside the dead zone: hold
  return Math.min(totalSteps, Math.max(0, Math.round(raw)));
}

export function progressFromStep(step: number, totalSteps: number): number {
  return totalSteps === 0 ? 0 : step / totalSteps;
}
```

The hysteresis band is what stops a reader hovering their scroll wheel right
at a step boundary from flickering the graph back and forth between two
states on every pixel of scroll jitter — without it, `Math.round` alone
flips at the exact midpoint with zero tolerance either side.

Track height: `--step-count` steps at `--step-vh` each (`35vh` default,
tunable — see §4's CSS). For this fixed graph, `totalSteps = 8`, so the
track is `280vh` at desktop (`8 × 35vh`), giving each step roughly one
half-viewport of scroll distance to live in — enough to scrub deliberately,
not so much that reaching the end feels like a chore.

### 3.3 Buttons vs. scroll — the one thing this plan cannot get wrong

Constraint #1 says scroll must be an input to the *existing* step cursor, not
a second state machine. The design that satisfies this without the two
inputs fighting each other:

- **`stepIndex` is the only authoritative variable.** It already is
  (`graph-controller.ts:51`).
- **Scroll position is a *view* of `stepIndex` while pinned** — read-only,
  recomputed from the DOM every tick, not stored separately.
- **Button clicks are writes to `stepIndex`**, exactly as today — and when a
  write happens while pinned, the *scroll position* is animated to match it
  (`window.scrollTo`, native `smooth` behavior), the same way clicking an
  anchor link scrolls the page. This is a direct, synchronous response to an
  explicit click, not an ambient override of the reader's own scrolling —
  it's the same category of action as a smooth anchor jump, not scroll
  hijacking.
- **A genuine manual scroll during Run interrupts Run** (`interrupt()`,
  §4) — mirroring the already-existing `onPrevClick`/`onNextClick` behavior
  of calling `stopAutoplay()` before stepping. The one wrinkle: Run's own
  autoplay ticks *also* call `syncScrollToStep`, which itself fires a scroll
  event — without a guard, that would make Run immediately interrupt itself.
  A `programmaticScroll` flag (set before `scrollTo`, cleared on the native
  `scrollend` event, with a timeout fallback for engines that don't fire it)
  distinguishes "a scroll I just caused" from "a scroll the reader just
  caused" (§4). Chrome (this course's marking browser) has supported
  `scrollend` since v114.

| Action while pinned | `stepIndex` | Scroll position | Autoplay |
|---|---|---|---|
| Reader scrolls | Recomputed from progress (§3.2) | Unaffected — native | Interrupted if running |
| Next / Prev pressed | Set directly (unchanged from today) | Animated to match the new step | Already stopped (existing `stopAutoplay()` call) |
| Run pressed | Reset to 0, then advances on the existing timer | Animated to match each tick | Starts |
| Run's own tick fires | Advances by 1 (unchanged) | Animated to match — guarded by `programmaticScroll` so it doesn't self-interrupt | Continues |

---

## 4. Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  src/lib/scroll-step.ts     │        │  src/lib/motion.ts (new,      │
│  pure — stepFromProgress,   │        │  extracted from               │
│  progressFromStep           │        │  graph-controller.ts:9-15)     │
│  ▲ unit-tested directly     │        │  prefersReducedMotion()        │
└──────────────┬──────────────┘        └───────────────┬──────────────┘
               │ read by                                 │ read by both
               ▼                                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ src/scripts/scroll-pin-controller.ts  (impure — DOM + GSAP)          │
│  - owns: ScrollTrigger instance, matchMedia contexts, the            │
│    programmaticScroll flag, the pin/track DOM elements               │
│  - reads GraphController.totalSteps / .currentStep                   │
│  - writes via GraphController.goToStep(index, "scroll")              │
│  - subscribes via GraphController.onStepRendered                     │
│  - exposes destroy() — kills ScrollTrigger + matchMedia + listeners  │
└───────────────────────────────┬────────────────────────────────────-─┘
                                 │ goToStep() / onStepRendered
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│ src/scripts/graph-controller.ts  (owns the canonical cursor)         │
│  - stepIndex remains the ONLY authoritative state (unchanged field)  │
│  - NEW: goToStep(index, source) replaces the bodies of stepPrev()/   │
│    stepNext()/run()'s reset — one write path, called by buttons AND  │
│    by the pin controller                                             │
│  - NEW: totalSteps made readonly-public (was private) — a one-word   │
│    diff, since it's already only ever read, never written, outside   │
│    the constructor                                                   │
│  - NEW: get currentStep(): number                                    │
│  - NEW: interrupt() — public alias for the existing stopAutoplay()   │
│  - NEW: onStepRendered callback, invoked at the end of goToStep()     │
│  - renderStep()/computeState()/renderCodeHighlight()/etc. UNCHANGED  │
└──────────────────────────────────────────────────────────────────────┘
```

**Exact new/changed signatures in `graph-controller.ts`:**

```ts
export type StepSource = "control" | "scroll";

export class GraphController {
  readonly totalSteps: number;                 // was `private readonly` (line 50)
  get currentStep(): number { return this.stepIndex; }
  onStepRendered: ((index: number, source: StepSource) => void) | null = null;

  /** The one write path for stepIndex. Buttons and scroll both call this. */
  goToStep(index: number, source: StepSource = "control"): void {
    const clamped = Math.max(0, Math.min(this.totalSteps, index));
    if (clamped === this.stepIndex) return;
    this.stepIndex = clamped;
    this.renderStep();
    this.onStepRendered?.(this.stepIndex, source);
  }

  /** Public alias — lets the scroll layer cancel an in-flight Run. */
  interrupt(): void { this.stopAutoplay(); }
}
```

`stepPrev()`/`stepNext()`'s bodies (`107-117`) become one-line calls to
`this.goToStep(this.stepIndex - 1)` / `this.goToStep(this.stepIndex + 1)`;
`run()` (74-79) calls `this.goToStep(0)` instead of setting `stepIndex`
directly; `scheduleAutoplay()`'s tick (85) calls
`this.goToStep(this.stepIndex + 1)` instead of `this.stepNext()`. No existing
`stopAutoplay()` call site changes — `onPrevClick`/`onNextClick`/`run()` keep
calling it exactly where they do today (97-98, 102-103, 75). `goToStep`
itself never calls `stopAutoplay()` — that responsibility stays exactly
where it already lives, so this refactor changes *what sets `stepIndex`*
without changing *who's responsible for stopping autoplay*.

**New file: `src/lib/scroll-step.ts`** — pure functions from §3.2, no
imports from GSAP or the DOM. Fully unit-testable.

**New file: `src/lib/motion.ts`** — `prefersReducedMotion()` moved out of
`graph-controller.ts:9-15` verbatim (same implementation), re-exported from
there for backward compatibility within the module, imported fresh by the
new pin controller. One shared source instead of a second private copy.

**New file: `src/scripts/scroll-pin-controller.ts`**:

```ts
export class ScrollPinController {
  constructor(
    private readonly graph: GraphController,
    private readonly trackEl: HTMLElement,
    private readonly pinEl: HTMLElement,
  ) {}

  start(): void {
    // no-op entirely under reduced motion — see §7
    // otherwise: gsap.registerPlugin(ScrollTrigger); ScrollTrigger.matchMedia({...})
  }

  destroy(): void {
    // kills the ScrollTrigger instance(s), the matchMedia context,
    // and the scrollend listener if one is pending
  }
}
```

Constructed in `main.ts` alongside `GraphController`, wired via
`onStepRendered`:

```ts
// src/scripts/main.ts
const graph = new GraphController(document);
graph.start();
const pin = new ScrollPinController(graph, trackEl, pinEl);
pin.start();
```

**Markup diff — the only change to `index.astro`**: wrap the existing
`.visualization` div (lines 61-164, unchanged inside) in one new element:

```astro
<div class="scroll-track" data-testid="scroll-track">
  <div class="visualization">
    <!-- everything currently on lines 62-163, byte-for-byte unchanged -->
  </div>
</div>
```

`--step-count` is set by the pin controller at `start()` time (it already
knows `graph.totalSteps` from the constructor it was given), not baked in at
Astro build time — this avoids a second, redundant `search()` call in
frontmatter just to know a step count the client already computes once. A
CSS fallback (`--step-count: 8`) keeps `.scroll-track`'s height sane before
JS runs.

**CSS additions (`global.css`)** — new rules, plus one addition to the
*existing* `prefers-reduced-motion` block at 467-474 and one addition inside
the *existing* `width <= 60rem` block at 460-465 (no new breakpoint
introduced):

```css
.scroll-track {
  --step-vh: 35vh;
  height: calc(var(--step-count, 8) * var(--step-vh));
}

.lift-off {
  /* applied by GSAP to .visualization for the duration of the pin */
  box-shadow: 0 1.5rem 3rem rgb(0 0 0 / 45%);
  scale: 1.015;
}

.code-panel .code-block {
  max-height: 16rem;     /* desktop cap — derived in §2 from the 35/46-line sources */
  overflow-y: auto;
}

@media (width <= 60rem) {
  /* existing rule, unchanged */
  .graph-figure { flex-direction: column; align-items: stretch; }

  /* new: tighter cap + single-row controls for the compact pinned card */
  .code-panel .code-block { max-height: 9rem; }
  .action-row { flex-direction: row; }
}

@media (prefers-reduced-motion: reduce) {
  /* existing rule, unchanged */
  .graph-node, .graph-edge, .code-block .line, .btn { transition: none; }

  /* new: no track, no pin, ever — CSS-level fallback, not just a JS check */
  .scroll-track { height: auto; }
}
```

Animating only `transform`/`opacity`/`box-shadow`/`scale` (never `top`,
`height`, or `margin` on the pinned element itself) satisfies constraint #8.
`ScrollTrigger`'s own `pin: true` mechanism inserts a spacer element matching
the pinned box's size automatically — that's what "reserve the pinned
element's space" is, structurally, not something this plan hand-rolls.

**Teardown** (constraint #9, and the first teardown path this codebase has
had at all): `ScrollPinController.destroy()` kills every `ScrollTrigger`
instance it created, reverts the `ScrollTrigger.matchMedia()` context (which
GSAP does automatically on revert — it's the built-in mechanism for exactly
this), and removes the `scrollend` listener. There is no Astro View
Transitions router on this page (`Layout.astro` is a bare shell, confirmed —
no `<ClientRouter />`, no `transition:animate` anywhere), so the only real
teardown need is **Vite HMR during `pnpm dev`**, where re-executing `main.ts`
without killing the previous instance would stack duplicate `ScrollTrigger`s.
Guard it with `import.meta.hot?.dispose(() => pin.destroy())` in `main.ts`.

---

## 5. Implementation phases

Every phase is one commit, ends on a green `pnpm check`, and leaves `main`
deployable. P0 is the complete, shippable feature; P1/P2 are polish that can
slip past the deadline without the feature being broken or half-built.

| # | Tier | Commit | What it does | Why it's safe alone |
|---|---|---|---|---|
| 1 | P0 | "Extract pure step-progress mapping and shared motion check" | Add `src/lib/scroll-step.ts` + tests. Move `prefersReducedMotion` to `src/lib/motion.ts`, re-export from `graph-controller.ts`. Add `goToStep`/`currentStep`/`onStepRendered`/`interrupt`/public `totalSteps` to `GraphController`; rewrite `stepPrev`/`stepNext`/`run`/autoplay-tick to call `goToStep`. **No visual or markup change.** | Pure refactor of an already-tested code path; existing 39 tests must still pass unchanged, proving zero behavior drift before any GSAP code exists. |
| 2 | P0 | "Add scroll-track markup and desktop pin+scrub" | Wrap `.visualization` in `.scroll-track` (index.astro). Add `ScrollPinController`, wired in `main.ts`. `ScrollTrigger.matchMedia` desktop branch only (`(min-width: 60.0625rem)`): pin the whole `.visualization`, scrub via `stepFromProgress`, lift-off treatment on entry. | Isolated behind a min-width matchMedia branch — mobile layout untouched by this commit. |
| 3 | P0 | "Condense the pinned card for the phone breakpoint" | Add the `max-height`/`overflow-y` code-block cap (both breakpoints) and the single-row `.action-row` override under the existing `width <= 60rem` block. Confirm real fit at 390×844 in the dev server; adjust `--step-vh`/caps against what's actually measured (§3.4 numbers are estimates until this phase). | Desktop behavior from phase 2 already shipped and doesn't regress — this only adds mobile-scoped CSS and (if needed) a mobile `ScrollTrigger.matchMedia` branch pinning the same element with the now-condensed CSS. |
| 4 | P0 | "Sync buttons and scroll bidirectionally" | Implement `syncScrollToStep` + the `programmaticScroll` flag + `scrollend` handling; wire `onStepRendered` so control-sourced changes animate scroll, scroll-sourced changes call `interrupt()` on Run. | Additive on top of phases 2-3's already-working one-directional scrub; buttons already worked before this phase, this only adds the scroll-sync side-effect. |
| 5 | P0 | "Reduced-motion fallback and teardown" | Add the `prefers-reduced-motion` CSS fallback (`.scroll-track { height: auto }`) and the JS-level no-pin-at-all branch in `ScrollPinController.start()`. Add `destroy()` + the `import.meta.hot?.dispose()` HMR guard in `main.ts`. Decide and implement the `aria-live` policy (§7). | Self-contained safety-net phase — nothing upstream depends on this being done last except that it needs the pin mechanism (phases 2-4) to exist first to have something to disable. |
| 6 | P0 | "Manual QA pass, spec/test additions, perf cleanup" | Full manual QA checklist (§6) at both viewports, keyboard-only pass, reduced-motion pass. Add the code-block active-line `scrollIntoView` call to `renderCodeHighlight()`. Remove any temporary `will-change` once confirmed unneeded (§8). | Closes out P0 — this is the phase that turns "should work" into "confirmed working," and the last one before the deadline. |
| 7 | P1 | "Per-step rail using narrateStep" | Extract `narrateStep` (`graph-controller.ts:216-241`) to a pure function taking `(result, stepIndex, totalSteps)`; use it to render a static list of short per-step labels alongside the pinned card (desktop only — no room on mobile). | Purely additive UI enhancement; ships only if P0 is done with time to spare. |
| 8 | P1 | "Lift-off animation polish" | Replace the flat `.lift-off` box-shadow/scale toggle with a short GSAP timeline (elevation ramps in over ~200ms, not an instant snap). | Cosmetic only. |
| 9 | P2 | "Progress ticks / step markers in the controls panel" | Small visual indicator of position within the track, independent of the rail. | Stretch — cut without consequence if time runs out. |

**P0 is genuinely complete on its own**: phases 1-6 deliver lift-off, pin,
scrub (both directions), release, working buttons+keyboard while pinned,
Run/autoplay integration, a condensed mobile layout with a confirmed fit, a
full reduced-motion fallback, and teardown. Nothing in §1's success criteria
depends on P1/P2.

---

## 6. Test plan

**Unit tests (Vitest, following the existing convention in
`dijkstra.test.ts`/`code-samples.test.ts` — hand-traced assertions on pure
functions, no DOM):**

`src/lib/scroll-step.test.ts` (new):

| Case | Input | Expected |
|---|---|---|
| Start | `progress=0, totalSteps=8, currentStep=0` | `0` |
| End | `progress=1, totalSteps=8, currentStep=8` | `8` |
| Mid-step, no ambiguity | `progress=0.5, totalSteps=8, currentStep=4` | `4` |
| Crossing a boundary forward | `progress=0.26, totalSteps=8, currentStep=1` | `2` (raw ≈ 2.08, outside the hold band around 1) |
| Inside the hysteresis band | `progress=0.1875, totalSteps=8, currentStep=1` | `1` (raw = 1.5, exactly the boundary — held, not flipped) |
| Reverse scrub | same inputs as "crossing forward" but arriving from `currentStep=3` moving down | symmetric: flips to `2`, not stuck |
| Out of range low | `progress=-0.1, totalSteps=8, currentStep=0` | `0` (clamped) |
| Out of range high | `progress=1.3, totalSteps=8, currentStep=8` | `8` (clamped) |
| `progressFromStep` inverse | `step=4, totalSteps=8` | `0.5` |
| `progressFromStep` zero steps | `step=0, totalSteps=0` | `0` (guarded, not `NaN`) |

**What jsdom genuinely cannot test, and what's stubbed instead:** jsdom has
no real layout engine — no computed `getBoundingClientRect`, no scroll
position, no `IntersectionObserver` geometry, and `ScrollTrigger` itself
requires a real viewport to compute `start`/`end`. So `ScrollPinController`
is **not** unit-tested for its actual pin/scrub behavior; only
`scroll-step.ts`'s pure math is. `ScrollPinController`'s constructor and
`destroy()` can get a thin smoke test (construct with stub elements, assert
`destroy()` doesn't throw when `start()` was never called), but that's a
smoke test, not a behavior test — logged here so it isn't mistaken for real
coverage.

**New tests belonging in `spec/`:** none needed beyond confirming the
existing `spec/assignment-1.test.ts` assertions still pass unmodified
(they query `data-testid`s inside `.visualization`, which phase 2's wrapper
doesn't touch — verified in §2). If desired, one additional structural
assertion could be added confirming `[data-testid="scroll-track"]` exists and
contains the existing `.visualization` markup — optional, not required by
the spec, and not included in P0 to keep the diff minimal.

**Manual QA checklist (both viewports, real browser — this is where §3.4's
estimated pixel figures get confirmed or corrected):**

- [ ] Scroll into the section: lift-off is visible before scrubbing starts.
- [ ] Scroll slowly through the whole track forward: every step is reachable,
      none skipped, none repeated on small movements.
- [ ] Scroll back up through the whole track: exact reverse of the above.
- [ ] Hover-scroll right at a step boundary (mouse wheel micro-movements):
      no flicker.
- [ ] Click Next/Prev while pinned, at several points in the track: scroll
      position visibly syncs to the new step; next scroll-wheel input
      continues smoothly from there, doesn't jump back.
- [ ] Press Run while pinned: card auto-scrolls in sync with each step; a
      manual scroll mid-run interrupts it immediately.
- [ ] Press Run from *above* the section (not yet scrolled to it) — note
      the known P0 gap here (§9, §11): confirm actual behavior, decide if
      it needs a P1 fix.
- [ ] Scroll past the end: release is jump-free; scroll back up: re-enters
      cleanly.
- [ ] Tab through Run/Prev/Next/code tabs with the keyboard while pinned;
      Enter/Space activate correctly; focus outline (`:focus-visible`,
      `global.css:61-64`) is visible against the lifted card.
- [ ] Emulate `prefers-reduced-motion: reduce`: no pin ever engages, no
      scroll-track height reserved, Run/Prev/Next behave exactly as they do
      today.
- [ ] At 390×844: measure the actual rendered height of the pinned card and
      confirm it's under 844px with margin; confirm the code panel's active
      line stays visible as steps change; confirm Run/Prev/Next are never
      pushed off-screen.
- [ ] `pnpm check` green after every phase.

---

## 7. Accessibility and motion spec

**Reduced motion — a full fallback, not `animation: none`.** Under
`prefers-reduced-motion: reduce`: `ScrollPinController.start()` returns
immediately without creating any `ScrollTrigger` (checked via the shared
`prefersReducedMotion()` from `src/lib/motion.ts`); the CSS fallback
(`.scroll-track { height: auto }`, §4) collapses the track to zero extra
scroll distance independent of whether JS ran at all; the graph renders in
normal flow exactly as it does today, and Run/Prev/Next are entirely
unaffected — this is the same code path they already use, untouched by any
of phases 2-5. Content is never hidden or truncated because of reduced
motion; only the pin/scrub mechanism is removed. Because `matchMedia`
doesn't fire a change event on its own, `ScrollPinController` should also
attach a `matchMedia("(prefers-reduced-motion: reduce)").addEventListener`
listener so a reader toggling the OS setting mid-session gets torn
down/rebuilt live, not just checked once at load — this is the one place
this plan asks for a *new* runtime check beyond what exists today, since
`graph-controller.ts` currently only checks `prefersReducedMotion()` at
individual render calls (cheap to call repeatedly) rather than needing a
persistent listener.

**Focus management.** No element receives programmatic focus as a *result*
of scroll-driven step changes — scrubbing must never steal focus from
whatever the reader was last interacting with (e.g., a code tab they just
tabbed to). Focus only ever moves in response to an explicit user action
(clicking/activating Prev/Next/Run), which is unchanged from today's
behavior — the plan adds no new focus-management code beyond what already
exists, and needs none.

**`aria-live` policy.** The existing `[data-testid="graph-status"]`
(`index.astro:166`, `role="status" aria-live="polite"`) already announces
`narrateStep()`'s text on every `renderStep()` call
(`graph-controller.ts:213`, `announce()`). Left as-is, this would mean a
screen-reader user scrubbing through the section by scrolling gets a new
announcement fired on every step the scroll passes through — which, unlike
a deliberate button press, can happen many times in quick succession as
someone scrolls past the whole track. Decision: **scroll-sourced step
changes do not interrupt/spam the live region on every single step; only
control-sourced changes (button clicks, Run) announce immediately.**
Concretely: `announce()` (or its caller in `renderControls`) is only invoked
when `goToStep`'s `source === "control"`; scroll-sourced changes still
update all the visible/visual state (node colors, code highlight, counter
text) but skip the `aria-live` announcement, so a screen-reader user
scrubbing by scroll doesn't get flooded with rapid-fire announcements they
didn't ask for one at a time — and can still use Prev/Next (which do
announce) to step through deliberately with full narration, exactly as
today. This is a one-line guard at the `announce()` call site, gated on the
`source` parameter now available via `goToStep`.

**No regression to `spec/invariants.test.ts`.** None of the changes in this
plan touch `lang`, `title`, viewport meta, `nav`, `h1` count, or add any
`img` — confirmed by the markup diff in §4 being a single wrapping `div`
around existing content.

---

## 8. Performance budget

- **60fps scrub target.** `ScrollTrigger`'s `scrub: true` mode already
  throttles updates to the browser's own rAF cadence — this plan doesn't add
  a second rAF loop or a manual scroll-position poll on top of it.
- **No forced synchronous layout in the scroll handler.** `stepFromProgress`
  is pure arithmetic on a number ScrollTrigger already computed; the handler
  never calls `getBoundingClientRect()` or reads any layout-dependent
  property itself — all the layout-geometry work (`start`/`end` computation)
  is ScrollTrigger's, done once per resize/refresh, not once per scroll
  event.
- **`will-change` policy.** Apply `will-change: transform` to the pinned
  element only for the duration it's actually pinned (added in
  `ScrollTrigger`'s `onEnter`, removed in `onLeave`/`onLeaveBack`) — never
  left on permanently, since a standing `will-change` on an element that's
  static 95% of the time just reserves a compositor layer for no benefit.
  Phase 6 explicitly checks this got removed correctly, not left dangling.
- **SVG DOM node budget.** The graph itself is unchanged (7 nodes + 11 edges,
  fixed) — this plan adds no new SVG nodes to the pinned path. The only new
  DOM is the `.scroll-track` wrapper div (one element) and, if P1's rail
  ships, up to `totalSteps` (8) small text nodes — negligible next to the
  existing graph.
- **Animate only `transform`/`opacity`/`box-shadow`.** Already stated in §4
  as a hard constraint on the lift-off treatment; `top`/`height`/`margin`
  are never animated on the pinned element (constraint #8).

---

## 9. Risks and rollback

| # | Risk | Abandon trigger | Exact revert |
|---|---|---|---|
| 1 | Pin doesn't fit at 390×844 once actually measured (§3.4's numbers are estimates, not measurements) | Phase 3's manual QA shows the pinned card genuinely doesn't fit under 844px even after the code-block cap and single-row controls | Reduce `--step-vh` / tighten `.code-block` `max-height` further (e.g. `9rem` → `6rem`); if still failing, fall back to *not* pinning at the mobile breakpoint at all (skip creating the mobile `ScrollTrigger.matchMedia` branch in phase 3) — desktop pin ships regardless, mobile keeps today's in-flow behavior. This is a one-branch removal in `ScrollPinController`, not a revert of anything else. |
| 2 | GSAP version in `package.json` gets bumped later and drops/changes `ScrollTrigger`'s free-plugin status | `pnpm install` starts failing to resolve `gsap/ScrollTrigger`, or a future `pnpm update` changes this | Pin `gsap` to the currently-verified `^3.15.0` explicitly in `package.json` rather than a wider range; confirmed already present as `^3.15.0`, so this is a matter of not loosening it further, not an active fix needed now |
| 3 | Scrub fights the Run/autoplay timeline (the self-interrupt bug described in §3.3) | Manual QA (phase 4/6) shows Run stutters, restarts, or visibly fights scroll sync | Revert to a coarser guard: skip the `programmaticScroll` flag's `scrollend`-based clearing and use a fixed timeout (e.g. `500ms`) instead — less precise but eliminates any risk of the flag never clearing if `scrollend` doesn't fire in some engine |
| 4 | A spec test in `spec/assignment-1.test.ts` or `spec/invariants.test.ct` breaks from the markup wrapper | `pnpm check` goes red on `vitest run` after phase 2's markup change | Confirmed unlikely in §2 (no test queries `.visualization`'s parent) — if it happens anyway, the fix folds into phase 2 itself (adjust the wrapper, not the test) before that phase's commit, per the rules of engagement — never land a phase with a red test |
| 5 | Deploy is red at the 15-minute-grace CI sweep before the Monday noon cutoff | Any `pnpm check` step fails on a push close to the deadline, or CI's link/evidence/secrets checks fail | Every phase in §5 is independently shippable and green — if a later phase (7/8/9, P1/P2) isn't done in time, `main` simply stops at the last complete P0 commit, which is a fully working, green, deployed feature on its own. There is no partial/broken phase that needs a hotfix revert — the phase boundaries **are** the rollback points. |

---

## 10. Out of scope

- Any visual/content redesign of the "blueprint/instrument-panel" aesthetic
  itself — this plan works within the existing token system
  (`--blueprint`/`--panel`/`--linework`/etc., `global.css:1-20`), adds no new
  colors.
- Re-running or duplicating `search()` — the pin/scrub layer only ever reads
  `GraphController.totalSteps`/`.currentStep` and calls `goToStep`; it never
  touches `src/lib/dijkstra.ts` or `src/lib/example-graph.ts`.
- A second graph, algorithm, or any multi-algorithm comparison — out of
  scope entirely, that was the already-abandoned second pivot (§0).
  Restructuring `index.astro` beyond the single wrapping `<div>` in §4 —
  explicitly rejected in favor of the smallest-diff option once the numbers
  in §2 showed a full two-column scrollytelling rail wasn't necessary to hit
  the brief's actual ask.
- The P1 per-step rail (`narrateStep` extraction) and P2 progress-tick UI —
  real, designed, and ready to build (§5), but not part of what "done" means
  for this deadline.
- Automated accessibility/performance tooling (axe-core, Lighthouse) — not
  part of this feature; per `CLAUDE.md`, wiring those sensors is separate,
  ongoing work this plan doesn't attempt to fold in.

---

## 11. Assumptions (overrule any of these in one line)

1. **Pin target is the whole `.visualization` block at both viewports**, not
   a split "pin the graph, scroll the code separately" layout — chosen
   because splitting the code panel off would mean it's not visible during
   scrubbing, undermining the site's actual pitch (graph + narration + code
   shown together at every step, per `PROCESS.md`'s own description). If
   this reads as wrong once seen rendered, the fallback is the
   side-scrolling-code-panel layout floated in §2's original brief — bigger
   diff, not attempted here first.
2. **"Pin centred, prose flowing under" over "pin to one side"** — chosen
   because the current DOM/CSS already lays the graph out as the first,
   full-width block with the code panel following it in normal flow; a
   side-by-side pin+rail column would need `main`'s `max-width: 64rem` cap
   revisited and a new grid, which is a bigger diff than the deadline
   affords. Easy to overrule if a side-pin layout is actually wanted.
3. **`--step-vh: 35vh` and `totalSteps = 8` give a `280vh` desktop track** —
   a tunable starting point, not a measured-correct value; adjust by feel
   once it's actually scrollable in a browser (phase 3).
4. **Pressing Run from *above* the section (before it's ever been scrolled
   to) may not auto-scroll the reader down to it in P0**, because
   `goToStep(0, "control")` is a no-op (and so never calls
   `onStepRendered`/`syncScrollToStep`) if `stepIndex` is already `0`. This
   is a real, known gap, called out rather than silently shipped — flagged
   in the phase-6 QA checklist as something to confirm and decide whether it
   needs a P1 fix (e.g., having `run()` unconditionally sync scroll on its
   very first press) rather than something this plan claims to have solved.
5. **No new markup/CSS testid is added to the spec** beyond what's optional
   in §6 — the plan treats "don't break the existing spec" as the bar, not
   "add new spec coverage for the pin mechanic," since jsdom can't exercise
   it anyway (§6).
6. **The `code-block` height caps (`16rem` desktop / `9rem` mobile) are
   starting points derived from arithmetic, not measured against a rendered
   page** — §2's numbers are the reasoning, but the actual visible line
   count at each cap (roughly 8 lines at `16rem`, roughly 4-5 at `9rem`,
   given the 20.48px line height) should be eyeballed in phase 3 to confirm
   enough context is visible around the active line, not just that it fits.
