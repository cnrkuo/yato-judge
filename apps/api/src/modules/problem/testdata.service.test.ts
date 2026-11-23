import { TESTDATA_PREVIEW_BYTES } from '@yato/contract';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../../common/crypto.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors.js';
import type { StorageService } from '../../storage/storage.service.js';
import { admin, fake, user } from '../../testing/fixtures.js';
import type { ProblemRepository } from './problem.repository.js';
import type { ProblemService } from './problem.service.js';
import { TestdataService } from './testdata.service.js';

const zip = (files: Record<string, string>) =>
  new File([zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])))], 'td.zip');

function setup(previous: { name: string; content: string }[]) {
  const stored = previous.map(({ name, content }) => ({
    name,
    inputSha256: sha256(`${content}-in`),
    outputSha256: sha256(`${content}-out`),
    inputSize: 1,
    outputSize: 1,
  }));
  const written: string[] = [];
  const deleted: string[] = [];
  let replaced: { name: string; ordinal: number }[] = [];
  const service = new TestdataService(
    fake<ProblemService>({ editable: async () => ({}) }),
    fake<ProblemRepository>({
      listTestcases: async () => stored,
      replaceTestcases: async (_id: number, rows: typeof replaced) => {
        replaced = rows;
      },
    }),
    fake<StorageService>({
      put: async (key: string) => void written.push(key),
      delete: async (key: string) => void deleted.push(key),
    }),
  );
  return { service, written, deleted, replaced: () => replaced };
}

describe('TestdataService.upload', () => {
  it('stores the files, merges with existing testcases and deletes orphaned blobs', async () => {
    const { service, written, deleted, replaced } = setup([
      { name: '1', content: 'old1' },
      { name: '2', content: 'old2' },
    ]);
    const result = await service.upload(
      admin,
      5,
      zip({ '2.in': 'new2-in', '2.ans': 'new2-out', '3.in': 'a', '3.ans': 'b' }),
    );

    expect(result).toEqual({ testcases: 3 });
    expect(replaced().map((t) => [t.name, t.ordinal])).toEqual([
      ['1', 0],
      ['2', 1],
      ['3', 2],
    ]);
    expect(written).toHaveLength(4);
    expect(written.every((key) => key.startsWith('problems/5/testdata/'))).toBe(true);
    // Only the replaced testcase "2" leaves blobs behind.
    expect(deleted.sort()).toEqual(
      [sha256('old2-in'), sha256('old2-out')].map((hash) => `problems/5/testdata/${hash}`).sort(),
    );
  });

  it('rejects an archive without testcase pairs', async () => {
    const { service } = setup([]);
    await expect(service.upload(admin, 5, zip({ 'readme.txt': 'hi', '1.in': 'only input' }))).rejects.toThrow(
      BadRequestError,
    );
  });
});

describe('TestdataService preview and file', () => {
  const testcase = {
    id: 40,
    problemId: 5,
    ordinal: 2,
    name: 'big 3',
    inputSha256: 'in-hash',
    outputSha256: 'out-hash',
    inputSize: 200_000,
    outputSize: 3,
  };
  const blobs: Record<string, string> = {
    'problems/5/testdata/in-hash': '7 '.repeat(100_000),
    'problems/5/testdata/out-hash': '42\n',
  };

  function inspect(editable: () => Promise<unknown> = async () => ({})) {
    const heads: [string, number][] = [];
    const service = new TestdataService(
      fake<ProblemService>({ editable }),
      fake<ProblemRepository>({ findTestcase: async (id: number) => (id === testcase.id ? testcase : undefined) }),
      fake<StorageService>({
        head: async (key: string, length: number) => {
          heads.push([key, length]);
          return new TextEncoder().encode(blobs[key]).subarray(0, length);
        },
        get: async (key: string) => Buffer.from(blobs[key] ?? ''),
      }),
    );
    return { service, heads };
  }

  it('previews the start of both files, reading no more than the preview from disk', async () => {
    const { service, heads } = inspect();
    const preview = await service.preview(admin, 5, 40);
    expect(preview.testcase).toEqual({ id: 40, ordinal: 2, name: 'big 3', inputSize: 200_000, outputSize: 3 });
    expect(preview.input).toMatchObject({ truncated: true, binary: false });
    expect(preview.input.text).toHaveLength(TESTDATA_PREVIEW_BYTES);
    expect(preview.output).toEqual({ text: '42\n', truncated: false, binary: false });
    expect(heads.map(([, length]) => length)).toEqual([TESTDATA_PREVIEW_BYTES, TESTDATA_PREVIEW_BYTES]);
  });

  it('downloads a file whole, named as uploaded', async () => {
    const { service } = inspect();
    const input = await service.file(admin, 5, 40, 'input');
    expect(input.name).toBe('big 3.in');
    expect(input.size).toBe(200_000);
    const answer = await service.file(admin, 5, 40, 'output');
    expect(answer.name).toBe('big 3.ans');
    expect(await answer.text()).toBe('42\n');
  });

  it("treats another problem's testcase, or a replaced one, as not found", async () => {
    const { service } = inspect();
    await expect(service.preview(admin, 6, 40)).rejects.toThrow(NotFoundError);
    await expect(service.file(admin, 6, 40, 'input')).rejects.toThrow(NotFoundError);
    await expect(service.preview(admin, 5, 41)).rejects.toThrow(NotFoundError);
  });

  it('is for those who may edit the problem only', async () => {
    const { service, heads } = inspect(async () => {
      throw new ForbiddenError('Administrator permission required');
    });
    await expect(service.preview(user, 5, 40)).rejects.toThrow(ForbiddenError);
    await expect(service.file(user, 5, 40, 'output')).rejects.toThrow(ForbiddenError);
    expect(heads).toEqual([]);
  });
});
