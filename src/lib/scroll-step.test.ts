import { describe, expect, it } from "vitest";
import { progressFromStep, stepFromProgress } from "./scroll-step.ts";

describe("scroll-step: progress <-> step mapping", () => {
  it("maps the very start of the track to step 0", () => {
    expect(stepFromProgress(0, 8, 0)).toBe(0);
  });

  it("maps the very end of the track to the last step", () => {
    expect(stepFromProgress(1, 8, 8)).toBe(8);
  });

  it("holds the current step when progress lands cleanly mid-step", () => {
    expect(stepFromProgress(0.5, 8, 4)).toBe(4);
  });

  it("advances once progress clears the hysteresis band past a boundary", () => {
    // raw = 0.26 * 8 = 2.08, well outside the hold band around currentStep=1
    expect(stepFromProgress(0.26, 8, 1)).toBe(2);
  });

  it("holds at the boundary itself instead of flipping on exact half-steps", () => {
    // raw = 0.1875 * 8 = 1.5, exactly the boundary between steps 1 and 2
    expect(stepFromProgress(0.1875, 8, 1)).toBe(1);
  });

  it("moves backward symmetrically when scrubbing in reverse", () => {
    expect(stepFromProgress(0.26, 8, 3)).toBe(2);
  });

  it("clamps below the track start", () => {
    expect(stepFromProgress(-0.1, 8, 0)).toBe(0);
  });

  it("clamps past the track end", () => {
    expect(stepFromProgress(1.3, 8, 8)).toBe(8);
  });

  it("progressFromStep is the inverse of stepFromProgress at step midpoints", () => {
    expect(progressFromStep(4, 8)).toBe(0.5);
  });

  it("progressFromStep is guarded against a zero-step graph", () => {
    expect(progressFromStep(0, 0)).toBe(0);
  });
});
