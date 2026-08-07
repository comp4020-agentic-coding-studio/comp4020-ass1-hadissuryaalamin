// The core mechanic: given a user prompt, decide whether an LLM would need to
// call a tool to answer it, and which one. This is simulated (rule-based)
// rather than a real model call, since the deployed site is static and
// client-side only — see spec/assignment-1.test.ts for the contract.

export type ToolName = "get_schedule" | "get_next" | "add_task";

export type ToolCall = {
  name: ToolName;
  args?: Record<string, unknown>;
};

export type Decision = {
  toolCall: ToolCall | null;
  reason: string;
};

export type ToolResult = {
  summary: string;
  data: unknown;
};

export const TOOL_INFO: Record<ToolName, { label: string; description: string }> = {
  get_schedule: {
    label: "get_schedule",
    description: "Looks up the events already on the calendar for a given day.",
  },
  get_next: {
    label: "get_next",
    description: "Finds the single next upcoming item on the calendar.",
  },
  add_task: {
    label: "add_task",
    description: "Creates a new task or reminder from the described text.",
  },
};

export const EXAMPLE_PROMPTS: string[] = [
  "What is on my schedule tomorrow?",
  "Explain reinforcement learning.",
  "What's the next thing I have coming up?",
  "Remind me to call the dentist.",
];

// Canned data so `executeTool` stays a pure, synchronous function — every bit
// of *timing* belongs in the animation layer, not here.
const SCHEDULE: Record<string, string[]> = {
  today: ["10:00 Standup", "13:00 Lunch with Priya", "16:00 Design review"],
  tomorrow: ["09:30 Dentist", "11:00 COMP4020 crit prep", "15:00 1:1 with mentor"],
};

const NEXT_ITEM = "11:00 COMP4020 crit prep (tomorrow)";

const GENERAL_KNOWLEDGE: Record<string, string> = {
  "reinforcement learning":
    "Reinforcement learning is a way for an agent to learn by trial and error: it takes actions in an environment, gets a reward signal back, and adjusts its behaviour to earn more reward over time — no labelled examples required.",
};

const GENERAL_KNOWLEDGE_FALLBACK =
  "That's a general knowledge question, so the model can answer it directly from what it already knows — no tool call needed.";

function extractDay(prompt: string): "today" | "tomorrow" {
  return /\btomorrow\b/i.test(prompt) ? "tomorrow" : "today";
}

function extractTaskDescription(prompt: string): string {
  const stripped = prompt
    .replace(/^(please\s+)?(add|create)\s+(a\s+)?(task|to-?do)?\s*(to\s+)?/i, "")
    .replace(/^remind me to\s+/i, "")
    .replace(/^book\s+(a\s+)?/i, "")
    .replace(/[.?!]+$/, "")
    .trim();
  return stripped.length > 0 ? stripped : prompt.replace(/[.?!]+$/, "").trim();
}

/**
 * Decides whether a prompt needs a tool call, and which one, using ordered
 * keyword/regex heuristics — a stand-in for what an LLM's own tool-use
 * decision would look like, kept deterministic so the UI is testable.
 */
export function decideTool(prompt: string): Decision {
  const trimmed = prompt.trim();

  if (trimmed.length === 0) {
    return { toolCall: null, reason: "Empty prompt — nothing to decide." };
  }

  if (/\b(add|create|remind me|book|to-?do)\b/i.test(trimmed)) {
    return {
      toolCall: { name: "add_task", args: { description: extractTaskDescription(trimmed) } },
      reason:
        "The prompt asks to create something new, so the model calls add_task instead of guessing at a result.",
    };
  }

  if (/\b(next|upcoming)\b/i.test(trimmed)) {
    return {
      toolCall: { name: "get_next", args: {} },
      reason:
        "The prompt asks for the single next item, which only live calendar data can answer, so the model calls get_next.",
    };
  }

  if (/\b(schedule|calendar|agenda|today|tomorrow|meetings?)\b/i.test(trimmed)) {
    return {
      toolCall: { name: "get_schedule", args: { day: extractDay(trimmed) } },
      reason:
        "The prompt asks about calendar events, which the model doesn't already know, so it calls get_schedule.",
    };
  }

  return {
    toolCall: null,
    reason:
      "The prompt asks a general knowledge question the model can already answer, so no tool call is needed.",
  };
}

/**
 * Runs a decided tool call against canned, synchronous data. Deliberately
 * has no notion of time or async work — see `run()` in pipeline.ts for that.
 */
export function executeTool(toolCall: ToolCall): ToolResult {
  switch (toolCall.name) {
    case "get_schedule": {
      const day = (toolCall.args?.day as string | undefined) === "tomorrow" ? "tomorrow" : "today";
      const items = SCHEDULE[day] ?? [];
      return {
        summary:
          items.length > 0
            ? `${day === "tomorrow" ? "Tomorrow" : "Today"}: ${items.join(", ")}`
            : `Nothing scheduled for ${day}.`,
        data: { day, items },
      };
    }
    case "get_next": {
      return { summary: NEXT_ITEM, data: { next: NEXT_ITEM } };
    }
    case "add_task": {
      const description = (toolCall.args?.description as string | undefined) ?? "task";
      return {
        summary: `Added "${description}" to your task list.`,
        data: { description },
      };
    }
  }
}

/**
 * Formats the last stage's user-facing sentence. Tool-backed answers report
 * what the tool found; everything else falls back to a small canned
 * knowledge table so the final stage is never empty.
 */
export function composeFinalResponse(
  prompt: string,
  decision: Decision,
  toolResult: ToolResult | null,
): string {
  if (decision.toolCall && toolResult) {
    return toolResult.summary;
  }

  const key = Object.keys(GENERAL_KNOWLEDGE).find((k) => prompt.toLowerCase().includes(k));
  return key ? GENERAL_KNOWLEDGE[key] : GENERAL_KNOWLEDGE_FALLBACK;
}
