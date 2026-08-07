# PLAN.md

## Status

**Draft plan — awaiting sign-off.** The open questions below have been
answered in chat; this is the resulting draft for review. A few small
content details (exact copy, exact numbers) are marked "adjustable" —
everything else needs an explicit yes before implementation starts.

## Brief (Hadi, 2026-08-08)

> The background is "How LLM can decide whether using or not using tools?"
> LLM is only model that generate next token of the input. From this paper
> we can extract hidden layer of the LLM model to being used as classifier.
> So in this interactive I want to show and simulate this. When the user
> type the input prompt we pass it to the model. Show where is the hidden
> state lays in the model.

Referenced paper: Sun, Liu, Yan, Wang, Weng, **"LLM Agents Already Know When
to Call Tools — Even Without Reasoning"** (arXiv:2605.09252).
<https://arxiv.org/abs/2605.09252>

### What the paper actually does (for reference during planning)

- Runs a single forward pass over the prompt (no generation yet) and takes
  the hidden state at the **last input token position**, concatenated
  **across all layers** — not one chosen layer.
- Trains a **linear probe** (L2-regularized logistic regression) on that
  concatenated vector to predict a **binary** label: does this task need a
  tool call at all (not *which* tool).
- The probe reaches **AUROC 0.89–0.96** across six models, and is more
  reliable than the model's own stated/verbalized reasoning about whether it
  needs a tool.
- Built into "Probe&Prefill": if the probe says "no tool needed," a steering
  sentence is prefilled to skip the call. Net effect: **48% fewer tool
  calls, 1.7% accuracy loss**, versus much worse trade-offs from prompting
  or explicit reasoning.

## Decisions (settled in chat)

| Question | Decision |
|---|---|
| Fidelity | Illustrative only — no real model runs, anywhere. Hand-crafted animated diagram. |
| Scope of the decision | Strictly binary: "needs a tool: yes/no." No "which tool" step. |
| Pipeline structure | Full replacement of the old 6-stage pipeline. The site is now entirely: Prompt → Inside the model → Probe verdict. Nothing after the verdict. |
| Game hook | Visitor reads the model's *stated* reasoning first and guesses yes/no from that. Then the hidden-state probe reveals its verdict — sometimes it agrees with the stated reasoning, sometimes it catches the stated reasoning being wrong. That gap **is** the point of the site. |
| Real paper stats | Not cited anywhere. Purely illustrative — no AUROC/48%-style numbers claimed for this toy demo. |
| Accessibility for the diagram | A visual layer-stack animation for sighted users, mirrored by a plain-sentence `aria-live` narration (same pattern already used for the old pipeline's status region). |
| Input mode | Curated set of hand-designed prompts only. No free-text input — the disagreement moments need to be deliberately authored, which isn't possible for arbitrary typed text without silently re-building a rule-based classifier under a new name. |
| Game shape | Fixed-order sequence through all prompts, one per round, with a running score/streak. Ends in a short summary of the visitor's own performance (not the paper's numbers — see above). |
| "Inside the model" visual | A vertical stack of labeled layer boxes; the prompt visibly passes through them top to bottom; a small glowing vector lights up at the last layer and slides sideways into a "Probe" box, which then shows the verdict. |

## Point of view (the one strong idea)

**A model's hidden state already knows whether it needs a tool — even in
the moments where what it says out loud gets it wrong.** The visitor isn't
just told this; they experience it by getting fooled by the model's own
stated reasoning and then watching the hidden-state probe catch it.

## Draft round content (adjustable)

Eight hand-designed rounds, each with a prompt, the model's stated
reasoning (sometimes wrong), and the "ground truth" hidden-state verdict.
Five rounds have the stated reasoning wrong (four under-calling — the model
sounds confident but actually needed a tool — and one over-calling — the
model wants a tool it didn't need), three have it right, so the game isn't
a strawman where the model is always wrong.

| # | Prompt | Model says (stated reasoning) | Hidden state says | Agree? |
|---|---|---|---|---|
| 1 | "What's 847,293 × 5,023?" | "I can just multiply these myself." | Needs a tool | ❌ wrong (under-called) |
| 2 | "What year did World War II end?" | "This is common knowledge, I know it." | No tool needed | ✅ correct |
| 3 | "What's the weather in Canberra right now?" | "I roughly know Canberra's climate." | Needs a tool | ❌ wrong (under-called) |
| 4 | "Explain photosynthesis in one sentence." | "I know this well." | No tool needed | ✅ correct |
| 5 | "Convert 2,847 USD to Japanese Yen at today's rate." | "I remember roughly what the rate is." | Needs a tool | ❌ wrong (under-called) |
| 6 | "What's 12 + 7?" | "Let me use a calculator to be safe." | No tool needed | ❌ wrong (over-called) |
| 7 | "What's the capital of France?" | "I know this." | No tool needed | ✅ correct |
| 8 | "How many days between March 3 and October 19 this year?" | "I can count this myself." | Needs a tool | ❌ wrong (under-called) |

Round order, exact wording, and the 5/3 split are all easy to change —
flag anything that feels off.

## End-of-session summary (adjustable copy)

After round 8: "You matched the hidden state on N/8. Stated reasoning
isn't always right — that's the whole point." No external stats cited, per
the "purely illustrative" decision above.

## Visual/technical sketch

- `src/lib/probe-rounds.ts` (replaces `agent-logic.ts`): the static list of
  8 rounds above as typed data, no logic to "decide" anything — the
  verdicts are authored, not computed.
- `src/scripts/round-controller.ts` (replaces `pipeline.ts`): drives one
  round: show prompt + stated reasoning → visitor guesses → animate the
  layer-stack → reveal probe verdict + whether the visitor's guess matched
  → advance. Same staggered-reveal-via-`runId` pattern as before, since
  that already handles resubmit/interrupt cleanly.
- `src/pages/index.astro`: new markup — round counter, score/streak, the
  prompt + stated-reasoning card, guess buttons, the layer-stack diagram,
  the probe box, the reveal text, `aria-live` narration region, end
  summary. No `<form>`/free-text input this time — guesses are button
  presses.
- `src/styles/global.css`: keep the accessibility primitives already
  built (`.sr-only`, `:focus-visible`, reduced-motion guards) since they're
  need-agnostic; new layer-stack/probe visuals are new work.
- `spec/assignment-1.test.ts`: **will be rewritten**, not preserved. It
  encodes our own translation of the checkable spec lines (deployed, static,
  works at both viewports, a visitor action changes what they see, etc.),
  not a fixed course-provided contract — so it changes to match the new
  mechanic (round counter, guess buttons, verdict reveal) instead of the
  old `stage-*`/`prompt-input` testids.

## Explicitly out of scope

- Any real model inference, real hidden states, or a real trained probe.
- Free-text prompt input.
- "Which tool" selection — the site never names a specific tool, only
  needed/not-needed.
- Citing the paper's actual AUROC/reduction numbers.
- The old 6-stage pipeline, `decideTool`, and the tool-call/result/final-
  response stages — fully retired, not adapted.

## Next step

Review this draft. Once it's agreed, this file gets a final "Agreed" status
and implementation starts.
