import { describe, expect, it } from 'vitest';
import { downloadDisposition, formatBytes } from './files';

describe('formatBytes', () => {
  it('counts bytes, then KB and MB of 1024', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(64 * 1024)).toBe('64 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB');
  });
});

describe('downloadDisposition', () => {
  it('names a plain file as it is', () => {
    expect(downloadDisposition('big1.in')).toBe(`attachment; filename="big1.in"; filename*=UTF-8''big1.in`);
  });

  it('keeps any name inside the header: quotes, line breaks, non-ASCII', () => {
    const header = downloadDisposition('a "b"\r\nX-Evil: 1;測試.ans');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toMatch(/^attachment; filename="[\w.-]+"; filename\*=UTF-8''[\w.%-]+$/);
    expect(decodeURIComponent(header.split("UTF-8''")[1] ?? '')).toBe('a "b"\r\nX-Evil: 1;測試.ans');
  });

  it('percent-encodes the characters RFC 5987 reserves, like the apostrophe', () => {
    expect(downloadDisposition("it's (1).in")).toContain("filename*=UTF-8''it%27s%20%281%29.in");
  });
});
