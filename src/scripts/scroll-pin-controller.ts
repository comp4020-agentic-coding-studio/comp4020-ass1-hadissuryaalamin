import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { stepFromProgress } from "../lib/scroll-step.ts";
import type { GraphController } from "./graph-controller.ts";

gsap.registerPlugin(ScrollTrigger);

const LIFT_OFF_CLASS = "lift-off";

/**
 * Lifts the graph panel out of flow and pins it while its scroll track
 * passes through, scrubbing the existing step cursor forward/backward as the
 * user scrolls. GraphController.stepIndex stays the only stored state — this
 * only ever reads ScrollTrigger's own progress and calls graph.goToStep.
 *
 * Registered only under `(prefers-reduced-motion: no-preference)` via
 * matchMedia, so no pin is ever created (and no scroll listener attached) for
 * a reduced-motion user, and the effect un-registers live if the OS setting
 * changes mid-session.
 */
export class ScrollPinController {
  private mm: ReturnType<typeof gsap.matchMedia> | null = null;

  constructor(
    private readonly graph: GraphController,
    private readonly trackEl: HTMLElement,
    private readonly pinEl: HTMLElement,
  ) {}

  start(): void {
    this.trackEl.style.setProperty("--step-count", String(this.graph.totalSteps));

    this.mm = gsap.matchMedia();
    this.mm.add("(prefers-reduced-motion: no-preference)", () => {
      const trigger = ScrollTrigger.create({
        trigger: this.trackEl,
        pin: this.pinEl,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onEnter: () => this.pinEl.classList.add(LIFT_OFF_CLASS),
        onEnterBack: () => this.pinEl.classList.add(LIFT_OFF_CLASS),
        onLeave: () => this.pinEl.classList.remove(LIFT_OFF_CLASS),
        onLeaveBack: () => this.pinEl.classList.remove(LIFT_OFF_CLASS),
        onUpdate: (self) => this.onScrollUpdate(self.progress),
      });

      return () => {
        this.pinEl.classList.remove(LIFT_OFF_CLASS);
        trigger.kill();
      };
    });
  }

  destroy(): void {
    this.mm?.revert();
    this.mm = null;
  }

  private onScrollUpdate(progress: number): void {
    const target = stepFromProgress(progress, this.graph.totalSteps, this.graph.currentStep);
    if (target === this.graph.currentStep) return;
    this.graph.interrupt();
    this.graph.goToStep(target, "scroll");
  }
}
