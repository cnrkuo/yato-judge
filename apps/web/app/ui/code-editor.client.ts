/**
 * Monaco, the editor of VS Code, for `<CodeInput>`. Browser only (React
 * Router never loads `.client` modules on the server), and loaded on
 * demand: pages without a code input never download it.
 *
 * Only the editor itself and the grammars of the judge's languages are
 * bundled: no TypeScript/CSS/HTML/JSON language services, no LSP client.
 */
import * as monaco from 'monaco-editor/editor';
import 'monaco-editor/features/register.all';
import 'monaco-editor/languages/definitions/cpp/register';
import 'monaco-editor/languages/definitions/python/register';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';

// Diffing, links and word suggestions run in a worker, bundled and served
// from this site like everything else.
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

const THEME = 'yato-dark';

/** `rgb(13, 17, 23)` or `rgba(…)` as Monaco wants colours: `#0d1117`. */
function hex(color: string): string | undefined {
  const [r, g, b] = color.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (r === undefined || g === undefined || b === undefined) return undefined;
  return `#${[r, g, b].map((part) => Math.round(part).toString(16).padStart(2, '0')).join('')}`;
}

/** Monaco's dark theme on the site's own colours, as the page's stylesheet sets them. */
function defineTheme(from: HTMLElement): void {
  const style = getComputedStyle(from);
  const root = getComputedStyle(document.documentElement);
  const variable = (name: string) => hex(root.getPropertyValue(name).trim()) ?? '';
  const colors: Record<string, string> = {
    'editor.background': hex(style.backgroundColor) ?? '',
    'editor.foreground': hex(style.color) ?? '',
    'editorLineNumber.foreground': variable('--bs-secondary-color'),
    'editorGutter.background': hex(style.backgroundColor) ?? '',
    'editorWidget.background': variable('--bs-tertiary-bg'),
    'editorWidget.border': variable('--bs-border-color'),
  };
  monaco.editor.defineTheme(THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: Object.fromEntries(Object.entries(colors).filter(([, value]) => value !== '')),
  });
}

/** Monaco's language for a judge language: `c`, `cpp` or `python`. */
export type EditorLanguage = 'c' | 'cpp' | 'python';

export interface CodeEditor {
  /** Replaces the content as one edit, which Undo takes back. */
  replace(text: string): void;
  setLanguage(language: EditorLanguage): void;
  focus(): void;
  dispose(): void;
}

/**
 * Opens an editor in `host`, starting from what `source` holds (typed before
 * the editor loaded, or restored by the browser). `source` keeps receiving
 * every change, so the surrounding form submits it as before.
 */
export function mountCodeEditor(host: HTMLElement, source: HTMLTextAreaElement, language: EditorLanguage): CodeEditor {
  defineTheme(source);
  const style = getComputedStyle(source);
  const lineHeight = Number.parseFloat(style.lineHeight);
  const editor = monaco.editor.create(host, {
    value: source.value,
    language,
    theme: THEME,
    ariaLabel: source.getAttribute('aria-label') ?? 'Source code',
    placeholder: source.placeholder,
    fontFamily: style.fontFamily,
    fontSize: Number.parseFloat(style.fontSize),
    ...(Number.isFinite(lineHeight) ? { lineHeight } : {}),
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    // Let the page scroll on once the editor has reached its top or bottom.
    scrollbar: { alwaysConsumeMouseWheel: false },
    // Suggestions and hovers may reach beyond the editor's box.
    fixedOverflowWidgets: true,
    tabSize: 4,
  });
  const changes = editor.onDidChangeModelContent(() => {
    source.value = editor.getValue();
  });
  // The editor measures characters; web fonts arrive later than it starts.
  void document.fonts?.ready.then(() => monaco.editor.remeasureFonts());

  return {
    replace(text) {
      const model = editor.getModel();
      if (!model) return;
      editor.pushUndoStop();
      editor.executeEdits('load-file', [{ range: model.getFullModelRange(), text }]);
      editor.pushUndoStop();
      editor.setPosition({ lineNumber: 1, column: 1 });
      editor.revealLine(1);
    },
    setLanguage(next) {
      const model = editor.getModel();
      if (model) monaco.editor.setModelLanguage(model, next);
    },
    focus() {
      editor.focus();
    },
    dispose() {
      changes.dispose();
      editor.dispose();
    },
  };
}
