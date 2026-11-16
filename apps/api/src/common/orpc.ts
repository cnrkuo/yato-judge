import { Logger } from '@nestjs/common';
import { ORPCError, type ORPCModuleConfig } from '@orpc/nest';
import { DomainError } from './errors.js';

const logger = new Logger('oRPC');

/** Result of procedures that only report success (`OkSchema`). */
export const OK = { ok: true } as const;

const typed = (error: DomainError) => new ORPCError(error.code, { message: error.message });

/**
 * For procedures that stream: an event stream has already answered 200 when
 * something goes wrong halfway, so the interceptor below never sees it.
 * This gives such late {@link DomainError}s the same typed form, as the
 * stream's closing error event.
 */
export async function* withTypedErrors<T>(events: AsyncIterable<T>): AsyncGenerator<T, void, undefined> {
  try {
    yield* events;
  } catch (error) {
    throw error instanceof DomainError ? typed(error) : error;
  }
}

/**
 * Translates service-layer {@link DomainError}s into the typed errors declared
 * in the contract, and logs anything unexpected before it becomes a 500.
 */
export const orpcConfig: ORPCModuleConfig = {
  interceptors: [
    async ({ next }) => {
      try {
        return await next();
      } catch (error) {
        if (error instanceof DomainError) {
          throw typed(error);
        }
        if (!(error instanceof ORPCError)) {
          logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
        }
        throw error;
      }
    },
  ],
};
