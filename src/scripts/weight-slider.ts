export interface WeightSliderConfig {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  /** Values (e.g. named algorithm settings) the thumb snaps to when dragged close. */
  snapValues: number[];
  snapThreshold: number;
  /** Turns the current value into the accessible name + visible caption text. */
  labelFormatter: (value: number) => string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stepDecimals(step: number): number {
  return step.toString().split(".")[1]?.length ?? 0;
}

/** Collapses float drift from repeated +/- step arithmetic (e.g. 0.1+0.1+0.1). */
function roundToStepPrecision(value: number, step: number): number {
  return Number(value.toFixed(stepDecimals(step)));
}

/**
 * A hand-built track/thumb slider (drag, click-to-jump, keyboard steps,
 * snap-to-marks, double-click reset, and a synced numeric readout) standing
 * in for a native <input type="range">. This project is plain Astro/TS/CSS
 * with no React/Tailwind/shadcn, so unlike a component library "slider"
 * primitive, this is one hand-rolled class wired directly to specific DOM
 * nodes rather than a reusable framework component.
 */
export class WeightSlider {
  private readonly root: HTMLElement;
  private readonly track: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly numberInput: HTMLInputElement;
  private readonly label: HTMLElement | null;
  private value: number;

  constructor(
    scope: ParentNode,
    private readonly config: WeightSliderConfig,
  ) {
    this.root = this.mustFind(scope, '[data-testid="weight-slider"]');
    this.track = this.mustFind(scope, '[data-role="weight-track"]');
    this.fill = this.mustFind(scope, '[data-role="weight-fill"]');
    this.numberInput = this.mustFind<HTMLInputElement>(scope, '[data-testid="weight-value"]');
    this.label = scope.querySelector('[data-testid="weight-label"]');
    this.value = config.defaultValue;
  }

  private mustFind<T extends HTMLElement>(scope: ParentNode, selector: string): T {
    const el = scope.querySelector<T>(selector);
    if (!el) throw new Error(`WeightSlider: missing element ${selector}`);
    return el as T;
  }

  start(): void {
    this.root.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.root.addEventListener("dblclick", () => this.setValue(this.config.defaultValue));
    this.root.addEventListener("keydown", (event) => this.onKeyDown(event));
    this.numberInput.addEventListener("change", () => this.onNumberCommit());
    this.numberInput.addEventListener("keydown", (event) => this.onNumberKeyDown(event));
    this.render();
  }

  getValue(): number {
    return this.value;
  }

  setValue(next: number): void {
    const { min, max, step } = this.config;
    this.value = roundToStepPrecision(clamp(next, min, max), step);
    this.render();
  }

  private render(): void {
    const { min, max, step } = this.config;
    const percentage = ((this.value - min) / (max - min)) * 100;
    this.fill.style.width = `${percentage}%`;
    this.root.style.setProperty("--weight-thumb-position", `${percentage}%`);
    this.root.setAttribute("aria-valuenow", String(this.value));
    const formatted = this.config.labelFormatter(this.value);
    this.root.setAttribute("aria-valuetext", formatted);
    if (this.label) this.label.textContent = formatted;
    if (document.activeElement !== this.numberInput) {
      this.numberInput.value = this.value.toFixed(stepDecimals(step));
    }
  }

  private valueFromClientX(clientX: number): number {
    const rect = this.track.getBoundingClientRect();
    const { min, max, step, snapValues, snapThreshold } = this.config;
    const fraction = clamp(rect.width === 0 ? 0 : (clientX - rect.left) / rect.width, 0, 1);
    const raw = min + fraction * (max - min);

    for (const snapValue of snapValues) {
      if (Math.abs(snapValue - raw) <= snapThreshold) return snapValue;
    }
    return clamp(Math.round(raw / step) * step, min, max);
  }

  private onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.root.focus();
    this.root.setPointerCapture(event.pointerId);
    this.setValue(this.valueFromClientX(event.clientX));

    const onMove = (moveEvent: PointerEvent) => this.setValue(this.valueFromClientX(moveEvent.clientX));
    const onUp = () => {
      this.root.removeEventListener("pointermove", onMove);
    };
    this.root.addEventListener("pointermove", onMove);
    this.root.addEventListener("pointerup", onUp, { once: true });
    this.root.addEventListener("pointercancel", onUp, { once: true });
  }

  private onKeyDown(event: KeyboardEvent): void {
    const { min, max, step } = this.config;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        this.setValue(this.value - step);
        break;
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        this.setValue(this.value + step);
        break;
      case "Home":
        event.preventDefault();
        this.setValue(min);
        break;
      case "End":
        event.preventDefault();
        this.setValue(max);
        break;
    }
  }

  private onNumberCommit(): void {
    const parsed = Number(this.numberInput.value);
    this.setValue(Number.isNaN(parsed) ? this.value : parsed);
  }

  private onNumberKeyDown(event: KeyboardEvent): void {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.setValue(this.value + this.config.step);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      this.setValue(this.value - this.config.step);
    } else if (event.key === "Enter") {
      this.numberInput.blur();
    }
  }
}
