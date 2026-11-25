import { Language } from '@yato/contract';
import { describe, expect, it } from 'vitest';
import { EDITOR_LANGUAGE, languageName, parseLanguage } from './code';

describe('languages', () => {
  it('names a language without its compiler command', () => {
    expect(languageName(Language.CLANG_CPP23)).toBe('Clang C++23');
    expect(languageName(Language.PYTHON3)).toBe('Python 3');
  });

  it('reads a submitted language, defaulting to C++', () => {
    expect(parseLanguage('py3')).toBe(Language.PYTHON3);
    expect(parseLanguage('cobol')).toBe(Language.CPP);
  });

  it('highlights every language with the matching grammar in the editor', () => {
    expect(EDITOR_LANGUAGE).toEqual({
      [Language.C]: 'c',
      [Language.CPP]: 'cpp',
      [Language.CPP23]: 'cpp',
      [Language.CLANG_CPP17]: 'cpp',
      [Language.CLANG_CPP23]: 'cpp',
      [Language.PYTHON3]: 'python',
    });
  });
});
