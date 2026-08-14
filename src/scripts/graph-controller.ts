import { euclidean, search, type GraphEdge, type GraphNode, type SearchResult } from "../lib/graph-search.ts";
import { createOpenGraph, createTrapGraph, edgeId } from "../lib/graphs.ts";
import { PHASE_LINES, type PseudoPhase } from "../lib/pseudocode.ts";

type Mode = "block" | "open" | "start" | "end";
type GraphId = "open" | "trap";
type Hit = { type: "node" | "edge"; id: string };

const MODES: Mode[] = ["block", "open", "start", "end"];

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
 * Owns the graph model (blocked edges + start/end + weight), wires node/edge
 * activation (click/tap/drag/keyboard) to the current mode, and — on Run —
 * computes the search once and exposes it as a manual, step-indexed
 * walkthrough. Every render is a pure function of (result, stepIndex):
 * Prev/Next just move the index and re-derive node costs by replaying
 * steps[0..index) from scratch, so there's no incremental state to get out of
 * sync and no timers to race. Both example graphs are pre-rendered as
 * sibling <svg> elements in the markup; switching graphs toggles which one is
 * `hidden` rather than mutating any DOM structure.
 */
export class GraphController {
  private readonly root: ParentNode;
  private activeGraphId: GraphId = "open";
  private nodes: GraphNode[];
  private edges: GraphEdge[];
  private nodeById: Map<string, GraphNode>;
  private edgeById: Map<string, GraphEdge>;
  private startId: string;
  private endId: string;
  private blockedEdgeIds = new Set<string>();
  private mode: Mode = "block";
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
    const graph = createOpenGraph();
    this.nodes = graph.nodes;
    this.edges = graph.edges;
    this.nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    this.edgeById = new Map(graph.edges.map((e) => [e.id, e]));
    this.startId = graph.start;
    this.endId = graph.end;
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
    this.query<HTMLButtonElement>('[data-testid="clear-blocks-button"]')?.addEventListener("click", () =>
      this.clearBlocks(),
    );
    this.query<HTMLButtonElement>('[data-testid="load-trap-button"]')?.addEventListener("click", () =>
      this.loadTrapGraph(),
    );
    this.query<HTMLButtonElement>('[data-testid="step-prev"]')?.addEventListener("click", () => this.stepPrev());
    this.query<HTMLButtonElement>('[data-testid="step-next"]')?.addEventListener("click", () => this.stepNext());

    const stage = this.query<HTMLElement>('[data-testid="graph-stage"]');
    stage?.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    stage?.addEventListener("pointermove", (event) => this.onPointerMove(event));
    stage?.addEventListener("keydown", (event) => this.onKeyDown(event));
    window.addEventListener("pointerup", () => {
      this.isPainting = false;
      this.lastPainted = null;
    });

    this.updateModeButtons();
    this.updateWeightLabel();
    this.updateGraphButtonLabel();
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

  private updateGraphButtonLabel(): void {
    this.setText(
      '[data-testid="load-trap-button"]',
      this.activeGraphId === "open" ? "Load trap graph" : "Load open graph",
    );
  }

  private hitFromEvent(event: Event): Hit | null {
    const target = event.target as Element | null;
    const nodeGroup = target?.closest<SVGGElement>('[data-testid="graph-node"]');
    if (nodeGroup?.dataset.nodeId) return { type: "node", id: nodeGroup.dataset.nodeId };
    const edgeHit = target?.closest<SVGLineElement>('[data-testid="graph-edge-hit"]');
    if (edgeHit?.dataset.edgeId) return { type: "edge", id: edgeHit.dataset.edgeId };
    return null;
  }

  private onPointerDown(event: Event): void {
    const hit = this.hitFromEvent(event);
    if (!hit) return;
    if (hit.type === "node") {
      this.activateNode(hit.id);
      return;
    }
    this.activateEdge(hit.id);
    if (this.mode === "block" || this.mode === "open") {
      this.isPainting = true;
      this.lastPainted = hit.id;
    }
  }

  private onPointerMove(event: Event): void {
    if (!this.isPainting || (event as PointerEvent).pointerType !== "mouse") return;
    const hit = this.hitFromEvent(event);
    if (!hit || hit.type !== "edge" || hit.id === this.lastPainted) return;
    this.lastPainted = hit.id;
    this.activateEdge(hit.id);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    const hit = this.hitFromEvent(event);
    if (!hit) return;
    event.preventDefault();
    if (hit.type === "node") this.activateNode(hit.id);
    else this.activateEdge(hit.id);
  }

  /** Applies the current mode to a node, then drops any in-progress walkthrough — the graph changed under it. */
  private activateNode(nodeId: string): void {
    switch (this.mode) {
      case "start":
        if (nodeId === this.endId) return;
        this.startId = nodeId;
        break;
      case "end":
        if (nodeId === this.startId) return;
        this.endId = nodeId;
        break;
      default:
        return;
    }
    this.resetVisualization();
  }

