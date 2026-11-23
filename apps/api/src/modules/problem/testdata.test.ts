import { describe, expect, it } from 'vitest';
import { type HashedTestcase, mergeTestcases, orphanedHashes, previewOf, type StoredTestcase } from './testdata.js';

const stored = (name: string, hash: string): StoredTestcase => ({
  name,
  inputSha256: `${hash}-in`,
  outputSha256: `${hash}-out`,
  inputSize: 1,
  outputSize: 1,
});
const uploaded = (name: string, hash: string, size = 3): HashedTestcase => ({
  name,
  input: new Uint8Array(size),
  output: new Uint8Array(size + 1),
  inputSha256: `${hash}-in`,
  outputSha256: `${hash}-out`,
});

describe('mergeTestcases', () => {
  it('adds new names, replaces known ones and keeps the rest', () => {
    const merged = mergeTestcases([stored('1', 'a'), stored('2', 'b')], [uploaded('2', 'c'), uploaded('3', 'd')]);
    expect(merged.map((t) => [t.name, t.inputSha256])).toEqual([
      ['1', 'a-in'],
      ['2', 'c-in'],
      ['3', 'd-in'],
    ]);
    expect(merged[1]).toMatchObject({ inputSize: 3, outputSize: 4 });
  });

  it('numbers testcases in natural order of their names', () => {
    const merged = mergeTestcases([], [uploaded('10', 'x'), uploaded('2', 'y'), uploaded('1', 'z')]);
    expect(merged.map((t) => [t.name, t.ordinal])).toEqual([
      ['1', 0],
      ['2', 1],
      ['10', 2],
    ]);
  });
});

describe('orphanedHashes', () => {
  it('lists blobs only the old set used', () => {
    const previous = [stored('1', 'a'), stored('2', 'b')];
    const current = [stored('1', 'a'), stored('2', 'c')];
    expect(orphanedHashes(previous, current).sort()).toEqual(['b-in', 'b-out']);
  });

  it('keeps a blob that moved to another testcase', () => {
    expect(orphanedHashes([stored('1', 'a')], [stored('2', 'a')])).toEqual([]);
  });
});

describe('previewOf', () => {
  const bytes = (text: string) => new TextEncoder().encode(text);

  it('shows a whole text file as it is', () => {
    expect(previewOf(bytes('1 2\n'), 4)).toEqual({ text: '1 2\n', truncated: false, binary: false });
    expect(previewOf(bytes(''), 0)).toEqual({ text: '', truncated: false, binary: false });
  });

  it('says when the file goes on beyond the preview', () => {
    expect(previewOf(bytes('1 2 3'), 1000)).toEqual({ text: '1 2 3', truncated: true, binary: false });
  });

  it('leaves out a character the preview cut in half, rather than calling the file binary', () => {
    const cut = bytes('ab€').subarray(0, 3); // "ab" and the first byte of "€"
    expect(previewOf(cut, 5)).toEqual({ text: 'ab', truncated: true, binary: false });
  });

  it('keeps line endings and a byte-order mark, which a program reads too', () => {
    expect(previewOf(bytes('\uFEFF1\r\n'), 6).text).toBe('\uFEFF1\r\n');
  });

  it('shows nothing of binary files: NUL bytes or invalid UTF-8', () => {
    expect(previewOf(new Uint8Array([49, 0, 50]), 3)).toEqual({ text: '', truncated: false, binary: true });
    expect(previewOf(new Uint8Array([0xff, 0xfe, 0x41]), 3)).toMatchObject({ binary: true });
  });
});
