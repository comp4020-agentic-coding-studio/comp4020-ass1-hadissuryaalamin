# PLAN.md

## Status

**Under discussion — not yet agreed.** This file currently holds the raw
brief for a new direction. Nothing below is decided; see the conversation
log for the open questions and the eventual agreement. Implementation does
not start until this file says so.

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

## Next step

Discussion in chat: unclear points, assumptions, and gaps, to be resolved
before this file is filled in with an actual plan.