  /** Applies the current mode to an edge, then drops any in-progress walkthrough. */
  private activateEdge(id: string): void {
    switch (this.mode) {
      case "block":
        if (this.blockedEdgeIds.has(id)) return;
        this.blockedEdgeIds.add(id);
        break;
      case "open":
        if (!this.blockedEdgeIds.has(id)) return;
        this.blockedEdgeIds.delete(id);
        break;
      default:
        return;
    }
    this.resetVisualization();
  }

  private clearBlocks(): void {
    this.blockedEdgeIds.clear();
    this.resetVisualization();
    this.announce("Blocks cleared.");
  }

  private loadTrapGraph(): void {
    if (this.activeGraphId === "trap") {
      this.setActiveGraph("open");
      this.announce("Open graph loaded.");
    } else {
      this.setActiveGraph("trap");
      this.announce("Trap graph loaded. A weight past 1 gets fooled by the decoy node here.");
    }
  }

  private setActiveGraph(id: GraphId): void {
    const graph = id === "open" ? createOpenGraph() : createTrapGraph();
    this.activeGraphId = id;
    this.nodes = graph.nodes;
    this.edges = graph.edges;
    this.nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    this.edgeById = new Map(graph.edges.map((e) => [e.id, e]));
    this.startId = graph.start;
    this.endId = graph.end;
    this.blockedEdgeIds = new Set();

    for (const svg of this.root.querySelectorAll<SVGSVGElement>('[data-testid="graph"]')) {
      if (svg.dataset.graphId === id) svg.removeAttribute("hidden");
      else svg.setAttribute("hidden", "");
    }
    this.updateGraphButtonLabel();
    this.resetVisualization();
  }

  /** Drops any active/past walkthrough and redraws the graph at its plain baseline (no costs, no run). */
  private resetVisualization(): void {
    this.result = null;
    this.stepIndex = 0;
    this.totalSteps = 0;
    this.historyRecorded = false;
    this.showStepControls(false);
    this.hideResultBanner();
    this.setText('[data-testid="step-caption"]', "");
    this.setPseudoPhase(null);
    this.renderAllNodes();
    this.renderAllEdges();
  }

  private renderAllNodes(): void {
    for (const node of this.nodes) {
      this.renderNode(node.id);
    }
  }

  private renderNode(nodeId: string): void {
    const el = this.nodeEl(nodeId);
    if (!el) return;
    const node = this.nodeById.get(nodeId);
    const isStart = nodeId === this.startId;
    const isEnd = nodeId === this.endId;
    const state = isStart ? "start" : isEnd ? "end" : "empty";
    el.dataset.state = state;
    const costEl = el.querySelector<SVGTextElement>('[data-testid="graph-node-cost"]');
    if (costEl) costEl.textContent = "";
    el.setAttribute("aria-label", `Node ${node?.label ?? nodeId}, ${state}`);
  }

  private renderAllEdges(): void {
    for (const edge of this.edges) {
      this.renderEdge(edge.id);
    }
  }

  private renderEdge(id: string): void {
    const el = this.edgeEl(id);
    if (!el) return;
    const edge = this.edgeById.get(id);
    const blocked = this.blockedEdgeIds.has(id);
    el.dataset.state = blocked ? "blocked" : "open";
    const hitEl = this.edgeHitEl(id);
    if (hitEl && edge) {
      hitEl.setAttribute(
        "aria-label",
        `Edge ${edge.a} to ${edge.b}, weight ${edge.weight}, ${blocked ? "blocked" : "open"}`,
      );
    }
  }

  private runSearch(): void {
    this.resetVisualization();

    const weight = this.currentWeight();
    const result = search(this.nodes, this.edges, this.blockedEdgeIds, this.startId, this.endId, weight);
    const optimalLength = search(this.nodes, this.edges, this.blockedEdgeIds, this.startId, this.endId, 1).pathLength;

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

    const startNode = this.nodeById.get(this.startId);
    const endNode = this.nodeById.get(this.endId);
    if (startNode && endNode) {
      g.set(this.startId, 0);
      f.set(this.startId, this.weightAtRun * euclidean(startNode, endNode));
    }

    const replayCount = Math.min(this.stepIndex, this.result.steps.length);
    for (let i = 0; i < replayCount; i++) {
      const step = this.result.steps[i];
      g.set(step.nodeId, step.g);
      f.set(step.nodeId, step.f);
      popped.add(step.nodeId);
      for (const neighbor of step.neighbors) {
        if (neighbor.status === "relaxed" && neighbor.tentativeG !== null && neighbor.f !== null) {
          g.set(neighbor.nodeId, neighbor.tentativeG);
          f.set(neighbor.nodeId, neighbor.f);
        }
      }
    }
    return { g, f, popped };
  }

