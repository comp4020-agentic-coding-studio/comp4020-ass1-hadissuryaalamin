import gsap from "gsap";
import { PHASE_LINES, type CodeLang, type CodePhase } from "../lib/code-samples.ts";
import { search, type SearchResult } from "../lib/dijkstra.ts";
import { END_ID, GRAPH_EDGES, GRAPH_NODES, START_ID } from "../lib/example-graph.ts";
import { prefersReducedMotion } from "../lib/motion.ts";
import { narrateStep } from "../lib/narrate-step.ts";

const LANGS: CodeLang[] = ["python", "java"];
const AUTOPLAY_DELAY_MS = 900;

/** Who last moved the step cursor — control (button/Run) announces via aria-live, scroll doesn't (see renderControls). */
export type StepSource = "control" | "scroll";

/** Quick scale-pop for a single node/edge settling into its new state. */
function popNode(el: SVGElement, big: boolean): void {
  gsap.killTweensOf(el);
  gsap.fromTo(
    el,
    { scale: 1 },
    { scale: big ? 1.24 : 1.14, duration: big ? 0.2 : 0.14, ease: "power1.out", yoyo: true, repeat: 1 },
  );
}

/** Staggered pop across the whole reconstructed path, played once on reaching the finish step. */
function popPath(elements: SVGElement[]): void {
  if (!elements.length) return;
  gsap.killTweensOf(elements);
  gsap.fromTo(
    elements,
    { scale: 1 },
    { scale: 1.28, duration: 0.22, ease: "back.out(2.5)", yoyo: true, repeat: 1, stagger: 0.04 },
  );
}

/**
 * Runs Dijkstra once (the graph is fixed, so this never needs to re-run) and
 * exposes it as a manual, step-indexed walkthrough. Every render is a pure
 * function of (result, stepIndex): Prev/Next just move the index and
 * re-derive node/edge state by replaying steps[0..index) from scratch, and
 * Run's autoplay drives the exact same stepNext() the button calls via a
 * self-rescheduling timeout — so there's no incremental state to desync and
 * no timer to race against a manual step.
 */
export class GraphController {
  private readonly root: ParentNode;
  private readonly result: SearchResult;
  readonly totalSteps: number;
  private stepIndex = 0;
  private lastSource: StepSource = "control";
  private lang: CodeLang = "python";
  private autoplayHandle: number | null = null;
  private copyResetHandle: number | null = null;

  /** Invoked at the end of every render caused by goToStep — lets an external scroll/pin layer react without polling. */
  onStepRendered: ((index: number, source: StepSource) => void) | null = null;

  constructor(root: ParentNode) {
    this.root = root;
    this.result = search(GRAPH_NODES, GRAPH_EDGES, START_ID, END_ID);
    this.totalSteps = this.result.steps.length + 1;
  }

  get currentStep(): number {
    return this.stepIndex;
  }

  /**
   * The one write path for stepIndex. Buttons/Run and an external scroll
   * layer both call this — stepIndex stays the single source of truth,
   * scroll is just another caller, not a second state machine.
   */
  goToStep(index: number, source: StepSource = "control"): void {
    const clamped = Math.max(0, Math.min(this.totalSteps, index));
    this.lastSource = source;
    if (clamped === this.stepIndex) return;
    this.stepIndex = clamped;
    this.renderStep();
    this.onStepRendered?.(this.stepIndex, source);
  }

  /** Public alias for stopAutoplay — lets an external scroll layer cancel Run on a genuine manual scroll. */
  interrupt(): void {
    this.stopAutoplay();
  }

