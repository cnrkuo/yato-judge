import { createHighlighterCore, createJavaScriptRegexEngine } from 'react-shiki/core';

export const shiki_highlighter = await createHighlighterCore({
  themes: [import('@shikijs/themes/vitesse-dark')],
  langs: [
    import('@shikijs/langs/c'),
    import('@shikijs/langs/cpp'),
    import('@shikijs/langs/cpp-macro'),
    import('@shikijs/langs/python'),
  ],
  engine: createJavaScriptRegexEngine(),
});
