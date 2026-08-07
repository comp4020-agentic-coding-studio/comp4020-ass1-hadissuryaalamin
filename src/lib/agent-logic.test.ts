import { describe, expect, it } from "vitest";
import {
  EXAMPLE_PROMPTS,
  composeFinalResponse,
  decideTool,
  executeTool,
} from "./agent-logic.ts";

describe("decideTool", () => {
  it("calls get_schedule for a schedule question", () => {
    const decision = decideTool("What is on my schedule tomorrow?");
    expect(decision.toolCall?.name).toBe("get_schedule");
    expect(decision.reason.length).toBeGreaterThan(0);
  });

  it("answers directly for a general knowledge question", () => {
    const decision = decideTool("Explain reinforcement learning.");
    expect(decision.toolCall).toBeNull();
  });

  it("calls get_next for an upcoming-item question", () => {
    const decision = decideTool("What's the next thing I have coming up?");
    expect(decision.toolCall?.name).toBe("get_next");
  });

  it("calls add_task for a request to create a reminder", () => {
    const decision = decideTool("Remind me to call the dentist.");
    expect(decision.toolCall?.name).toBe("add_task");
    expect(decision.toolCall?.args?.description).toBe("call the dentist");
  });

  it("makes no tool call for an empty prompt", () => {
    const decision = decideTool("   ");
    expect(decision.toolCall).toBeNull();
  });

  it("covers every example prompt with a real decision", () => {
    for (const prompt of EXAMPLE_PROMPTS) {
      expect(() => decideTool(prompt)).not.toThrow();
    }
  });
});

describe("executeTool", () => {
  it("returns a non-empty summary for each tool", () => {
    const names = ["get_schedule", "get_next", "add_task"] as const;
    for (const name of names) {
      const result = executeTool({ name });
      expect(result.summary.length).toBeGreaterThan(0);
    }
  });
});

describe("composeFinalResponse", () => {
  it("reports the tool result when a tool was called", () => {
    const decision = decideTool("What is on my schedule tomorrow?");
    const toolResult = decision.toolCall ? executeTool(decision.toolCall) : null;
    const response = composeFinalResponse("What is on my schedule tomorrow?", decision, toolResult);
    expect(response).toBe(toolResult?.summary);
  });

  it("answers reinforcement learning directly, with no tool call", () => {
    const prompt = "Explain reinforcement learning.";
    const decision = decideTool(prompt);
    const response = composeFinalResponse(prompt, decision, null);
    expect(response.toLowerCase()).toContain("reinforcement learning");
  });

  it("falls back to a generic sentence for other no-tool prompts", () => {
    const prompt = "What is the meaning of life?";
    const decision = decideTool(prompt);
    const response = composeFinalResponse(prompt, decision, null);
    expect(response.length).toBeGreaterThan(0);
  });
});
