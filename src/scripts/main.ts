import { PipelineController } from "./pipeline.ts";

const form = document.querySelector<HTMLFormElement>('[data-testid="prompt-form"]');
const input = document.querySelector<HTMLInputElement>('[data-testid="prompt-input"]');
const errorEl = document.querySelector<HTMLElement>("#prompt-error");
const chips = document.querySelectorAll<HTMLButtonElement>("[data-example-prompt]");

if (form && input) {
  const controller = new PipelineController(document);

  const runPrompt = (prompt: string) => {
    const trimmed = prompt.trim();
    if (trimmed.length === 0) {
      input.setAttribute("aria-invalid", "true");
      if (errorEl) errorEl.hidden = false;
      input.focus();
      return;
    }
    input.removeAttribute("aria-invalid");
    if (errorEl) errorEl.hidden = true;
    controller.run(trimmed);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runPrompt(input.value);
  });

  input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") === "true" && input.value.trim().length > 0) {
      input.removeAttribute("aria-invalid");
      if (errorEl) errorEl.hidden = true;
    }
  });

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      const prompt = chip.dataset.examplePrompt ?? "";
      input.value = prompt;
      runPrompt(prompt);
    });
  }
}
