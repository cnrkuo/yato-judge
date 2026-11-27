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

/**
 * Any CSS colour (`oklch(…)`, `rgb(…)`, a keyword) as Monaco wants it,
 * `#rrggbb`: the browser paints it on a one-pixel canvas, over the page's
 * background, so it also resolves transparency.
 */
function hex(color: string, under = '#000'): string | undefined {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!context || !color) return undefined;
  context.fillStyle = under;
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

/** Monaco's dark theme on the site's own colours: the theme tokens of app.css. */
function defineTheme(): void {
  const root = getComputedStyle(document.documentElement);
  const token = (name: string) => root.getPropertyValue(name).trim();
  const background = hex(token('--background')) ?? '';
  const colors: Record<string, string> = {
    // The editor's frame has the page's background (see .oj-editor-host).
    'editor.background': background,
    'editorGutter.background': background,
    'editor.foreground': hex(token('--foreground')) ?? '',
    'editorLineNumber.foreground': hex(token('--muted-foreground')) ?? '',
    // Monaco's own placeholder grey is 3 : 1 on this background; muted text is 4.5 : 1 or more.
    'editor.placeholder.foreground': hex(token('--muted-foreground')) ?? '',
    'editorWidget.background': hex(token('--popover')) ?? '',
    'editorWidget.border': hex(token('--border'), background) ?? '',
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
  defineTheme();
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
