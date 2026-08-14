const STORAGE_KEY = "theme-preference";

type Theme = "light" | "dark";

/**
 * Flips `<html data-theme>` between light/dark, persists the explicit choice
 * so it overrides `prefers-color-scheme` on future visits, and keeps the
 * toggle button's label/aria state in sync. The initial theme itself is set
 * by the inline script in Layout.astro's <head> (must run before first
 * paint); this class only handles the interactive flip afterward.
 */
export class ThemeToggle {
  private readonly button: HTMLButtonElement;

  constructor(scope: ParentNode) {
    const el = scope.querySelector<HTMLButtonElement>('[data-testid="theme-toggle"]');
    if (!el) throw new Error("ThemeToggle: missing element [data-testid=\"theme-toggle\"]");
    this.button = el;
  }

  start(): void {
    this.render(this.currentTheme());
    this.button.addEventListener("click", () => this.toggle());
  }

  private currentTheme(): Theme {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  private toggle(): void {
    const next: Theme = this.currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(STORAGE_KEY, next);
    this.render(next);
  }

  private render(theme: Theme): void {
    const isDark = theme === "dark";
    this.button.textContent = isDark ? "☀️ Light" : "🌙 Dark";
    this.button.setAttribute("aria-pressed", String(isDark));
    this.button.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  }
}
