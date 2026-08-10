import { search, type Coord } from "../lib/astar.ts";
import { createEmptyWalls, createTrapMaze, DEFAULT_END, DEFAULT_START, GRID_COLS, GRID_ROWS } from "../lib/mazes.ts";

type Mode = "draw" | "erase" | "start" | "end";

const MODES: Mode[] = ["draw", "erase", "start", "end"];

function coordEq(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
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
 * (click/tap/drag/keyboard) to the current mode, and runs `search()` +
 * a staggered, runId-guarded reveal animation on Run. Any edit to the maze
 * cancels a pending reveal cleanly, same pattern as RoundController.
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
  private runId = 0;
  private timeouts: number[] = [];
  private historyCount = 0;

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
      this.lastPainted = `${coord.row},${coord.col}`;
    }
  }

  private onPointerMove(event: Event): void {
    if (!this.isPainting || (event as PointerEvent).pointerType !== "mouse") return;
    const coord = this.cellFromEvent(event);
    if (!coord) return;
    const key = `${coord.row},${coord.col}`;
    if (key === this.lastPainted) return;
    this.lastPainted = key;
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

  /** Applies the current mode to a cell, then cancels any stale reveal in flight. */
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

    this.cancelPending();
    this.hideResultBanner();
    this.renderAllCells();
  }

  private clearWalls(): void {
    this.walls = createEmptyWalls();
    this.cancelPending();
    this.hideResultBanner();
    this.renderAllCells();
    this.announce("Walls cleared.");
  }

  private loadTrapMaze(): void {
    this.walls = createTrapMaze();
    this.startCoord = { ...DEFAULT_START };
    this.endCoord = { ...DEFAULT_END };
    this.cancelPending();
    this.hideResultBanner();
    this.renderAllCells();
    this.announce("Trap maze loaded. A weight past about 2.6 will find a longer-than-optimal path here.");
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
    el.setAttribute("aria-label", `Row ${coord.row + 1}, column ${coord.col + 1}, ${state}`);
  }

  private runSearch(): void {
    this.cancelPending();
    this.hideResultBanner();
    this.renderAllCells();

    const weight = this.currentWeight();
    const result = search(this.walls, this.startCoord, this.endCoord, weight);
    const optimalLength = search(this.walls, this.startCoord, this.endCoord, 1).pathLength;

    const runId = ++this.runId;
    const reduceMotion = prefersReducedMotion();
    const visitedToShow = result.visitedOrder.filter((c) => !coordEq(c, this.startCoord) && !coordEq(c, this.endCoord));
    const pathToShow = result.path.filter((c) => !coordEq(c, this.startCoord) && !coordEq(c, this.endCoord));
    const visitedDelay = reduceMotion ? 0 : 12;
    const pathDelay = reduceMotion ? 0 : 55;

    this.announce(`Running ${algorithmLabel(weight)} at weight ${weight.toFixed(1)}. Expanding ${result.expandedCount} cells…`);

    visitedToShow.forEach((coord, i) => {
      this.schedule(visitedDelay * i, runId, () => {
        const el = this.cellEl(coord);
        if (el) el.dataset.state = "visited";
      });
    });

    const pathStartDelay = visitedDelay * visitedToShow.length;
    pathToShow.forEach((coord, i) => {
      this.schedule(pathStartDelay + pathDelay * (i + 1), runId, () => {
        const el = this.cellEl(coord);
        if (el) el.dataset.state = "path";
      });
    });

    const finishDelay = pathStartDelay + pathDelay * (pathToShow.length + 1);
    this.schedule(finishDelay, runId, () => {
      this.showResult(weight, result, optimalLength);
    });
  }

  private showResult(weight: number, result: ReturnType<typeof search>, optimalLength: number): void {
    const label = algorithmLabel(weight);
    const banner = this.query<HTMLElement>('[data-testid="result-banner"]');

    if (result.pathLength < 0) {
      this.setText('[data-testid="result-banner"] [data-role="headline"]', "No path found.");
      this.setText(
        '[data-testid="result-banner"] [data-role="detail"]',
        `${label} expanded ${result.expandedCount} cells and never reached the end — this maze blocks it off entirely.`,
      );
      this.appendHistoryRow(weight, label, "—", "—", result.expandedCount);
      this.announce("No path found — the end is unreachable from here.");
      if (banner) banner.hidden = false;
      return;
    }

    const isOptimal = result.pathLength === optimalLength;
    this.setText(
      '[data-testid="result-banner"] [data-role="headline"]',
      `${label}: ${result.pathLength} steps, ${result.expandedCount} cells expanded.`,
    );
    this.setText(
      '[data-testid="result-banner"] [data-role="detail"]',
      isOptimal
        ? "That's the shortest possible path for this maze."
        : `This path is ${result.pathLength} steps — the shortest possible is ${optimalLength}. ${label} got fooled.`,
    );
    this.appendHistoryRow(weight, label, String(result.pathLength), isOptimal ? "Yes" : "No", result.expandedCount);
    this.announce(
      isOptimal
        ? `Path found: ${result.pathLength} steps, optimal.`
        : `Path found: ${result.pathLength} steps, not optimal — the shortest possible is ${optimalLength}.`,
    );
    if (banner) banner.hidden = false;
  }

  private appendHistoryRow(
    weight: number,
    algorithm: string,
    pathLength: string,
    optimal: string,
    expanded: number,
  ): void {
    const body = this.query<HTMLTableSectionElement>('[data-testid="history-body"]');
    if (!body) return;
    this.historyCount += 1;
    const row = document.createElement("tr");
    for (const text of [weight.toFixed(1), algorithm, pathLength, optimal, String(expanded)]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.appendChild(cell);
    }
    body.appendChild(row);
  }

  private hideResultBanner(): void {
    const banner = this.query<HTMLElement>('[data-testid="result-banner"]');
    if (banner) banner.hidden = true;
  }

  private cancelPending(): void {
    this.runId += 1;
    for (const handle of this.timeouts) window.clearTimeout(handle);
    this.timeouts = [];
  }

  private schedule(delayMs: number, runId: number, fn: () => void): void {
    const handle = window.setTimeout(() => {
      if (runId !== this.runId) return;
      fn();
    }, delayMs);
    this.timeouts.push(handle);
  }

  private cellEl(coord: Coord): HTMLElement | null {
    return this.query<HTMLElement>(`[data-testid="grid-cell"][data-row="${coord.row}"][data-col="${coord.col}"]`);
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
