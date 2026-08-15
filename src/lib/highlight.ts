// Thin wrapper around shiki so index.astro's frontmatter doesn't need to know
// the transformer API. Runs at build time only (Astro frontmatter), so the
// highlighter never ships to the client — the page gets plain pre-rendered
// HTML with per-token inline colors baked in.

import { codeToHtml } from "shiki";
import type { CodeLang } from "./code-samples.ts";

const SHIKI_LANG: Record<CodeLang, string> = { python: "python", java: "java" };

export async function highlightCode(source: string, lang: CodeLang): Promise<string> {
  return codeToHtml(source, {
    lang: SHIKI_LANG[lang],
    theme: "dark-plus",
    transformers: [
      {
        pre(node) {
          // Drop shiki's own background so the block sits in .code-panel's card
          // background instead — every per-token color stays untouched.
          node.properties.style = "background-color: transparent";
        },
        line(node, line) {
          node.properties["data-line"] = String(line);
        },
      },
    ],
  });
}
