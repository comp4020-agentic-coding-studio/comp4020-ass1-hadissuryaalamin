import { describe, expect, it } from "vitest";
import { CODE_SOURCE, PHASE_LINES, type CodeLang } from "./code-samples.ts";

const LANGS: CodeLang[] = ["python", "java"];

describe("code-samples: phase line maps stay in sync with the source text", () => {
  it.each(LANGS)("%s: every highlighted line number is within the source's line count", (lang) => {
    const lineCount = CODE_SOURCE[lang].split("\n").length;
    for (const lines of Object.values(PHASE_LINES[lang])) {
      for (const line of lines) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it.each(LANGS)("%s: no phase highlights a blank line", (lang) => {
    const sourceLines = CODE_SOURCE[lang].split("\n");
    for (const lines of Object.values(PHASE_LINES[lang])) {
      for (const line of lines) {
        expect(sourceLines[line - 1].trim()).not.toBe("");
      }
    }
  });
});
