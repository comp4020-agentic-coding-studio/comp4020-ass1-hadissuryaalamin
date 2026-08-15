import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { progressFromStep, stepFromProgress } from "../lib/scroll-step.ts";
import type { GraphController, StepSource } from "./graph-controller.ts";

gsap.registerPlugin(ScrollTrigger);

const LIFT_OFF_CLASS = "lift-off";
/** Fallback in case the scrollend event never fires (unsupported browser, or scroll cancelled mid-flight). */
const PROGRAMMATIC_SCROLL_TIMEOUT_MS = 700;

/** Elevation ramp for the pinned card — GSAP-driven (not a CSS transition) so entry/exit can be killed and reversed mid-flight without a snap. */
const LIFT_OFF_DURATION_S = 0.2;
const LIFT_OFF_EASE = "power1.out";
const LIFT_OFF_BOX_SHADOW = "0 1.5rem 3rem -1rem rgb(0 0 0 / 35%)";
const FLAT_BOX_SHADOW = "0 0 0 0 rgb(0 0 0 / 0%)";
const LIFT_OFF_SCALE = 1.01;

/**
 * Lifts the graph panel out of flow and pins it while its scroll track
 * passes through, scrubbing the existing step cursor forward/backward as the
 * user scrolls. GraphController.stepIndex stays the only stored state — this
 * only ever reads ScrollTrigger's own progress and calls graph.goToStep, and
 * a button-driven step change scrolls the page to match via the same
 * progress mapping run in reverse.
 *
 * Registered only under `(prefers-reduced-motion: no-preference)` via
 * matchMedia, so no pin is ever created (and no scroll listener attached) for
 * a reduced-motion user, and the effect un-registers live if the OS setting
 * changes mid-session.
 */
export class ScrollPinController {
  private mm: ReturnType<typeof gsap.matchMedia> | null = null;
  private trigger: ScrollTrigger | null = null;

  /** True while this controller is driving the scroll position itself (see syncScrollToStep) — while true, onScrollUpdate ignores what it sees, since it's an effect of a control-sourced change, not an independent scroll input. */
  private programmaticScroll = false;
  private clearProgrammaticScroll: (() => void) | null = null;

  constructor(
    private readonly graph: GraphController,
    private readonly trackEl: HTMLElement,
    private readonly pinEl: HTMLElement,
  ) {}

  start(): void {
    this.trackEl.style.setProperty("--step-count", String(this.graph.totalSteps));
    this.graph.onStepRendered = (index: number, source: StepSource) => {
      if (source === "control") this.syncScrollToStep(index);
    };

    this.mm = gsap.matchMedia();
    this.mm.add("(prefers-reduced-motion: no-preference)", () => {
      this.trigger = ScrollTrigger.create({
        trigger: this.trackEl,
        pin: this.pinEl,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onEnter: () => this.setLiftOff(true),
        onEnterBack: () => this.setLiftOff(true),
        onLeave: () => this.setLiftOff(false),
        onLeaveBack: () => this.setLiftOff(false),
        onUpdate: (self) => this.onScrollUpdate(self.progress),
      });

      return () => {
        gsap.killTweensOf(this.pinEl);
        gsap.set(this.pinEl, { clearProps: "boxShadow,scale" });
        this.pinEl.classList.remove(LIFT_OFF_CLASS);
        this.trigger?.kill();
        this.trigger = null;
        this.clearProgrammaticScroll?.();
      };
    });
  }

  destroy(): void {
    this.clearProgrammaticScroll?.();
    this.mm?.revert();
    this.mm = null;
    this.graph.onStepRendered = null;
  }

  /** Ramps the pinned card's elevation in/out via a GSAP tween (not a CSS transition) so it can be killed and reversed mid-flight if the reader scrolls back before it settles. */
  private setLiftOff(engaged: boolean): void {
    this.pinEl.classList.toggle(LIFT_OFF_CLASS, engaged);
    gsap.killTweensOf(this.pinEl);
    gsap.to(this.pinEl, {
      boxShadow: engaged ? LIFT_OFF_BOX_SHADOW : FLAT_BOX_SHADOW,
      scale: engaged ? LIFT_OFF_SCALE : 1,
      duration: LIFT_OFF_DURATION_S,
      ease: LIFT_OFF_EASE,
    });
  }

  private onScrollUpdate(progress: number): void {
    if (this.programmaticScroll) return;
    const target = stepFromProgress(progress, this.graph.totalSteps, this.graph.currentStep);
    if (target === this.graph.currentStep) return;
    this.graph.interrupt();
    this.graph.goToStep(target, "scroll");
  }

  /** Scrolls the page to the position a button/Run-driven step change corresponds to — the inverse of onScrollUpdate. */
  private syncScrollToStep(index: number): void {
    if (!this.trigger) return;
    const progress = progressFromStep(index, this.graph.totalSteps);
    const targetY = this.trigger.start + progress * (this.trigger.end - this.trigger.start);
    if (Math.abs(targetY - window.scrollY) < 1) return;

    this.clearProgrammaticScroll?.();
    this.programmaticScroll = true;
    window.scrollTo({ top: targetY, behavior: "smooth" });

    const onScrollEnd = (): void => this.clearProgrammaticScroll?.();
    const timeoutHandle = window.setTimeout(onScrollEnd, PROGRAMMATIC_SCROLL_TIMEOUT_MS);
    this.clearProgrammaticScroll = () => {
      window.clearTimeout(timeoutHandle);
      window.removeEventListener("scrollend", onScrollEnd);
      this.programmaticScroll = false;
      this.clearProgrammaticScroll = null;
    };
    window.addEventListener("scrollend", onScrollEnd, { once: true });
  }
}