  start(): void {
    this.query<HTMLButtonElement>('[data-testid="run-button"]')?.addEventListener("click", () => this.run());
    this.query<HTMLButtonElement>('[data-testid="step-prev"]')?.addEventListener("click", this.onPrevClick);
    this.query<HTMLButtonElement>('[data-testid="step-next"]')?.addEventListener("click", this.onNextClick);
    for (const lang of LANGS) {
      this.query<HTMLButtonElement>(`[data-testid="code-tab-${lang}"]`)?.addEventListener("click", () =>
        this.setLang(lang),
      );
    }
    this.query<HTMLButtonElement>('[data-testid="copy-code-button"]')?.addEventListener("click", () =>
      void this.copyCode(),
    );

    this.buildRail();
    this.buildTicks();
    this.renderStep();
  }

  private run(): void {
    this.stopAutoplay();
    this.goToStep(0, "control");
    this.scheduleAutoplay();
  }

  private scheduleAutoplay(): void {
    if (this.stepIndex >= this.totalSteps) return;
    this.autoplayHandle = window.setTimeout(
      () => {
        this.goToStep(this.stepIndex + 1, "control");
        this.scheduleAutoplay();
      },
      prefersReducedMotion() ? 0 : AUTOPLAY_DELAY_MS,
    );
  }

  private stopAutoplay(): void {
    if (this.autoplayHandle !== null) window.clearTimeout(this.autoplayHandle);
    this.autoplayHandle = null;
  }

  private onPrevClick = (): void => {
    this.stopAutoplay();
    this.stepPrev();
  };

  private onNextClick = (): void => {
    this.stopAutoplay();
    this.stepNext();
  };

  private stepPrev(): void {
    this.goToStep(this.stepIndex - 1, "control");
  }

  private stepNext(): void {
    this.goToStep(this.stepIndex + 1, "control");
  }

  private setLang(lang: CodeLang): void {
    this.lang = lang;
    for (const id of LANGS) {
      this.query<HTMLButtonElement>(`[data-testid="code-tab-${id}"]`)?.setAttribute("aria-pressed", String(id === lang));
      const block = this.query<HTMLElement>(`[data-testid="code-block"][data-lang="${id}"]`);
      if (block) block.hidden = id !== lang;
    }
  }

