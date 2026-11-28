import { UserLevel } from '@yato/contract';
import { type Actor, GUEST } from '../common/actor.js';
import type { JudgeTaskMessage } from '../messaging/commands.js';
import { JudgeQueue } from '../messaging/judge-queue.js';
import type { EventHandler, MessageBroker } from '../messaging/message-broker.js';
import { type SubmissionBusEvent, SubmissionEvents } from '../modules/submission/submission.events.js';

/** Test-only helpers. Not part of the build (tsconfig.build.json). */

export const actor = (id: number, level: UserLevel = UserLevel.USER): Actor => ({
  id,
  level,
  username: `user${id}`,
  email: `user${id}@example.com`,
});

export const guest = GUEST;
export const user = actor(1, UserLevel.USER);
export const admin = actor(2, UserLevel.ADMIN);
export const root = actor(3, UserLevel.ROOT);

/**
 * Stands in for a class the code under test depends on: only the members a
 * test provides exist, anything else fails loudly when called.
 */
export function fake<T>(members: Partial<Record<keyof T, unknown>>): T {
  return new Proxy(members, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target];
      if (property === 'then') return undefined;
      throw new Error(`fake: ${String(property)} was not provided`);
    },
  }) as T;
}

export const minutesFrom = (base: Date, minutes: number) => new Date(base.getTime() + minutes * 60_000);

/**
 * A `SubmissionEvents` without a broker: what it announces comes straight
 * back to it, as it would from the exchange.
 */
export function localEvents(): SubmissionEvents {
  const events: SubmissionEvents = new SubmissionEvents(
    fake<MessageBroker>({
      announce: (key: string, payload: SubmissionBusEvent) => events.dispatch(Number(key.split('.')[1]), payload),
    }),
  );
  return events;
}

/**
 * A `JudgeQueue` over an in-memory array instead of RabbitMQ. What it
 * announces comes straight back to it, as it would from the exchange, and is
 * also kept in `announced`.
 */
export function localJudgeQueue(tasks: JudgeTaskMessage[] = []) {
  let hear: EventHandler = () => undefined;
  const announced: string[] = [];
  const queue = new JudgeQueue(
    fake<MessageBroker>({
      publish: async (_queue: string, task: JudgeTaskMessage) => void tasks.push(task),
      pull: async () => tasks.shift(),
      depth: async () => tasks.length,
      announce: (key: string) => {
        announced.push(key);
        hear(key, {});
      },
      subscribe: (_pattern: string, handler: EventHandler) => {
        hear = handler;
      },
    }),
  );
  queue.onModuleInit();
  return { queue, tasks, announced };
}
