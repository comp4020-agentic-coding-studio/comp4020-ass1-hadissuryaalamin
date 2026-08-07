import { ROUNDS, statedReasoningAgrees, type Round } from "../lib/probe-rounds.ts";

const LAYER_SELECTORS = [
  '[data-testid="layer-1"]',
  '[data-testid="layer-2"]',
  '[data-testid="layer-3"]',
  '[data-testid="layer-4"]',
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Drives one round at a time: render the prompt + stated reasoning, take the
 * visitor's guess, stagger-reveal the layer stack and probe verdict, then
 * score the guess and let the visitor advance. Reuses the runId-guarded
 * timeout pattern from the retired PipelineController so a fast double-click
 * or an in-flight reveal never leaves stale timers or mismatched state.
 */
export class RoundController {
  private readonly root: ParentNode;
  private index = 0;
  private attempted = 0;
  private correct = 0;
  private streak = 0;
  private guess: boolean | null = null;
  private runId = 0;
  private timeouts: number[] = [];

  constructor(root: ParentNode) {
    this.root = root;
  }

  start(): void {
    this.query<HTMLButtonElement>('[data-testid="guess-yes"]')?.addEventListener("click", () =>
      this.onGuess(true),
    );
    this.query<HTMLButtonElement>('[data-testid="guess-no"]')?.addEventListener("click", () =>
      this.onGuess(false),
    );
    this.query<HTMLButtonElement>('[data-testid="next-round"]')?.addEventListener("click", () =>
      this.advance(),
    );
    this.query<HTMLButtonElement>('[data-testid="play-again"]')?.addEventListener("click", () =>
      this.restart(),
    );
    this.renderRound();
  }

  private currentRound(): Round {
    return ROUNDS[this.index];
  }

  private renderRound(): void {
    this.cancelPending();
    const round = this.currentRound();

    this.setText('[data-testid="round-counter"]', `Round ${this.index + 1} of ${ROUNDS.length}`);
    this.setText('[data-testid="score"]', `Score: ${this.correct}/${this.attempted} · Streak: ${this.streak}`);
    this.setText('[data-testid="prompt-card"] [data-role="text"]', `“${round.prompt}”`);
    this.setText(
      '[data-testid="stated-reasoning"] [data-role="text"]',
      `“${round.statedReasoning}”`,
    );

    for (const selector of LAYER_SELECTORS) {
      this.setState(selector, "idle");
    }
    this.setState('[data-testid="probe-arrow"]', "idle");
    this.setState('[data-testid="probe-box"]', "idle");
    this.setText('[data-testid="probe-box"] [data-role="verdict"]', "Waiting…");

    const reveal = this.query<HTMLElement>('[data-testid="reveal"]');
    if (reveal) reveal.hidden = true;

    this.setGuessButtonsDisabled(false);
    this.guess = null;
    this.announce(`Round ${this.index + 1}. The model says: ${round.statedReasoning}`);
  }

  private onGuess(guess: boolean): void {
    if (this.guess !== null) return;
    this.guess = guess;
    this.setGuessButtonsDisabled(true);
    this.animateReveal();
  }

  private animateReveal(): void {
    this.runId += 1;
    const runId = this.runId;
    const delay = prefersReducedMotion() ? 60 : 500;
    const round = this.currentRound();

    let step = 0;
    const at = (fn: () => void) => {
      this.schedule(delay * step, runId, fn);
      step += 1;
    };

    for (const selector of LAYER_SELECTORS) {
      at(() => {
        this.setState(selector, "active");
        this.announce("Reading the prompt's activations through the model's layers…");
      });
    }

    at(() => {
      for (const selector of LAYER_SELECTORS) this.setState(selector, "done");
      this.setState('[data-testid="probe-arrow"]', "active");
      this.setState('[data-testid="probe-box"]', "active");
      this.setText('[data-testid="probe-box"] [data-role="verdict"]', "Computing…");
      this.announce("The concatenated hidden state is on its way to the probe.");
    });

    at(() => {
      this.setState('[data-testid="probe-arrow"]', "done");
      this.reveal(round);
    });
  }

  private reveal(round: Round): void {
    this.setState('[data-testid="probe-box"]', "done");
    const verdictText = round.hiddenStateNeedsTool ? "Needs a tool" : "No tool needed";
    this.setText('[data-testid="probe-box"] [data-role="verdict"]', verdictText);

    this.attempted += 1;
    const guessCorrect = this.guess === round.hiddenStateNeedsTool;
    if (guessCorrect) {
      this.correct += 1;
      this.streak += 1;
    } else {
      this.streak = 0;
    }
    this.setText('[data-testid="score"]', `Score: ${this.correct}/${this.attempted} · Streak: ${this.streak}`);

    const agree = statedReasoningAgrees(round);
    this.setText('[data-testid="reveal"] [data-role="verdict-line"]', `Hidden state says: ${verdictText}.`);
    this.setText(
      '[data-testid="reveal"] [data-role="match-line"]',
      guessCorrect ? "Your guess matched. ✅" : "Your guess missed. ❌",
    );
    this.setText(
      '[data-testid="reveal"] [data-role="model-line"]',
      agree
        ? "The model's own stated reasoning agreed with its hidden state."
        : "The model's own stated reasoning was wrong — its hidden state knew better.",
    );

    const reveal = this.query<HTMLElement>('[data-testid="reveal"]');
    if (reveal) reveal.hidden = false;

    this.announce(
      `${verdictText}. ${guessCorrect ? "You matched it." : "You missed it."} ${
        agree ? "The model's stated reasoning agreed." : "The model's stated reasoning was wrong."
      }`,
    );
  }

  private advance(): void {
    this.index += 1;
    if (this.index >= ROUNDS.length) {
      this.showSummary();
      return;
    }
    this.renderRound();
  }

  private showSummary(): void {
    this.cancelPending();
    const game = this.query<HTMLElement>('[data-testid="game"]');
    const summary = this.query<HTMLElement>('[data-testid="summary"]');
    if (game) game.hidden = true;
    if (summary) summary.hidden = false;
    this.setText(
      '[data-testid="summary"] [data-role="summary-text"]',
      `You matched the hidden state on ${this.correct}/${ROUNDS.length}. Stated reasoning isn't always right — that's the whole point.`,
    );
    this.query<HTMLElement>('[data-testid="play-again"]')?.focus();
  }

  private restart(): void {
    this.index = 0;
    this.attempted = 0;
    this.correct = 0;
    this.streak = 0;
    const game = this.query<HTMLElement>('[data-testid="game"]');
    const summary = this.query<HTMLElement>('[data-testid="summary"]');
    if (game) game.hidden = false;
    if (summary) summary.hidden = true;
    this.renderRound();
  }

  private cancelPending(): void {
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

  private setGuessButtonsDisabled(disabled: boolean): void {
    const yes = this.query<HTMLButtonElement>('[data-testid="guess-yes"]');
    const no = this.query<HTMLButtonElement>('[data-testid="guess-no"]');
    if (yes) yes.disabled = disabled;
    if (no) no.disabled = disabled;
  }

  private setText(selector: string, text: string): void {
    const el = this.query<HTMLElement>(selector);
    if (el) el.textContent = text;
  }

  private setState(selector: string, state: string): void {
    const el = this.query<HTMLElement>(selector);
    if (el) el.dataset.state = state;
  }

  private announce(message: string): void {
    this.setText('[data-testid="game-status"]', message);
  }

  private query<T extends Element>(selector: string): T | null {
    return this.root.querySelector<T>(selector);
  }
}
