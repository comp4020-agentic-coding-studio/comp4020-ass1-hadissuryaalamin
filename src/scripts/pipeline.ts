import { composeFinalResponse, decideTool, executeTool, TOOL_INFO } from "../lib/agent-logic.ts";

type StageId =
  | "stage-prompt"
  | "stage-llm"
  | "stage-decision"
  | "stage-tool-call"
  | "stage-tool-result"
  | "stage-final-response";

type StageState = "idle" | "active" | "done" | "skipped";

const STAGE_ORDER: StageId[] = [
  "stage-prompt",
  "stage-llm",
  "stage-decision",
  "stage-tool-call",
  "stage-tool-result",
  "stage-final-response",
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Drives the six-stage pipeline display. All results (decision, tool
 * result, final response) are computed synchronously up front; only the
 * *reveal* of each stage is staggered over time, guarded by a `runId` token
 * so resubmitting mid-animation cancels the old run cleanly.
 */
export class PipelineController {
  private readonly root: ParentNode;
  private readonly statusEl: HTMLElement | null;
  private runId = 0;
  private timeouts: number[] = [];

  constructor(root: ParentNode) {
    this.root = root;
    this.statusEl = root.querySelector<HTMLElement>('[data-testid="pipeline-status"]');
  }

  reset(): void {
    this.runId += 1;
    for (const handle of this.timeouts) {
      window.clearTimeout(handle);
    }
    this.timeouts = [];
    for (const id of STAGE_ORDER) {
      this.setState(id, "idle", "");
    }
    this.announce("");
  }

  run(prompt: string): void {
    this.reset();
    const runId = this.runId;
    const delay = prefersReducedMotion() ? 60 : 800;

    const decision = decideTool(prompt);
    const toolResult = decision.toolCall ? executeTool(decision.toolCall) : null;
    const finalResponse = composeFinalResponse(prompt, decision, toolResult);
    const escapedPrompt = escapeHtml(prompt);

    let step = 0;
    const at = (fn: () => void) => {
      this.schedule(delay * step, runId, fn);
      step += 1;
    };

    at(() => {
      this.setState("stage-prompt", "active", `<p>&ldquo;${escapedPrompt}&rdquo;</p>`);
      this.announce(`Prompt received: ${prompt}`);
    });

    at(() => {
      this.setState("stage-prompt", "done", `<p>&ldquo;${escapedPrompt}&rdquo;</p>`);
      this.setState("stage-llm", "active", "<p>Reading the prompt&hellip;</p>");
      this.announce("The model is reading your prompt.");
    });

    at(() => {
      this.setState("stage-llm", "done", "<p>Prompt understood.</p>");
      const label = decision.toolCall ? TOOL_INFO[decision.toolCall.name].label : "no tool";
      this.setState(
        "stage-decision",
        "active",
        `<p>${escapeHtml(decision.reason)}</p><p class="decision-outcome">Decision: <strong>${escapeHtml(label)}</strong></p>`,
      );
      this.announce(decision.reason);
    });

    at(() => {
      this.setState("stage-decision", "done", this.contentOf("stage-decision"));
      if (decision.toolCall) {
        const info = TOOL_INFO[decision.toolCall.name];
        const args = escapeHtml(JSON.stringify(decision.toolCall.args ?? {}));
        this.setState(
          "stage-tool-call",
          "active",
          `<p><code>${escapeHtml(info.label)}(${args})</code></p><p>${escapeHtml(info.description)}</p>`,
        );
        this.announce(`Calling tool ${info.label}.`);
      } else {
        this.setState(
          "stage-tool-call",
          "skipped",
          "<p>Skipped &mdash; no tool call needed for this prompt.</p>",
        );
        this.announce("No tool call needed for this prompt.");
      }
    });

    at(() => {
      if (decision.toolCall && toolResult) {
        this.setState("stage-tool-call", "done", this.contentOf("stage-tool-call"));
        this.setState(
          "stage-tool-result",
          "active",
          `<p>${escapeHtml(toolResult.summary)}</p>`,
        );
        this.announce(`Tool returned: ${toolResult.summary}`);
      } else {
        this.setState(
          "stage-tool-result",
          "skipped",
          "<p>Skipped &mdash; there was no tool call to get a result from.</p>",
        );
        this.announce("No tool result, since no tool was called.");
      }
    });

    at(() => {
      if (decision.toolCall && toolResult) {
        this.setState("stage-tool-result", "done", this.contentOf("stage-tool-result"));
      }
      this.setState("stage-final-response", "active", `<p>${escapeHtml(finalResponse)}</p>`);
      this.announce(`Final response: ${finalResponse}`);
    });

    at(() => {
      this.setState("stage-final-response", "done", `<p>${escapeHtml(finalResponse)}</p>`);
      this.announce(`Done. Final response: ${finalResponse}`);
    });
  }

  private schedule(delayMs: number, runId: number, fn: () => void): void {
    const handle = window.setTimeout(() => {
      if (runId !== this.runId) return;
      fn();
    }, delayMs);
    this.timeouts.push(handle);
  }

  private stageEl(id: StageId): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  }

  private contentEl(id: StageId): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(`[data-testid="${id}"] [data-role="content"]`);
  }

  private contentOf(id: StageId): string {
    return this.contentEl(id)?.innerHTML ?? "";
  }

  private setState(id: StageId, state: StageState, html: string): void {
    const el = this.stageEl(id);
    const content = this.contentEl(id);
    if (el) el.dataset.state = state;
    if (content) content.innerHTML = html;
  }

  private announce(message: string): void {
    if (this.statusEl) this.statusEl.textContent = message;
  }
}
