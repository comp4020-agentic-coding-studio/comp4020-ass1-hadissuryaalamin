// The core mechanic, and it's deliberately NOT computed. Real hidden-state
// probing needs a real model; this site is static and client-side only, so
// every round's "ground truth" is hand-authored instead of decided at
// runtime. See PLAN.md for why, and for the point of the disagree/agree mix.

export type Round = {
  id: string;
  prompt: string;
  statedReasoning: string;
  /** What the model's own spoken reasoning implies it will do. */
  modelStatedNeedsTool: boolean;
  /** The "ground truth" verdict a hidden-state probe would give. */
  hiddenStateNeedsTool: boolean;
};

export const ROUNDS: Round[] = [
  {
    id: "multiply",
    prompt: "What's 847,293 × 5,023?",
    statedReasoning: "I can just multiply these myself.",
    modelStatedNeedsTool: false,
    hiddenStateNeedsTool: true,
  },
  {
    id: "ww2",
    prompt: "What year did World War II end?",
    statedReasoning: "This is common knowledge, I know it.",
    modelStatedNeedsTool: false,
    hiddenStateNeedsTool: false,
  },
  {
    id: "weather",
    prompt: "What's the weather in Canberra right now?",
    statedReasoning: "I roughly know Canberra's climate.",
    modelStatedNeedsTool: false,
    hiddenStateNeedsTool: true,
  },
  {
    id: "photosynthesis",
    prompt: "Explain photosynthesis in one sentence.",
    statedReasoning: "I know this well.",
    modelStatedNeedsTool: false,
    hiddenStateNeedsTool: false,
  },
  {
    id: "currency",
    prompt: "Convert 2,847 USD to Japanese Yen at today's rate.",
    statedReasoning: "I remember roughly what the rate is.",
    modelStatedNeedsTool: false,
    hiddenStateNeedsTool: true,
  },
  {
    id: "small-sum",
    prompt: "What's 12 + 7?",
    statedReasoning: "Let me use a calculator to be safe.",
    modelStatedNeedsTool: true,
    hiddenStateNeedsTool: false,
  },
  {
    id: "capital",
    prompt: "What's the capital of France?",
    statedReasoning: "I know this.",
    modelStatedNeedsTool: false,
    hiddenStateNeedsTool: false,
  },
  {
    id: "days-between",
    prompt: "How many days between March 3 and October 19 this year?",
    statedReasoning: "I can count this myself.",
    modelStatedNeedsTool: false,
    hiddenStateNeedsTool: true,
  },
];

/** True when the model's stated reasoning matches the hidden-state verdict. */
export function statedReasoningAgrees(round: Round): boolean {
  return round.modelStatedNeedsTool === round.hiddenStateNeedsTool;
}
