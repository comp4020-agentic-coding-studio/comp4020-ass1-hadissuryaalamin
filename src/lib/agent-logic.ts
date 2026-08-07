// The core mechanic: given a user prompt, decide whether an LLM would need to
// call a tool to answer it, and which one. This is simulated (rule-based)
// rather than a real model call, since the deployed site is static and
// client-side only — see spec/assignment-1.test.ts for the contract.
//
// Stub only: exists so the spec compiles and its tests fail on behaviour, not
// on a missing module. The actual decision logic is this week's build work.

export type ToolName = "get_schedule" | "get_next" | "add_task";

export type ToolCall = {
  name: ToolName;
  args?: Record<string, unknown>;
};

export type Decision = {
  toolCall: ToolCall | null;
};

export function decideTool(prompt: string): Decision {
  throw new Error(
    `decideTool not implemented yet (prompt: ${JSON.stringify(prompt)}) — see spec/assignment-1.test.ts`,
  );
}
