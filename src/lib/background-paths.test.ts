import { describe, expect, it } from "vitest";
import { generateBackgroundPaths } from "./background-paths.ts";

describe("generateBackgroundPaths", () => {
  it.each([1, -1] as const)("generates 14 valid paths for direction %d", (direction) => {
    const paths = generateBackgroundPaths(direction);
    expect(paths.length).toBe(14);
    for (const path of paths) {
      expect(path.d.startsWith("M")).toBe(true);
      expect(path.strokeOpacity).toBeGreaterThan(0);
      expect(path.strokeOpacity).toBeLessThanOrEqual(1);
      expect(path.strokeWidth).toBeGreaterThan(0);
    }
  });

  it("mirrors direction 1 and -1 across the same base curve", () => {
    const forward = generateBackgroundPaths(1);
    const backward = generateBackgroundPaths(-1);
    expect(forward[5].d).not.toEqual(backward[5].d);
    expect(forward[5].strokeOpacity).toBe(backward[5].strokeOpacity);
  });
});
