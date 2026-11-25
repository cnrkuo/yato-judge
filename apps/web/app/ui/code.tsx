import { CODE_MAX_LENGTH, LANGUAGE_LABEL, LANGUAGES, Language, languageName } from '@yato/contract';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { code as css, css as kit } from './classes';
import type { CodeEditor, EditorLanguage } from './code-editor.client';

export { languageName };

export function parseLanguage(value: FormDataEntryValue | null): Language {
  return LANGUAGES.find((language) => language === value) ?? Language.CPP;
}

/**
 * Picks the language of a submission among `languages` (by default every
 * one); `defaultValue` starts selected when it is among them.
 */
export function LanguageSelect({
  languages = LANGUAGES,
  defaultValue = Language.CPP,
}: {
  languages?: readonly Language[];
  defaultValue?: Language;
}) {
  return (
    <select
      className={`${kit.select} ${kit.inputWidth.auto}`}
      name="language"
      defaultValue={languages.includes(defaultValue) ? defaultValue : languages[0]}
      aria-label="Language">
      {languages.map((language) => (
        <option key={language} value={language}>
          {LANGUAGE_LABEL[language]}
        </option>
      ))}
    </select>
  );
}

/** The editor's grammar for each judge language. */
export const EDITOR_LANGUAGE: Record<Language, EditorLanguage> = {
  c: 'c',
  cpp: 'cpp',
  cpp23: 'cpp',
  'clang-cpp17': 'cpp',
  'clang-cpp23': 'cpp',
  py3: 'python',
};

/**
 * Source code for a form, which can also be loaded from a local file.
 *
 * The server renders a plain textarea, which works without JavaScript and
 * while the page loads. In the browser, Monaco (the editor of VS Code) then
 * takes its place, in the same box: the textarea stays where it was, hidden,
 * and receives every change, so the form submits it as before. The editor
 * follows the form's `language` select.
 */
export function CodeInput({
  name = 'code',
  maxLength = CODE_MAX_LENGTH,
  rows = 16,
}: {
  name?: string;
  maxLength?: number;
  rows?: number;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<CodeEditor | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const source = area.current;
    const mount = host.current;
    if (!source || !mount) return;
    const form = source.form;
    const found = form?.elements.namedItem('language');
    const select = found instanceof HTMLSelectElement ? found : null;
    const language = () => EDITOR_LANGUAGE[parseLanguage(select?.value ?? null)];
    const follow = () => editor.current?.setLanguage(language());
    // A hidden textarea cannot say "fill out this field", so an empty
    // submission stops here, and the editor gets the focus instead.
    const refuseEmpty = (event: SubmitEvent) => {
      if (editor.current && source.value === '') {
        event.preventDefault();
        editor.current.focus();
      }
    };

    let cancelled = false;
    import('./code-editor.client')
      .then(({ mountCodeEditor }) => {
        if (cancelled) return;
        editor.current = mountCodeEditor(mount, source, language());
        select?.addEventListener('change', follow);
        form?.addEventListener('submit', refuseEmpty);
        setReady(true);
      })
      .catch(() => {
        // The textarea stays in charge.
      });
    return () => {
      cancelled = true;
      select?.removeEventListener('change', follow);
      form?.removeEventListener('submit', refuseEmpty);
      editor.current?.dispose();
      editor.current = null;
    };
  }, []);

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    if (editor.current) editor.current.replace(text);
    else if (area.current) area.current.value = text;
  };

  return (
    <div>
      <div className={ready ? css.editorReady : css.editor}>
        <textarea
          ref={area}
          className={`${kit.input} ${kit.monoInput}`}
          name={name}
          rows={rows}
          maxLength={maxLength}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Source code"
          placeholder="Paste your source code here"
          required={!ready}
          // Once the editor is there, it is the one to type in.
          aria-hidden={ready || undefined}
          tabIndex={ready ? -1 : undefined}
        />
        <div ref={host} className={css.editorHost} />
      </div>
      <label className={css.fileLink}>
        or load it from a file
        <input type="file" className={kit.srOnly} onChange={loadFile} />
      </label>
    </div>
  );
}

/**
 * Shows code highlighted on the server by `highlight()` (lib/highlight.server).
 * The HTML comes from Shiki, never from the author directly.
 */
export function CodeView({
  html,
  lineNumbers = true,
  scroll = false,
}: {
  html: string;
  lineNumbers?: boolean;
  /** Scroll long content inside a block of limited height. */
  scroll?: boolean;
}) {
  return (
    <div
      className={[css.code, lineNumbers && css.numbered, scroll && css.scroll].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
