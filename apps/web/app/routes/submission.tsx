import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { VERDICT_LABEL, Verdict } from '@yato/contract';
import { useEffect, useState } from 'react';
import { Form, Link } from 'react-router';
import { ContestNav, inContest } from '~/components/contest-nav';
import { api, load, seed, submit } from '~/lib/api.server';
import { contestNav } from '~/lib/contest-nav.server';
import { highlight } from '~/lib/highlight.server';
import { api as browserApi, orpc } from '~/lib/orpc';
import { idParam } from '~/lib/params';
import {
  Button,
  Callout,
  Card,
  CardBody,
  css,
  Field,
  Muted,
  Notice,
  PageHeader,
  Stack,
  Stats,
  Time,
  UserLink,
  VerdictBadge,
} from '~/ui';
import { CodeView, languageName } from '~/ui/code';
import { type Column, DataTable } from '~/ui/data-table';
import { Tabs } from '~/ui/overlays';
import type { Route } from './+types/submission';

export async function loader({ request, params }: Route.LoaderArgs) {
  const id = idParam(params.id);
  // Arriving straight from the submit form: the insert may still be queued.
  const awaitCreation = new URL(request.url).searchParams.has('new');
  const [submission, contest] = await Promise.all([
    load(request, (o) => api.submission.get({ id }, o), { awaitCreation }),
    contestNav(request),
  ]);
  return {
    id,
    contest,
    // Highlighted once here; the source never changes while the page polls.
    codeHtml: submission.code === null ? null : await highlight(submission.code, submission.language),
    dehydrated: seed([[orpc.submission.get.queryKey({ input: { id } }), submission]]),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const id = idParam(params.id);
  const form = await request.formData();
  const comment = String(form.get('comment') ?? '');
  const verdict = Object.values(Verdict).find((value) => String(value) === form.get('verdict'));
  return {
    ...(await submit(request, (o) => api.submission.setComment({ id, comment, verdict }, o))),
    message: 'Saved.',
  };
}

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: `Submission #${loaderData?.id ?? ''}` }];

const isPending = (verdict: Verdict) => verdict === Verdict.WAIT || verdict === Verdict.JUDGING;

type Submission = Awaited<ReturnType<typeof api.submission.get>>;
type Result = Submission['results'][number];

/** The testcases a judge has finished so far in the run in progress. */
interface LiveRun {
  total: number;
  results: Result[];
}

/**
 * Follows a submission while it is judged, over the server-sent events of
 * `submission.watch`: `onSnapshot` gets the submission whenever it changes,
 * `run` grows by a testcase at a time. `connected` turns false when the
 * stream cannot be had or breaks, which is the caller's cue to poll instead.
 */
