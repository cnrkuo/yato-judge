import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// `config` reads DATA_DIR once, when it is first imported.
const root = await mkdtemp(join(tmpdir(), 'yato-storage-'));
process.env.DATA_DIR = root;
const { StorageService } = await import('./storage.service.js');

afterAll(() => rm(root, { recursive: true, force: true }));

describe('StorageService.head', () => {
  const storage = new StorageService();
  const data = new TextEncoder().encode('0123456789');

  it('reads only the start of a file', async () => {
    await storage.put('a/file', data);
    expect(new TextDecoder().decode(await storage.head('a/file', 4))).toBe('0123');
  });

  it('returns a shorter file whole', async () => {
    await storage.put('a/short', data);
    expect(await storage.head('a/short', 100)).toEqual(data);
    await storage.put('a/empty', new Uint8Array());
    expect(await storage.head('a/empty', 100)).toEqual(new Uint8Array());
  });

  it('keeps to the data directory', async () => {
    await expect(storage.head('../outside', 4)).rejects.toThrow(/Invalid storage key/);
  });
});
