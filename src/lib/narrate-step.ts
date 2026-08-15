import { START_ID } from "./example-graph.ts";
import type { SearchResult } from "./dijkstra.ts";

/**
 * Renders the caption/announcement text for a given step of a fixed search
 * result — a pure function of (result, stepIndex, totalSteps) so both the
 * live caption (GraphController) and the static per-step rail can derive the
 * same text from the same single source of truth (stepIndex) without a
 * second copy of the narration logic.
 */
export function narrateStep(result: SearchResult, stepIndex: number, totalSteps: number): string {
  if (stepIndex === 0) {
    const remaining = totalSteps - 1;
    return `Ready: g[${START_ID}] = 0. ${remaining} node${remaining === 1 ? "" : "s"} to pop — press Next or Run to begin.`;
  }
  if (stepIndex === totalSteps) {
    return `Finished: reconstructed the path ${result.path.join(" → ")} · total cost ${result.pathLength}.`;
  }

  const step = result.steps[stepIndex - 1];
  const parts = [`Pop ${step.nodeId}: g=${step.g}.`];
  if (step.neighbors.length === 0) {
    parts.push("That's the end — break before expanding.");
  } else {
    for (const neighbor of step.neighbors) {
      if (neighbor.status === "relaxed") {
        parts.push(`Relax ${neighbor.nodeId} to g=${neighbor.tentativeG}.`);
      } else if (neighbor.status === "skipped") {
        parts.push(`Skip ${neighbor.nodeId} — already reached more cheaply.`);
      } else {
        parts.push(`${neighbor.nodeId} already closed.`);
      }
    }
  }
  return parts.join(" ");
}