  /** The single render pass driven by (result, stepIndex): nodes, edges, pseudocode, controls, result. */
  private renderStep(): void {
    if (!this.result) {
      this.renderAllNodes();
      this.renderAllEdges();
      return;
    }

    const isFinish = this.stepIndex === this.totalSteps;
    const { g, f, popped } = this.computeCostState();
    const pathIds = new Set(isFinish ? this.result.path : []);

    for (const node of this.nodes) {
      const el = this.nodeEl(node.id);
      if (!el) continue;
      const isStart = node.id === this.startId;
      const isEnd = node.id === this.endId;

      let state: string;
      if (isStart) state = "start";
      else if (isEnd) state = "end";
      else if (isFinish && pathIds.has(node.id)) state = "path";
      else if (popped.has(node.id)) state = "visited";
      else if (g.has(node.id)) state = "frontier";
      else state = "empty";
      el.dataset.state = state;

      const gv = g.get(node.id);
      const fv = f.get(node.id);
      const hasCost = gv !== undefined && fv !== undefined;
      const costEl = el.querySelector<SVGTextElement>('[data-testid="graph-node-cost"]');
      if (costEl) costEl.textContent = hasCost ? `${formatCost(gv)}/${formatCost(fv)}` : "";
      el.setAttribute(
        "aria-label",
        hasCost
          ? `Node ${node.label}, ${state}, cost g=${formatCost(gv)} f=${formatCost(fv)}`
          : `Node ${node.label}, ${state}`,
      );
    }

    this.renderAllEdges();
    if (isFinish) {
      for (let i = 0; i < this.result.path.length - 1; i++) {
        const id = edgeId(this.result.path[i], this.result.path[i + 1]);
        const el = this.edgeEl(id);
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
        : `Finished: reconstructed the path — cost ${formatCost(this.result.pathLength)}.`;
    }

    const step = this.result.steps[this.stepIndex - 1];
    const label = (nodeId: string) => this.nodeById.get(nodeId)?.label ?? nodeId;
    const parts = [
      `Pop ${label(step.nodeId)}: g=${formatCost(step.g)}, h=${formatCost(step.h)}, f=${formatCost(step.f)}.`,
    ];
    if (step.neighbors.length === 0) {
      parts.push("That's the end — break before expanding neighbors.");
    } else {
      for (const neighbor of step.neighbors) {
        if (neighbor.status === "relaxed") {
          parts.push(`Relax ${label(neighbor.nodeId)} to g=${formatCost(neighbor.tentativeG!)}.`);
        } else if (neighbor.status === "skipped") {
          parts.push(`Skip ${label(neighbor.nodeId)} — already reached more cheaply.`);
        } else if (neighbor.status === "blocked") {
          parts.push(`Edge to ${label(neighbor.nodeId)} is blocked.`);
        } else {
          parts.push(`${label(neighbor.nodeId)} already closed.`);
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
        `${label} expanded ${result.expandedCount} nodes and never reached the end — this graph blocks it off entirely.`,
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
      `${isOptimal ? "✓" : "⚠"} ${label}: cost ${formatCost(result.pathLength)}, ${result.expandedCount} nodes expanded.`,
    );
    this.setText(
      '[data-testid="result-banner"] [data-role="detail"]',
      isOptimal
        ? "That's the shortest possible path for this graph."
        : `This path costs ${formatCost(result.pathLength)} — the shortest possible is ${formatCost(optimalLength)}. ${label} got fooled.`,
    );
    this.appendHistoryRow(
      weight,
      label,
      formatCost(result.pathLength),
      status,
      isOptimal ? "Yes" : "No",
      result.expandedCount,
    );
    if (banner) banner.hidden = false;
  }

  private setBannerStatus(status: "good" | "warning" | "critical"): void {
    const banner = this.query<HTMLElement>('[data-testid="result-banner"]');
    if (banner) banner.dataset.status = status;
  }

  private appendHistoryRow(
    weight: number,
    algorithm: string,
    pathCost: string,
    status: "good" | "warning" | "critical",
    optimalLabel: string,
    expanded: number,
  ): void {
    const body = this.query<HTMLTableSectionElement>('[data-testid="history-body"]');
    if (!body) return;
    this.historyCount += 1;
    const row = document.createElement("tr");
    for (const text of [weight.toFixed(1), algorithm, pathCost]) {
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

  private activeSvg(): SVGSVGElement | null {
    return this.query<SVGSVGElement>(`[data-testid="graph"][data-graph-id="${this.activeGraphId}"]`);
  }

  private nodeEl(nodeId: string): SVGGElement | null {
    return (
      this.activeSvg()?.querySelector<SVGGElement>(`[data-testid="graph-node"][data-node-id="${nodeId}"]`) ?? null
    );
  }

  private edgeEl(id: string): SVGLineElement | null {
    return this.activeSvg()?.querySelector<SVGLineElement>(`[data-testid="graph-edge"][data-edge-id="${id}"]`) ?? null;
  }

  private edgeHitEl(id: string): SVGLineElement | null {
    return (
      this.activeSvg()?.querySelector<SVGLineElement>(`[data-testid="graph-edge-hit"][data-edge-id="${id}"]`) ?? null
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
    this.setText('[data-testid="graph-status"]', message);
  }

  private query<T extends Element>(selector: string): T | null {
    return this.root.querySelector<T>(selector);
  }
}