function useLiveRun(id: number, pending: boolean, onSnapshot: (submission: Submission) => void) {
  const [run, setRun] = useState<LiveRun | null>(null);
  const [connected, setConnected] = useState(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `onSnapshot` is new on every render and must not restart the stream.
  useEffect(() => {
    if (!pending) return;
    const leaving = new AbortController();
    setRun(null);
    setConnected(true);
    void (async () => {
      try {
        const events = await browserApi.submission.watch({ id }, { signal: leaving.signal });
        for await (const event of events) {
          if (event.type === 'snapshot') {
            // Back to waiting (rejudged, or its judge was lost): that run is over.
            if (event.submission.verdict === Verdict.WAIT) setRun(null);
            onSnapshot(event.submission);
          } else {
            setRun((current) => ({
              total: event.total,
              results: [
                ...(current?.results ?? []).filter((r) => r.testcaseId !== event.result.testcaseId),
                event.result,
              ].sort((a, b) => a.ordinal - b.ordinal),
            }));
          }
        }
      } catch {
        // Falls through: a stream that fails and one that ends early are the same to the page.
      }
      // Still mounted and still pending, or this effect would have been cleaned up.
      if (!leaving.signal.aborted) setConnected(false);
    })();
    return () => leaving.abort();
  }, [id, pending]);

  return { run: pending ? run : null, connected };
}

/**
 * `testcaseBase`: where testcases of the problem are inspected, for those
 * who may; their numbers then link to the data each one was judged on.
 */
const resultColumns = (testcaseBase: string | null): Column<Result>[] => [
  {
    id: 'n',
    header: '#',
    cell: (r) =>
      testcaseBase ? (
        <Link to={`${testcaseBase}/${r.testcaseId}`} aria-label={`Testcase ${r.ordinal + 1}`}>
          {r.ordinal + 1}
        </Link>
      ) : (
        r.ordinal + 1
      ),
  },
  {
    id: 'verdict',
    header: 'Verdict',
    sortValue: (r) => r.verdict,
    cell: (r) => <VerdictBadge verdict={r.verdict} long />,
  },
  { id: 'time', header: 'Time', align: 'right', sortValue: (r) => r.timeMs, cell: (r) => `${r.timeMs} ms` },
  { id: 'memory', header: 'Memory', align: 'right', sortValue: (r) => r.memoryKb, cell: (r) => `${r.memoryKb} KB` },
  { id: 'message', header: 'Message', cell: (r) => <Muted>{r.message}</Muted> },
];

export default function Submission({ loaderData, actionData }: Route.ComponentProps) {
  const { id, codeHtml, contest } = loaderData;
  const queryClient = useQueryClient();
  const options = orpc.submission.get.queryOptions({ input: { id } });
  const [polling, setPolling] = useState(false);
  // Only when the live stream is unavailable: poll while the judge is working.
  const { data: submission } = useQuery({
    ...options,
    refetchInterval: (current) =>
      polling && current.state.data && isPending(current.state.data.verdict) ? 1500 : false,
  });
  const { run, connected } = useLiveRun(id, submission ? isPending(submission.verdict) : false, (current) =>
    queryClient.setQueryData(options.queryKey, current),
  );
  useEffect(() => setPolling(!connected), [connected]);
  const rejudge = useMutation(
    orpc.submission.rejudge.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: options.queryKey }),
    }),
  );
  if (!submission) return null;
  const pending = isPending(submission.verdict);
  // While a run is in progress, the testcases done so far; afterwards the stored ones.
  const results = run?.results ?? submission.results;

  const tabs = [
    ...(submission.compileMessage
      ? [
          {
            id: 'message',
            label: submission.verdict === Verdict.CE ? 'Compiler output' : 'Judge message',
            content: (
              <CardBody>
                <pre className={css.preWrap}>{submission.compileMessage}</pre>
              </CardBody>
            ),
          },
        ]
      : []),
    ...(results.length > 0
      ? [
          {
            id: 'testcases',
            label: run ? `Testcases (${results.length} of ${run.total})` : `Testcases (${results.length})`,
            content: (
              <DataTable
                data={results}
                columns={resultColumns(
                  // Administrators, as the API decides when it offers a rejudge.
                  submission.canRejudge ? `/problems/${submission.problem.id}/testcases` : null,
                )}
                rowKey={(r) => r.testcaseId}
                empty={null}
              />
            ),
          },
        ]
      : []),
    {
      id: 'source',
      label: 'Source code',
      content: (
        <CardBody>
          {codeHtml === null ? (
            <Muted>The source code of this submission is not public.</Muted>
          ) : (
            <CodeView html={codeHtml} />
          )}
        </CardBody>
      ),
    },
  ];

  return (
    <>
      {contest && <ContestNav contest={contest} current={submission.problem.id} />}
      <PageHeader
        title={`Submission #${submission.id}`}
        meta={
          <>
            <UserLink user={submission.user} /> on{' '}
            <Link to={`/problems/${submission.problem.id}${inContest(contest)}`}>
              {submission.problem.id}. {submission.problem.title}
            </Link>{' '}
            · <Time value={submission.createdAt} />
          </>
        }
        actions={
          submission.canRejudge && (
            <Button variant="secondary" busy={rejudge.isPending} onClick={() => rejudge.mutate({ id })}>
              Rejudge
            </Button>
          )
        }
      />

      <Stack gap="lg">
        <Notice result={actionData} />
        {rejudge.isError && <Notice result={{ ok: false, error: rejudge.error.message }} />}

        <div aria-live="polite">
          <Stats
            items={[
              ['Verdict', <VerdictBadge key="v" verdict={submission.verdict} long />],
              ['Score', Math.round(submission.score * 100) / 100],
              ['Total time', `${submission.timeMs} ms`],
              ['Peak memory', `${submission.memoryKb} KB`],
              ['Language', languageName(submission.language)],
            ]}
          />
        </div>

        {pending && (
          <Callout>
            {submission.verdict === Verdict.WAIT
              ? 'Waiting for a judge…'
              : run
                ? `Judging… ${run.results.length} of ${run.total} testcases done.`
                : 'Judging…'}{' '}
            This page updates by itself.
          </Callout>
        )}

        {submission.comment && (
          <Card title="Comment from the judges">
            <p className={css.preWrap}>{submission.comment}</p>
          </Card>
        )}

        <Card flush>
          {/* Remount when the set of tabs changes so the first one is selected. */}
          <Tabs key={tabs.map((tab) => tab.id).join()} tabs={tabs} />
        </Card>

        {submission.canRejudge && (
          <Card title="Review">
            <Form method="post">
              <Stack>
                <Field label="Comment (shown to the author)">
                  <textarea name="comment" rows={3} maxLength={2000} defaultValue={submission.comment} />
                </Field>
                <Field label="Override verdict">
                  <select className={css.inputWidth.auto} name="verdict" defaultValue="">
                    <option value="">Keep the judge's verdict</option>
                    {Object.values(Verdict).map((verdict) => (
                      <option key={verdict} value={verdict}>
                        {VERDICT_LABEL[verdict]}
                      </option>
                    ))}
                  </select>
                </Field>
                <div>
                  <Button variant="secondary">Save review</Button>
                </div>
              </Stack>
            </Form>
          </Card>
        )}
      </Stack>
    </>
  );
}
