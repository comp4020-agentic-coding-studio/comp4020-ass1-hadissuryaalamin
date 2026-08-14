import { manhattan, search, type Coord, type SearchResult } from "../lib/astar.ts";
import { createEmptyWalls, createTrapMaze, DEFAULT_END, DEFAULT_START, GRID_COLS, GRID_ROWS } from "../lib/mazes.ts";
import { PHASE_LINES, type PseudoPhase } from "../lib/pseudocode.ts";

type Mode = "draw" | "erase" | "start" | "end";
type EdgeDir = "right" | "down";

const MODES: Mode[] = ["draw", "erase", "start", "end"];

function coordEq(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

function key(c: Coord): string {
  return `${c.row},${c.col}`;
}

function formatCost(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Classifies a weight into the algorithm it currently behaves as. */
function algorithmLabel(weight: number): string {
  const rounded = Math.round(weight * 10) / 10;
  if (rounded === 0) return "Dijkstra's algorithm";
  if (rounded === 1) return "A*";
  if (rounded < 1) return "Underweighted A*";
  return "Greedy best-first search";
}

/**
 * Owns the grid model (walls + start/end + weight), wires cell activation
 * (click/tap/drag/keyboard) to the current mode, and — on Run — computes the
 * search once and exposes it as a manual, step-indexed walkthrough. Every
 * render is a pure function of (result, stepIndex): Prev/Next just move the
 * index and re-derive node costs by replaying steps[0..index) from scratch,
 * so there's no incremental state to get out of sync and no timers to race.
 */
export class GridController {
  private readonly root: ParentNode;
  private walls: boolean[][] = createEmptyWalls();
  private startCoord: Coord = { ...DEFAULT_START };
  private endCoord: Coord = { ...DEFAULT_END };
  private mode: Mode = "draw";
  private focused: Coord = { ...DEFAULT_START };
  private isPainting = false;
  private lastPainted: string | null = null;
  private historyCount = 0;

  private result: SearchResult | null = null;
  private stepIndex = 0;
  private totalSteps = 0;
  private historyRecorded = false;
  private weightAtRun = 1;
  private optimalLengthAtRun = -1;

  constructor(root: ParentNode) {
    this.root = root;
  }

  start(): void {
    for (const mode of MODES) {
      this.query<HTMLButtonElement>(`[data-testid="mode-${mode}"]`)?.addEventListener("click", () =>
        this.setMode(mode),
      );
    }
    this.query<HTMLInputElement>('[data-testid="weight-slider"]')?.addEventListener("input", () =>
      this.updateWeightLabel(),
    );
    this.query<HTMLButtonElement>('[data-testid="run-button"]')?.addEventListener("click", () => this.runSearch());
    this.query<HTMLButtonElement>('[data-testid="clear-walls-button"]')?.addEventListener("click", () =>
      this.clearWalls(),
    );
    this.query<HTMLButtonElement>('[data-testid="load-trap-button"]')?.addEventListener("click", () =>
      this.loadTrapMaze(),
    );
    this.query<HTMLButtonElement>('[data-testid="step-prev"]')?.addEventListener("click", () => this.stepPrev());
    this.query<HTMLButtonElement>('[data-testid="step-next"]')?.addEventListener("click", () => this.stepNext());

    const grid = this.query<HTMLElement>('[data-testid="grid"]');
    grid?.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    grid?.addEventListener("pointermove", (event) => this.onPointerMove(event));
    grid?.addEventListener("keydown", (event) => this.onKeyDown(event));
    window.addEventListener("pointerup", () => {
      this.isPainting = false;
      this.lastPainted = null;
    });

    this.updateModeButtons();
    this.updateWeightLabel();
  }

  private currentWeight(): number {
    return this.query<HTMLInputElement>('[data-testid="weight-slider"]')?.valueAsNumber ?? 1;
  }

  private updateWeightLabel(): void {
    const weight = this.currentWeight();
    this.setText('[data-testid="weight-label"]', `${algorithmLabel(weight)} (weight ${weight.toFixed(1)})`);
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.updateModeButtons();
  }

  private updateModeButtons(): void {
    for (const mode of MODES) {
      const button = this.query<HTMLButtonElement>(`[data-testid="mode-${mode}"]`);
      if (button) button.setAttribute("aria-pressed", String(mode === this.mode));
    }
  }

  private cellFromEvent(event: Event): Coord | null {
    const target = event.target as Element | null;
    const cell = target?.closest<HTMLElement>('[data-testid="grid-cell"]');
    if (!cell) return null;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (Number.isNaN(row) || Number.isNaN(col)) return null;
    return { row, col };
  }

  private onPointerDown(event: Event): void {
    const coord = this.cellFromEvent(event);
    if (!coord) return;
    this.moveFocusTo(coord);
    this.activate(coord);
    if (this.mode === "draw" || this.mode === "erase") {
      this.isPainting = true;
      this.lastPainted = key(coord);
    }
  }

  private onPointerMove(event: Event): void {
    if (!this.isPainting || (event as PointerEvent).pointerType !== "mouse") return;
    const coord = this.cellFromEvent(event);
    if (!coord) return;
    const k = key(coord);
    if (k === this.lastPainted) return;
    this.lastPainted = k;
    this.activate(coord);
  }

  private onKeyDown(event: KeyboardEvent): void {
    const deltas: Record<string, Coord> = {
      ArrowUp: { row: -1, col: 0 },
      ArrowDown: { row: 1, col: 0 },
      ArrowLeft: { row: 0, col: -1 },
      ArrowRight: { row: 0, col: 1 },
    };
    const delta = deltas[event.key];
    if (delta) {
      event.preventDefault();
      const next = { row: this.focused.row + delta.row, col: this.focused.col + delta.col };
      if (next.row >= 0 && next.row < GRID_ROWS && next.col >= 0 && next.col < GRID_COLS) {
        this.moveFocusTo(next);
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.activate(this.focused);
    }
  }

  private moveFocusTo(coord: Coord): void {
    this.cellEl(this.focused)?.setAttribute("tabindex", "-1");
    this.focused = coord;
    const el = this.cellEl(coord);
    if (el) {
      el.setAttribute("tabindex", "0");
      el.focus();
    }
  }

  /** Applies the current mode to a cell, then drops any in-progress walkthrough — the maze changed under it. */
  private activate(coord: Coord): void {
    const isStart = coordEq(coord, this.startCoord);
    const isEnd = coordEq(coord, this.endCoord);

    switch (this.mode) {
      case "draw":
        if (isStart || isEnd || this.walls[coord.row][coord.col]) return;
        this.walls[coord.row][coord.col] = true;
        break;
      case "erase":
        if (!this.walls[coord.row][coord.col]) return;
        this.walls[coord.row][coord.col] = false;
        break;
      case "start":
        if (isEnd) return;
        this.startCoord = { ...coord };
        this.walls[coord.row][coord.col] = false;
        break;
      case "end":
        if (isStart) return;
        this.endCoord = { ...coord };
        this.walls[coord.row][coord.col] = false;
        break;
    }

    this.resetVisualization();
  }

  private clearWalls(): void {
    this.walls = createEmptyWalls();
    this.resetVisualization();
    this.announce("Walls cleared.");
  }

  private loadTrapMaze(): void {
    this.walls = createTrapMaze();
    this.startCoord = { ...DEFAULT_START };
    this.endCoord = { ...DEFAULT_END };
    this.resetVisualization();
    this.announce("Trap maze loaded. A weight past about 2.6 will find a longer-than-optimal path here.");
  }

  /** Drops any active/past walkthrough and redraws the grid at its plain baseline (no costs, no run). */
  private resetVisualization(): void {
    this.result = null;
    this.stepIndex = 0;
    this.totalSteps = 0;
    this.historyRecorded = false;
    this.showStepControls(false);
    this.hideResultBanner();
    this.setText('[data-testid="step-caption"]', "");
    this.setPseudoPhase(null);
    this.renderAllCells();
    this.renderAllEdges();
  }

  private renderAllCells(): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        this.renderCell({ row, col });
      }
    }
  }

  private renderCell(coord: Coord): void {
    const el = this.cellEl(coord);
    if (!el) return;
    const isStart = coordEq(coord, this.startCoord);
    const isEnd = coordEq(coord, this.endCoord);
    const state = isStart ? "start" : isEnd ? "end" : this.walls[coord.row][coord.col] ? "wall" : "empty";
    el.dataset.state = state;
    el.textContent = "";
    el.setAttribute("aria-label", `Row ${coord.row + 1}, column ${coord.col + 1}, ${state}`);
  }

  private renderAllEdges(): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (col < GRID_COLS - 1) this.renderEdge(row, col, "right", { row, col: col + 1 });
        if (row < GRID_ROWS - 1) this.renderEdge(row, col, "down", { row: row + 1, col });
      }
    }
  }

  private renderEdge(row: number, col: number, dir: EdgeDir, other: Coord): void {
    const el = this.edgeEl(row, col, dir);
    if (!el) return;
    const closed = this.walls[row][col] || this.walls[other.row][other.col];
    el.dataset.state = closed ? "closed" : "open";
  }

  private runSearch(): void {
    this.resetVisualization();

    const weight = this.currentWeight();
    const result = search(this.walls, this.startCoord, this.endCoord, weight);
    const optimalLength = search(this.walls, this.startCoord, this.endCoord, 1).pathLength;

    this.result = result;
    this.weightAtRun = weight;
    this.optimalLengthAtRun = optimalLength;
    this.stepIndex = 0;
    this.totalSteps = result.steps.length + 1;
    this.historyRecorded = false;
    this.showStepControls(true);
    this.renderStep();
  }

  private stepPrev(): void {
    if (!this.result || this.stepIndex === 0) return;
    this.stepIndex -= 1;
    this.renderStep();
  }

  private stepNext(): void {
    if (!this.result || this.stepIndex === this.totalSteps) return;
    this.stepIndex += 1;
    this.renderStep();
  }

  private showStepControls(show: boolean): void {
    const el = this.query<HTMLElement>('[data-testid="step-controls"]');
    if (el) el.hidden = !show;
  }

  /** Replays steps[0..stepIndex) to derive every node's currently-known g/f and which nodes are settled. */
  private computeCostState(): { g: Map<string, number>; f: Map<string, number>; popped: Set<string> } {
    const g = new Map<string, number>();
    const f = new Map<string, number>();
    const popped = new Set<string>();
    if (!this.result) return { g, f, popped };

    g.set(key(this.startCoord), 0);
    f.set(key(this.startCoord), this.weightAtRun * manhattan(this.startCoord, this.endCoord));

    for (let i = 0; i < this.stepIndex; i++) {
      const step = this.result.steps[i];
      const stepKey = key(step.coord);
      g.set(stepKey, step.g);
      f.set(stepKey, step.f);
      popped.add(stepKey);
      for (const neighbor of step.neighbors) {
        if (neighbor.status === "relaxed" && neighbor.tentativeG !== null && neighbor.f !== null) {
          const neighborKey = key(neighbor.coord);
          g.set(neighborKey, neighbor.tentativeG);
          f.set(neighborKey, neighbor.f);
        }
      }
    }
    return { g, f, popped };
  }

  /** The single render pass driven by (result, stepIndex): nodes, edges, pseudocode, controls, result. */
  private renderStep(): void {
    if (!this.result) {
      this.renderAllCells();
      this.renderAllEdges();
      return;
    }

    const isFinish = this.stepIndex === this.totalSteps;
    const { g, f, popped } = this.computeCostState();
    const pathKeys = new Set(this.result.path.map(key));

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const coord = { row, col };
        const el = this.cellEl(coord);
        if (!el) continue;
        const cellKey = key(coord);
        const isStart = coordEq(coord, this.startCoord);
        const isEnd = coordEq(coord, this.endCoord);
        const isWall = this.walls[row][col];

        let state: string;
        if (isStart) state = "start";
        else if (isEnd) state = "end";
        else if (isWall) state = "wall";
        else if (isFinish && pathKeys.has(cellKey)) state = "path";
        else if (popped.has(cellKey)) state = "visited";
        else if (g.has(cellKey)) state = "frontier";
        else state = "empty";
        el.dataset.state = state;

        const gv = g.get(cellKey);
        const fv = f.get(cellKey);
        const hasCost = !isWall && gv !== undefined && fv !== undefined;
        el.textContent = hasCost ? `${formatCost(gv)}/${formatCost(fv)}` : "";
        el.setAttribute(
          "aria-label",
          hasCost
            ? `Row ${row + 1}, column ${col + 1}, ${state}, cost g=${formatCost(gv)} f=${formatCost(fv)}`
            : `Row ${row + 1}, column ${col + 1}, ${state}`,
        );
      }
    }

    this.renderAllEdges();
    if (isFinish) {
      for (let i = 0; i < this.result.path.length - 1; i++) {
        const a = this.result.path[i];
        const b = this.result.path[i + 1];
        const dir: EdgeDir = a.row === b.row ? "right" : "down";
        const ownerRow = dir === "right" ? a.row : Math.min(a.row, b.row);
        const ownerCol = dir === "right" ? Math.min(a.col, b.col) : a.col;
        const el = this.edgeEl(ownerRow, ownerCol, dir);
        if (el) el.dataset.state = "path";
      }
    }

    this.renderPseudoAndControls(isFinish);
    this.renderResult(isFinish);
  }

  private renderPseudoAndControls(isFinish: boolean): void {
    if (!this.result) return;

    if (this.stepIndex === 0) {
      this.setPseudoPhase("start");
    } else if (isFinish) {
      this.setPseudoPhase("finish");
    } else {
      const step = this.result.steps[this.stepIndex - 1];
      this.setPseudoPhase(step.neighbors.length === 0 ? "loopPop" : "popAndExpand");
    }

    this.setText('[data-testid="step-counter"]', `Step ${this.stepIndex} of ${this.totalSteps}`);
    const prevButton = this.query<HTMLButtonElement>('[data-testid="step-prev"]');
    const nextButton = this.query<HTMLButtonElement>('[data-testid="step-next"]');
    if (prevButton) prevButton.disabled = this.stepIndex === 0;
    if (nextButton) nextButton.disabled = isFinish;

    const narration = this.narrateStep(isFinish);
    this.setText('[data-testid="step-caption"]', narration);
    this.announce(narration);
  }

  private narrateStep(isFinish: boolean): string {
    if (!this.result) return "";
    if (this.stepIndex === 0) {
      return `Ready: g[start] = 0. ${this.totalSteps - 1} node${this.totalSteps - 1 === 1 ? "" : "s"} to expand — click Next to begin.`;
    }
    if (isFinish) {
      return this.result.pathLength < 0
        ? "Finished: the end was never reached — no path exists."
        : `Finished: reconstructed the path — ${this.result.pathLength} steps.`;
    }

    const step = this.result.steps[this.stepIndex - 1];
    const label = (c: Coord) => `(row ${c.row + 1}, col ${c.col + 1})`;
    const parts = [
      `Pop ${label(step.coord)}: g=${formatCost(step.g)}, h=${formatCost(step.h)}, f=${formatCost(step.f)}.`,
    ];
    if (step.neighbors.length === 0) {
      parts.push("That's the end — break before expanding neighbors.");
    } else {
      for (const neighbor of step.neighbors) {
        if (neighbor.status === "relaxed") {
          parts.push(`Relax ${label(neighbor.coord)} to g=${formatCost(neighbor.tentativeG!)}.`);
        } else if (neighbor.status === "skipped") {
          parts.push(`Skip ${label(neighbor.coord)} — already reached more cheaply.`);
        } else if (neighbor.status === "wall") {
          parts.push(`${label(neighbor.coord)} is a wall.`);
        } else {
          parts.push(`${label(neighbor.coord)} already closed.`);
        }
      }
    }
    return parts.join(" ");
  }

  private renderResult(isFinish: boolean): void {
    const banner = this.query<HTMLElement>('[data-testid="result-banner"]');
    if (!isFinish || !this.result) {
      if (banner) banner.hidden = true;
      return;
    }
    if (!this.historyRecorded) {
      this.showResult(this.weightAtRun, this.result, this.optimalLengthAtRun);
      this.historyRecorded = true;
    } else if (banner) {
      banner.hidden = false;
    }
  }

  private showResult(weight: number, result: SearchResult, optimalLength: number): void {
    const label = algorithmLabel(weight);
    const banner = this.query<HTMLElement>('[data-testid="result-banner"]');

    if (result.pathLength < 0) {
      this.setBannerStatus("critical");
      this.setText('[data-testid="result-banner"] [data-role="headline"]', "✕ No path found.");
      this.setText(
        '[data-testid="result-banner"] [data-role="detail"]',
        `${label} expanded ${result.expandedCount} cells and never reached the end — this maze blocks it off entirely.`,
      );
      this.appendHistoryRow(weight, label, "—", "critical", "—", result.expandedCount);
      if (banner) banner.hidden = false;
      return;
    }

    const isOptimal = result.pathLength === optimalLength;
    const status = isOptimal ? "good" : "warning";
    this.setBannerStatus(status);
    this.setText(
      '[data-testid="result-banner"] [data-role="headline"]',
      `${isOptimal ? "✓" : "⚠"} ${label}: ${result.pathLength} steps, ${result.expandedCount} cells expanded.`,
    );
    this.setText(
      '[data-testid="result-banner"] [data-role="detail"]',
      isOptimal
        ? "That's the shortest possible path for this maze."
        : `This path is ${result.pathLength} steps — the shortest possible is ${optimalLength}. ${label} got fooled.`,
    );
    this.appendHistoryRow(weight, label, String(result.pathLength), status, isOptimal ? "Yes" : "No", result.expandedCount);
    if (banner) banner.hidden = false;
  }

  private setBannerStatus(status: "good" | "warning" | "critical"): void {
    const banner = this.query<HTMLElement>('[data-testid="result-banner"]');
    if (banner) banner.dataset.status = status;
  }

  private appendHistoryRow(
    weight: number,
    algorithm: string,
    pathLength: string,
    status: "good" | "warning" | "critical",
    optimalLabel: string,
    expanded: number,
  ): void {
    const body = this.query<HTMLTableSectionElement>('[data-testid="history-body"]');
    if (!body) return;
    this.historyCount += 1;
    const row = document.createElement("tr");
    for (const text of [weight.toFixed(1), algorithm, pathLength]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.appendChild(cell);
    }
    const icon = status === "good" ? "✓" : status === "warning" ? "⚠" : "✕";
    const optimalCell = document.createElement("td");
    optimalCell.dataset.status = status;
    optimalCell.textContent = `${icon} ${optimalLabel}`;
    row.appendChild(optimalCell);
    const expandedCell = document.createElement("td");
    expandedCell.textContent = String(expanded);
    row.appendChild(expandedCell);
    body.appendChild(row);
  }

  private hideResultBanner(): void {
    const banner = this.query<HTMLElement>('[data-testid="result-banner"]');
    if (banner) banner.hidden = true;
  }

  private cellEl(coord: Coord): HTMLElement | null {
    return this.query<HTMLElement>(`[data-testid="grid-cell"][data-row="${coord.row}"][data-col="${coord.col}"]`);
  }

  private edgeEl(row: number, col: number, dir: EdgeDir): HTMLElement | null {
    return this.query<HTMLElement>(
      `[data-testid="grid-edge"][data-row="${row}"][data-col="${col}"][data-dir="${dir}"]`,
    );
  }

  private setPseudoPhase(phase: PseudoPhase | null): void {
    const active = new Set<number>(phase ? PHASE_LINES[phase] : []);
    this.root.querySelectorAll<HTMLElement>('[data-testid="pseudo-line"]').forEach((el) => {
      el.dataset.state = active.has(Number(el.dataset.line)) ? "active" : "idle";
    });
  }

  private setText(selector: string, text: string): void {
    const el = this.query<HTMLElement>(selector);
    if (el) el.textContent = text;
  }

  private announce(message: string): void {
    this.setText('[data-testid="grid-status"]', message);
  }

  private query<T extends Element>(selector: string): T | null {
    return this.root.querySelector<T>(selector);
  }
}
