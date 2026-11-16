import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import type { StoredTestResult } from '../../database/schema.js';
import { MessageBroker } from '../../messaging/message-broker.js';

/** What travels on the events exchange under `submission.<id>`. */
export type SubmissionBusEvent =
  /** The stored submission changed (claimed, judged, requeued, reviewed): read it again. */
  | { kind: 'changed' }
  /** A judge finished one testcase; nothing is stored yet. */
  | { kind: 'progress'; total: number; result: StoredTestResult };

export interface SubmissionProgress {
  /** Testcases the judge is running in total. */
  total: number;
  results: StoredTestResult[];
}

type Listener = (event: SubmissionBusEvent) => void;

/** Progress of a run nobody finished reporting is forgotten after this long. */
const PROGRESS_TTL_MS = 15 * 60_000;
const SWEEP_INTERVAL_MS = 60_000;

const routingKey = (submissionId: number) => `submission.${submissionId}`;

/**
 * Live events about submissions, for the pages that watch one being judged.
 *
 * Whichever API instance learns something announces it on the events
 * exchange; every instance hears it and passes it to the streams it serves.
 * Each instance also remembers the testcases of runs in flight, so a viewer
 * who arrives halfway is shown the testcases already done. None of this is
 * durable — the database stays the only truth, and streams fall back to it.
 */
@Injectable()
export class SubmissionEvents implements OnModuleInit, OnApplicationShutdown {
  private readonly listeners = new Map<number, Set<Listener>>();
  private readonly inFlight = new Map<number, SubmissionProgress & { touchedAt: number }>();
  private timer?: NodeJS.Timeout;

  constructor(private readonly broker: MessageBroker) {}

  onModuleInit(): void {
    this.broker.subscribe('submission.*', (key, payload) => {
      const id = Number(key.slice(key.indexOf('.') + 1));
      if (Number.isInteger(id)) this.dispatch(id, payload as SubmissionBusEvent);
    });
    this.timer = setInterval(() => this.forgetStale(Date.now() - PROGRESS_TTL_MS), SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /** Tells every watcher to read the submission again. */
  changed(submissionId: number): void {
    this.broker.announce(routingKey(submissionId), { kind: 'changed' } satisfies SubmissionBusEvent);
  }

  progress(submissionId: number, total: number, result: StoredTestResult): void {
    this.broker.announce(routingKey(submissionId), { kind: 'progress', total, result } satisfies SubmissionBusEvent);
  }

  /** Calls `listener` for every event about one submission until the returned function is called. */
  listen(submissionId: number, listener: Listener): () => void {
    const listeners = this.listeners.get(submissionId) ?? new Set();
    this.listeners.set(submissionId, listeners.add(listener));
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(submissionId);
    };
  }

  /** The testcases of the current run heard of so far, in testcase order. */
  progressOf(submissionId: number): SubmissionProgress | undefined {
    const known = this.inFlight.get(submissionId);
    return known && { total: known.total, results: [...known.results].sort((a, b) => a.ordinal - b.ordinal) };
  }

  /** Handles one event from the exchange; public for tests. */
  dispatch(submissionId: number, event: SubmissionBusEvent): void {
    if (event.kind === 'changed') {
      // A new state: whatever run the remembered testcases belonged to is over.
      this.inFlight.delete(submissionId);
    } else {
      const known = this.inFlight.get(submissionId) ?? { total: event.total, results: [], touchedAt: 0 };
      known.total = event.total;
      known.results = [...known.results.filter((r) => r.testcaseId !== event.result.testcaseId), event.result];
      known.touchedAt = Date.now();
      this.inFlight.set(submissionId, known);
    }
    for (const listener of this.listeners.get(submissionId) ?? []) listener(event);
  }

  /** Drops remembered progress last touched before `before` (a judge that died mid-run). */
  forgetStale(before: number): void {
    for (const [id, known] of this.inFlight) if (known.touchedAt < before) this.inFlight.delete(id);
  }
}

/**
 * Events for one reader that takes them one at a time: `next` resolves with
 * the oldest unread event, or with nothing after `timeoutMs` or once `signal`
 * aborts.
 */
export class Mailbox<T> {
  private readonly items: T[] = [];
  private wake?: () => void;

  push(item: T): void {
    this.items.push(item);
    this.wake?.();
  }

  async next(timeoutMs: number, signal?: AbortSignal): Promise<T | undefined> {
    if (this.items.length === 0 && !signal?.aborted) {
      let timer: NodeJS.Timeout | undefined;
      let wake: () => void = () => undefined;
      await new Promise<void>((resolve) => {
        wake = resolve;
        this.wake = resolve;
        timer = setTimeout(resolve, timeoutMs);
        signal?.addEventListener('abort', wake, { once: true });
      });
      clearTimeout(timer);
      signal?.removeEventListener('abort', wake);
      this.wake = undefined;
    }
    return this.items.shift();
  }
}
