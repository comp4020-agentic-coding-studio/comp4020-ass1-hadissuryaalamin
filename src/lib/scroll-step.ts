/**
 * Maps a ScrollTrigger `progress` (0..1) onto a step index, with a small
 * hysteresis band around the current step so hovering right at a step
 * boundary doesn't flicker back and forth on scroll jitter.
 */
export function stepFromProgress(
  progress: number,
  totalSteps: number,
  currentStep: number,
  hysteresis = 0.06,
): number {
  const raw = progress * totalSteps;
  const lower = currentStep - 0.5 - hysteresis;
  const upper = currentStep + 0.5 + hysteresis;
  if (raw >= lower && raw <= upper) return currentStep;
  return Math.min(totalSteps, Math.max(0, Math.round(raw)));
}

/** Inverse of stepFromProgress — used to sync scroll position to a button-driven step change. */
export function progressFromStep(step: number, totalSteps: number): number {
  return totalSteps === 0 ? 0 : step / totalSteps;
}
