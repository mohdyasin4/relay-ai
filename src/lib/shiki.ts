import { createHighlighter, type Highlighter } from "shiki";

// Most common languages used in chat messages - preload these
const PRELOAD_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "bash",
  "html",
  "css",
  "jsx",
  "tsx",
  "json",
  "markdown",
  "plaintext",
];

// Themes to preload
const PRELOAD_THEMES = ["vesper", "github-light-high-contrast"];

class ShikiHighlighter {
  private highlighter: Highlighter | null = null;
  private initPromise: Promise<void> | null = null;
  private highlightQueue: Map<string, Promise<string>> = new Map();

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.createHighlighter();
    return this.initPromise;
  }

  private async createHighlighter(): Promise<void> {
    try {
      console.log(
        "[SHIKI] Initializing highlighter with preloaded languages:",
        PRELOAD_LANGUAGES
      );

      this.highlighter = await createHighlighter({
        themes: PRELOAD_THEMES,
        langs: PRELOAD_LANGUAGES,
      });

      console.log("[SHIKI] Highlighter initialized successfully");
    } catch (error) {
      console.error("[SHIKI] Failed to initialize highlighter:", error);
      this.highlighter = null;
    }
  }

  /**
   * Highlight code with language. Theme is automatically resolved from system or app theme.
   */
  async highlight(code: string, language?: string, themeOverride?: string): Promise<string> {
    const theme = themeOverride || this.resolveTheme();

    // Create a cache key
    const cacheKey = `${language}-${theme}-${code.substring(0, 50)}`;

    if (this.highlightQueue.has(cacheKey)) {
      return this.highlightQueue.get(cacheKey)!;
    }

    const highlightPromise = this.doHighlight(code, language, theme);
    this.highlightQueue.set(cacheKey, highlightPromise);

    try {
      return await highlightPromise;
    } finally {
      this.highlightQueue.delete(cacheKey);
    }
  }

  private resolveTheme(): string {
    // Prefer classList on <html> (next-themes / shadcn convention)
    if (typeof document !== "undefined") {
      const root = document.documentElement;

      if (root.classList.contains("dark")) {
        return "vesper";
      }
      if (root.classList.contains("light")) {
        return "github-light-high-contrast";
      }

      // Handle system preference
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "vesper";
      }
    }

    // Fallback
    return "github-light-high-contrast";
  }

  private async doHighlight(
    code: string,
    language: string | undefined,
    theme: string
  ): Promise<string> {
    if (!this.highlighter) {
      await this.init();
    }

    if (!this.highlighter) {
      return `<pre><code>${this.escapeHtml(code)}</code></pre>`;
    }

    try {
      const languageMap: Record<string, string> = {
        js: "javascript",
        ts: "typescript",
        py: "python",
        sh: "bash",
        shell: "bash",
        text: "plaintext",
      };

      const mappedLanguage = language ? (languageMap[language] || language) : "plaintext";

      const loadedLanguages = this.highlighter.getLoadedLanguages();
      if (!loadedLanguages.includes(mappedLanguage as any)) {
        console.log(
          `[SHIKI] Language '${mappedLanguage}' not preloaded, loading dynamically...`
        );
        try {
          await this.highlighter.loadLanguage(mappedLanguage as any);
        } catch (error) {
          console.warn(
            `[SHIKI] Failed to load language '${mappedLanguage}', falling back to plaintext:`,
            error
          );
          return this.highlight(code, "plaintext");
        }
      }

      const html = this.highlighter.codeToHtml(code, {
        lang: mappedLanguage,
        theme,
      });

      return html;
    } catch (error) {
      console.error("[SHIKI] Highlighting failed:", error);
      return `<pre><code>${this.escapeHtml(code)}</code></pre>`;
    }
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

export const shikiHighlighter = new ShikiHighlighter();

// Preload at startup
shikiHighlighter.init().catch(console.error);
