import { Verdict } from '@yato/contract';
import { describe, expect, it } from 'vitest';
import { localEvents } from '../../testing/fixtures.js';
import { Mailbox, type SubmissionBusEvent } from './submission.events.js';

const result = (testcaseId: number, ordinal: number) => ({
  testcaseId,
  ordinal,
  verdict: Verdict.AC as number,
  timeMs: 1,
  memoryKb: 1,
  score: 1,
  message: '',
});

describe('SubmissionEvents', () => {
  it('passes events to the listeners of that submission until they stop listening', () => {
    const events = localEvents();
    const heard: SubmissionBusEvent[] = [];
    const stop = events.listen(5, (event) => heard.push(event));
    events.changed(5);
    events.changed(6);
    stop();
    events.changed(5);
    expect(heard).toEqual([{ kind: 'changed' }]);
  });

  it('remembers the testcases of a run in flight, in order, each once', () => {
    const events = localEvents();
    events.progress(5, 3, result(12, 1));
    events.progress(5, 3, result(11, 0));
    events.progress(5, 3, result(12, 1)); // delivered twice
    expect(events.progressOf(5)).toEqual({ total: 3, results: [result(11, 0), result(12, 1)] });
    expect(events.progressOf(6)).toBeUndefined();
  });

  it('forgets a run when the submission changes state, or goes quiet', () => {
    const events = localEvents();
    events.progress(5, 3, result(11, 0));
    events.changed(5);
    expect(events.progressOf(5)).toBeUndefined();

    events.progress(6, 3, result(11, 0));
    events.forgetStale(Date.now() - 60_000);
    expect(events.progressOf(6)).toBeDefined();
    events.forgetStale(Date.now() + 1);
    expect(events.progressOf(6)).toBeUndefined();
  });
});

describe('Mailbox', () => {
  it('hands out events in order, waiting for the next one', async () => {
    const inbox = new Mailbox<number>();
    inbox.push(1);
    inbox.push(2);
    expect(await inbox.next(1000)).toBe(1);
    expect(await inbox.next(1000)).toBe(2);
    const waiting = inbox.next(1000);
    inbox.push(3);
    expect(await waiting).toBe(3);
  });

  it('gives up after the timeout, or at once when the reader has left', async () => {
    const inbox = new Mailbox<number>();
    expect(await inbox.next(5)).toBeUndefined();

    const leave = new AbortController();
    const waiting = inbox.next(60_000, leave.signal);
    leave.abort();
    expect(await waiting).toBeUndefined();
    expect(await inbox.next(60_000, leave.signal)).toBeUndefined();
  });
});
