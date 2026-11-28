import { type BeforeApplicationShutdown, Injectable, type OnModuleInit } from '@nestjs/common';
import type { JudgeTaskMessage } from './commands.js';
import { MessageBroker, Queue } from './message-broker.js';

/**
 * Routing key announced on the events exchange whenever a task is queued:
 * `judge.queued.<language>`, or `judge.queued` when the caller does not
 * have the language at hand (which wakes every waiting judge).
 */
const QUEUED = 'judge.queued';

/** One `/judge/fetch` held open until there is work for its judge. */
interface Waiter {
  /** Languages the judge can run; unset when it runs any. */
  languages?: ReadonlySet<string>;
  ring: () => void;
}

/**
 * Listens for tasks on behalf of one fetch. Single use: `wait` once, then
 * `stop` (always, also when the fetch found a task without waiting).
 */
export interface Doorbell {
  /**
   * Resolves when a task the judge could take is announced, after `ms`,
   * when `signal` aborts or when the API starts shutting down — whichever
   * comes first. Never rejects.
   */
  wait(ms: number, signal?: AbortSignal): Promise<void>;
  stop(): void;
}

/**
 * The queue of submissions waiting for a judge machine, and the doorbell
 * that judges long-polling `/judge/fetch` wait on.
 *
 * Every task put on the queue is also announced on the events exchange,
 * with the submission's language in the routing key when it is known. Each
 * API instance hears every announcement and wakes the fetches it holds for
 * judges that can run that language. Announcements are best effort, so a
 * waiting fetch still looks at the queue again every few seconds.
 */
@Injectable()
export class JudgeQueue implements OnModuleInit, BeforeApplicationShutdown {
  private readonly waiters = new Set<Waiter>();
  private closing = false;

  constructor(private readonly broker: MessageBroker) {}

  onModuleInit(): void {
    this.broker.subscribe(`${QUEUED}.#`, (key) => this.ring(key.slice(QUEUED.length + 1) || undefined));
  }

  /**
   * The HTTP server waits for requests in flight before it closes, so the
   * fetches held open are answered now, empty, rather than at their deadline.
   */
  beforeApplicationShutdown(): void {
    this.closing = true;
    for (const waiter of this.waiters) waiter.ring();
    this.waiters.clear();
  }

  /** Whether the API is shutting down; fetches then answer without waiting. */
  get closed(): boolean {
    return this.closing;
  }

  /**
   * Queues a submission for judging and wakes the judges waiting for one.
   * Pass the language when known: only judges that can run it are woken.
   */
  async push(submissionId: number, language?: string): Promise<void> {
    await this.broker.publish(Queue.JUDGE, { submissionId } satisfies JudgeTaskMessage);
    this.broker.announce(language ? `${QUEUED}.${language}` : QUEUED, {});
  }

  /** Takes the next task, or `undefined` when the queue is empty. */
  pull(): Promise<JudgeTaskMessage | undefined> {
    return this.broker.pull<JudgeTaskMessage>(Queue.JUDGE);
  }

  /** Number of tasks waiting. */
  depth(): Promise<number> {
    return this.broker.depth(Queue.JUDGE);
  }

  /**
   * Starts listening for tasks a judge with `languages` could take (any task
   * when it lists none). Call it before looking at the queue: a task queued
   * in between then still rings.
   */
  listen(languages?: readonly string[]): Doorbell {
    let ring: () => void = () => undefined;
    const rung = new Promise<void>((resolve) => {
      ring = resolve;
    });
    const waiter: Waiter = { languages: languages && new Set(languages), ring };
    if (this.closing) ring();
    else this.waiters.add(waiter);
    return {
      wait: (ms, signal) =>
        new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', finish);
            resolve();
          };
          const timer = setTimeout(finish, ms);
          signal?.addEventListener('abort', finish, { once: true });
          if (signal?.aborted) finish();
          void rung.then(finish);
        }),
      stop: () => {
        this.waiters.delete(waiter);
      },
    };
  }

  private ring(language: string | undefined): void {
    for (const waiter of this.waiters) {
      if (!language || !waiter.languages || waiter.languages.has(language)) waiter.ring();
    }
  }
}
