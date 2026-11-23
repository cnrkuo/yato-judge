import * as fs from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { config } from '../config.js';

/**
 * Blob storage on the local filesystem, rooted at `DATA_DIR`.
 * Keys are relative POSIX paths such as `problems/12/testdata/<sha256>`.
 */
@Injectable()
export class StorageService {
  private readonly root = config.dataDir;

  private pathOf(key: string): string {
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) throw new Error(`Invalid storage key: ${key}`);
    return full;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const path = this.pathOf(key);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, data);
  }

  get(key: string): Promise<Buffer> {
    return fs.readFile(this.pathOf(key));
  }

  /** The first `length` bytes of a file, or all of it when it is shorter; the rest is never read. */
  async head(key: string, length: number): Promise<Uint8Array> {
    const file = await fs.open(this.pathOf(key));
    try {
      const buffer = new Uint8Array(length);
      let filled = 0;
      while (filled < length) {
        const { bytesRead } = await file.read(buffer, filled, length - filled, filled);
        if (bytesRead === 0) break;
        filled += bytesRead;
      }
      return buffer.subarray(0, filled);
    } finally {
      await file.close();
    }
  }

  /** Deletes a file or a whole directory tree; missing keys are ignored. */
  async delete(key: string): Promise<void> {
    await fs.rm(this.pathOf(key), { recursive: true, force: true });
  }

  static testdataDir = (problemId: number) => join('problems', String(problemId), 'testdata');
  static testdataKey = (problemId: number, sha256: string) => join(StorageService.testdataDir(problemId), sha256);
  static attachmentKey = (problemId: number, name: string) => join('problems', String(problemId), 'attachments', name);
}