  private async copyCode(): Promise<void> {
    const block = this.query<HTMLElement>(`[data-testid="code-block"][data-lang="${this.lang}"]`);
    const text = block?.querySelector("pre")?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      this.flashCopyFeedback("Copied!");
      this.announce("Copied source to clipboard.");
    } catch {
      this.flashCopyFeedback("Copy failed");
    }
  }

  private flashCopyFeedback(message: string): void {
    const button = this.query<HTMLButtonElement>('[data-testid="copy-code-button"]');
    if (!button) return;
    if (this.copyResetHandle !== null) window.clearTimeout(this.copyResetHandle);
    button.textContent = message;
    this.copyResetHandle = window.setTimeout(() => {
      button.textContent = "Copy";
      this.copyResetHandle = null;
    }, 1500);
  }

  /** Replays steps[0..stepIndex) to derive which nodes are settled and every discovered node's best-known cost. */
  private computeState(): { knownG: Map<string, number>; popped: Set<string> } {
    const knownG = new Map<string, number>();
    const popped = new Set<string>();
    knownG.set(START_ID, 0);

    const poppedCount = Math.min(this.stepIndex, this.result.steps.length);
    for (let i = 0; i < poppedCount; i++) {
      const step = this.result.steps[i];
      knownG.set(step.nodeId, step.g);
      popped.add(step.nodeId);
      for (const neighbor of step.neighbors) {
        if (neighbor.status === "relaxed") knownG.set(neighbor.nodeId, neighbor.tentativeG);
      }
    }
    return { knownG, popped };
  }

  /** The single render pass driven by (result, stepIndex): nodes, edges, code highlight, controls, result. */
  private renderStep(): void {
    const isFinish = this.stepIndex === this.totalSteps;
    const { knownG, popped } = this.computeState();
    const pathNodeIds = new Set(this.result.path);
    const pathEdgeIds = new Set(this.result.pathEdgeIds);
    const reduceMotion = prefersReducedMotion();
    const finishingEls: SVGElement[] = [];

    for (const node of GRAPH_NODES) {
      const el = this.nodeEl(node.id);
      if (!el) continue;

      let state: string;
      if (isFinish && pathNodeIds.has(node.id)) state = "path";
      else if (popped.has(node.id)) state = "visited";
      else if (knownG.has(node.id)) state = "frontier";
      else state = "idle";

      const previousState = el.dataset.state;
      el.dataset.state = state;
      if (!reduceMotion && previousState !== state) {
        if (state === "path") finishingEls.push(el);
        else popNode(el, state === "visited");
      }

      const gv = knownG.get(node.id);
      el.setAttribute(
        "aria-label",
        gv === undefined ? `Node ${node.label}, ${state}` : `Node ${node.label}, ${state}, known cost ${gv}`,
      );
      const costEl = el.querySelector<SVGTextElement>(".node-cost");
      if (costEl) costEl.textContent = gv === undefined ? "g=∞" : `g=${gv}`;
    }

    for (const edge of GRAPH_EDGES) {
      const el = this.edgeEl(edge.id);
      if (!el) continue;
      const onPath = isFinish && pathEdgeIds.has(edge.id);
      el.dataset.state = onPath ? "path" : "idle";
      el.querySelector("line")?.setAttribute("marker-end", onPath ? "url(#arrow-path)" : "url(#arrow-idle)");
      if (onPath && !reduceMotion) finishingEls.push(el);
    }

    popPath(finishingEls);

    this.renderControls(isFinish);
    this.renderCodeHighlight(isFinish);
    this.renderResult(isFinish);
    this.updateRail();
    this.updateTicks();
  }

  /** One-time build of the desktop step rail — a static summary of every step, not a per-render cost. */
  private buildRail(): void {
    const rail = this.query<HTMLElement>('[data-testid="step-rail"]');
    if (!rail) return;
    for (let i = 0; i <= this.totalSteps; i++) {
      const item = document.createElement("li");
      item.dataset.step = String(i);
      item.textContent = this.railLabel(i);
      rail.appendChild(item);
    }
  }

  /** A short first-clause summary derived from the same narrateStep() text the live caption uses. */
  private railLabel(index: number): string {
    const [firstSentence] = narrateStep(this.result, index, this.totalSteps).split(". ");
    return firstSentence.replace(/\.$/, "");
  }

  private updateRail(): void {
    const rail = this.query<HTMLElement>('[data-testid="step-rail"]');
    rail?.querySelectorAll<HTMLElement>("li").forEach((item) => {
      item.dataset.state = Number(item.dataset.step) === this.stepIndex ? "active" : "idle";
    });
  }

  /** One-time build of the always-visible (both viewports) progress ticks — independent of the desktop-only rail. */
  private buildTicks(): void {
    const ticks = this.query<HTMLElement>('[data-testid="progress-ticks"]');
    if (!ticks) return;
    for (let i = 0; i <= this.totalSteps; i++) {
      const tick = document.createElement("span");
      tick.dataset.step = String(i);
      ticks.appendChild(tick);
    }
  }

  private updateTicks(): void {
    const ticks = this.query<HTMLElement>('[data-testid="progress-ticks"]');
    ticks?.querySelectorAll<HTMLElement>("span").forEach((tick) => {
      const i = Number(tick.dataset.step);
      tick.dataset.state = i === this.stepIndex ? "current" : i < this.stepIndex ? "done" : "upcoming";
    });
  }

  private currentPhase(isFinish: boolean): CodePhase {
    if (this.stepIndex === 0) return "start";
    if (isFinish) return "finish";
    const step = this.result.steps[this.stepIndex - 1];
    return step.neighbors.length === 0 ? "endPop" : "popAndExpand";
  }

  private renderControls(isFinish: boolean): void {
    this.setText('[data-testid="step-counter"]', `Step ${this.stepIndex} of ${this.totalSteps}`);
    const prevButton = this.query<HTMLButtonElement>('[data-testid="step-prev"]');
    const nextButton = this.query<HTMLButtonElement>('[data-testid="step-next"]');
    if (prevButton) prevButton.disabled = this.stepIndex === 0;
    if (nextButton) nextButton.disabled = isFinish;

    const narration = narrateStep(this.result, this.stepIndex, this.totalSteps);
    this.setText('[data-testid="step-caption"]', narration);
    // Scroll-driven steps update the caption but don't spam the live region —
    // a reader scrubbing past many steps by scroll shouldn't get a rapid-fire
    // announcement per step; Prev/Next/Run still announce every time.
    if (this.lastSource === "control") this.announce(narration);
  }

  private renderCodeHighlight(isFinish: boolean): void {
    const phase = this.currentPhase(isFinish);
    const reduceMotion = prefersReducedMotion();

    for (const lang of LANGS) {
      const active = new Set(PHASE_LINES[lang][phase]);
      const block = this.query<HTMLElement>(`[data-testid="code-block"][data-lang="${lang}"]`);
      const pre = block?.querySelector<HTMLElement>("pre") ?? null;
      let firstActiveEl: HTMLElement | null = null;

      block?.querySelectorAll<HTMLElement>(".line").forEach((el) => {
        const lineNumber = Number(el.dataset.line);
        const wasActive = el.dataset.state === "active";
        const isActive = active.has(lineNumber);
        el.dataset.state = isActive ? "active" : "idle";
        if (isActive && !firstActiveEl) firstActiveEl = el;
        if (!reduceMotion && isActive && !wasActive && lang === this.lang) {
          gsap.killTweensOf(el);
          gsap.fromTo(el, { opacity: 0.35 }, { opacity: 1, duration: 0.3, ease: "power1.out" });
        }
      });

      if (lang === this.lang && firstActiveEl) this.scrollLineIntoView(pre, firstActiveEl, !reduceMotion);
    }
  }

  /**
   * Keeps the active line visible inside .code-block pre's own capped-height
   * scroll box (see the height cap in global.css) — scrolls that element's
   * scrollTop directly rather than Element.scrollIntoView(), which would walk
   * up through the page's own scroll position too and could yank the whole
   * page to follow a step change made far from the pinned card.
   */
  private scrollLineIntoView(pre: HTMLElement | null, lineEl: HTMLElement, smooth: boolean): void {
    if (!pre) return;
    const lineTop = lineEl.getBoundingClientRect().top - pre.getBoundingClientRect().top + pre.scrollTop;
    const target = lineTop - pre.clientHeight / 2 + lineEl.clientHeight / 2;
    pre.scrollTo({ top: Math.max(0, target), behavior: smooth ? "smooth" : "auto" });
  }

  private renderResult(isFinish: boolean): void {
    const banner = this.query<HTMLElement>('[data-testid="result-banner"]');
    if (!banner) return;
    if (!isFinish) {
      banner.hidden = true;
      return;
    }
    this.setText(
      '[data-testid="result-banner"] [data-role="headline"]',
      `Shortest path: ${this.result.path.join(" → ")}`,
    );
    this.setText(
      '[data-testid="result-banner"] [data-role="detail"]',
      `Total cost ${this.result.pathLength} · ${this.result.expandedCount} nodes expanded.`,
    );
    banner.hidden = false;
  }

  private nodeEl(nodeId: string): SVGElement | null {
    return this.query<SVGElement>(`[data-testid="graph-node"][data-node-id="${nodeId}"]`);
  }

  private edgeEl(edgeId: string): SVGElement | null {
    return this.query<SVGElement>(`[data-testid="graph-edge"][data-edge-id="${edgeId}"]`);
  }

  private setText(selector: string, text: string): void {
    const el = this.query<HTMLElement>(selector);
    if (el) el.textContent = text;
  }

  private announce(message: string): void {
    this.setText('[data-testid="graph-status"]', message);
  }

  private query<T extends Element>(selector: string): T | null {
    return this.root.querySelector<T>(selector);
  }
}
