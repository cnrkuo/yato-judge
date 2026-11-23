import { Injectable } from '@nestjs/common';
import { TESTDATA_PREVIEW_BYTES } from '@yato/contract';
import type { Actor } from '../../common/actor.js';
import { sha256 } from '../../common/crypto.js';
import { BadRequestError, NotFoundError } from '../../common/errors.js';
import { config } from '../../config.js';
import { StorageService } from '../../storage/storage.service.js';
import { ProblemRepository } from './problem.repository.js';
import { ProblemService } from './problem.service.js';
import { type HashedTestcase, mergeTestcases, orphanedHashes, previewOf } from './testdata.js';

export type TestcaseFileKind = 'input' | 'output';

import { readTestdataArchive, type TestcaseFiles } from './testdata-archive.js';

/**
 * Testdata compresses well (repetitive numbers), so an archive may unpack to
 * this many times the upload limit before it is rejected as a zip bomb.
 */
const MAX_TESTDATA_EXPANSION = 4;

/** A problem's testcases: zip uploads, listing, inspection and removal. Editors only. */
@Injectable()
export class TestdataService {
  constructor(
    private readonly problemService: ProblemService,
    private readonly problems: ProblemRepository,
    private readonly storage: StorageService,
  ) {}

  async list(actor: Actor, problemId: number) {
    await this.problemService.editable(actor, problemId);
    return this.problems.listTestcases(problemId);
  }

  /**
   * Adds the testcases of a zip archive to the problem; returns how many it
   * has afterwards. Blobs are content-addressed, so new files never
   * overwrite ones a judge may still be downloading; blobs nothing refers to
   * any more are removed after the swap.
   */
  async upload(actor: Actor, problemId: number, archive: File): Promise<{ testcases: number }> {
    await this.problemService.editable(actor, problemId);
    const uploaded = readTestdataArchive(
      new Uint8Array(await archive.arrayBuffer()),
      config.maxUploadBytes * MAX_TESTDATA_EXPANSION,
    );
    if (uploaded.length === 0) {
      throw new BadRequestError('No testcases found: the archive must contain <name>.in / <name>.ans pairs');
    }

    const previous = await this.problems.listTestcases(problemId);
    const current = mergeTestcases(previous, await this.storeFiles(problemId, uploaded));
    await this.problems.replaceTestcases(problemId, current);
    await this.deleteBlobs(problemId, orphanedHashes(previous, current));
    return { testcases: current.length };
  }

  async clear(actor: Actor, problemId: number): Promise<void> {
    await this.problemService.editable(actor, problemId);
    await this.problems.replaceTestcases(problemId, []);
    await this.storage.delete(StorageService.testdataDir(problemId));
  }

  /** The start of a testcase's input and expected output; only that much is read from disk. */
  async preview(actor: Actor, problemId: number, testcaseId: number) {
    const testcase = await this.find(actor, problemId, testcaseId);
    const head = (sha256: string, size: number) =>
      this.storage
        .head(StorageService.testdataKey(problemId, sha256), TESTDATA_PREVIEW_BYTES)
        .then((bytes) => previewOf(bytes, size));
    const [input, output] = await Promise.all([
      head(testcase.inputSha256, testcase.inputSize),
      head(testcase.outputSha256, testcase.outputSize),
    ]);
    const { id, ordinal, name, inputSize, outputSize } = testcase;
    return { testcase: { id, ordinal, name, inputSize, outputSize }, input, output };
  }

  /** A testcase file in full, named as it was uploaded: `<name>.in` or `<name>.ans`. */
  async file(actor: Actor, problemId: number, testcaseId: number, kind: TestcaseFileKind): Promise<File> {
    const testcase = await this.find(actor, problemId, testcaseId);
    const hash = kind === 'input' ? testcase.inputSha256 : testcase.outputSha256;
    const data = await this.storage.get(StorageService.testdataKey(problemId, hash));
    return new File([new Uint8Array(data)], `${testcase.name}.${kind === 'input' ? 'in' : 'ans'}`, {
      type: 'application/octet-stream',
    });
  }

  /**
   * A testcase of a problem the actor may edit. One of another problem is
   * "not found", so the problem checked is always the one it belongs to.
   */
  private async find(actor: Actor, problemId: number, testcaseId: number) {
    await this.problemService.editable(actor, problemId);
    const testcase = await this.problems.findTestcase(testcaseId);
    if (testcase?.problemId !== problemId) throw new NotFoundError('Testcase');
    return testcase;
  }

  private async storeFiles(problemId: number, testcases: TestcaseFiles[]): Promise<HashedTestcase[]> {
    const hashed: HashedTestcase[] = [];
    for (const testcase of testcases) {
      const inputSha256 = sha256(testcase.input);
      const outputSha256 = sha256(testcase.output);
      await this.storage.put(StorageService.testdataKey(problemId, inputSha256), testcase.input);
      await this.storage.put(StorageService.testdataKey(problemId, outputSha256), testcase.output);
      hashed.push({ ...testcase, inputSha256, outputSha256 });
    }
    return hashed;
  }

  private async deleteBlobs(problemId: number, hashes: string[]): Promise<void> {
    for (const hash of hashes) await this.storage.delete(StorageService.testdataKey(problemId, hash));
  }
}
