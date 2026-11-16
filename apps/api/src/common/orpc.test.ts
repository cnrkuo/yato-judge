import { ORPCError } from '@orpc/nest';
import { describe, expect, it } from 'vitest';
import { ForbiddenError } from './errors.js';
import { withTypedErrors } from './orpc.js';

describe('withTypedErrors', () => {
  it('passes events through and turns a late domain error into its contract error', async () => {
    async function* events() {
      yield 1;
      throw new ForbiddenError('No longer yours to see');
    }
    const stream = withTypedErrors(events());
    expect((await stream.next()).value).toBe(1);
    const failure = await stream.next().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ORPCError);
    expect(failure).toMatchObject({ code: 'FORBIDDEN', message: 'No longer yours to see' });
  });

  it('leaves other errors alone and closes the source when the reader stops', async () => {
    let closed = false;
    async function* events() {
      try {
        yield 1;
        throw new Error('boom');
      } finally {
        closed = true;
      }
    }
    await expect(withTypedErrors(events()).next()).resolves.toMatchObject({ value: 1 });
    const stream = withTypedErrors(events());
    await stream.next();
    closed = false;
    await stream.return();
    expect(closed).toBe(true);
    const failing = withTypedErrors(events());
    await failing.next();
    await expect(failing.next()).rejects.toThrow('boom');
  });
});
