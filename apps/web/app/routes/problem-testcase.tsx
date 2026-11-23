import { TESTDATA_PREVIEW_BYTES } from '@yato/contract';
import { Link } from 'react-router';
import { api, load } from '~/lib/api.server';
import { formatBytes } from '~/lib/files';
import { highlight } from '~/lib/highlight.server';
import { idParam } from '~/lib/params';
import { ButtonLink, Card, Cluster, Grid, Muted, PageHeader, Stack } from '~/ui';
import { CodeView } from '~/ui/code';
import type { Route } from './+types/problem-testcase';

/**
 * One testcase of a problem, for those who may edit it: the start of its
 * input and expected answer, and both files to download whole.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const problemId = idParam(params.id);
  const testcaseId = idParam(params.testcaseId);
  const [problem, testcases, preview] = await Promise.all([
    load(request, (o) => api.problem.get({ id: problemId }, o)),
    load(request, (o) => api.problem.listTestcases({ problemId }, o)),
    load(request, (o) => api.problem.previewTestcase({ problemId, testcaseId }, o)),
  ]);
  const { testcase } = preview;

  const show = async (kind: 'input' | 'answer', file: typeof preview.input, size: number) => ({
    kind,
    size,
    truncated: file.truncated,
    binary: file.binary,
    // The text stays on the server; the page gets it as HTML with line numbers.
    html: file.binary || size === 0 ? null : await highlight(file.text, 'text'),
  });
  const files = await Promise.all([
    show('input', preview.input, testcase.inputSize),
    show('answer', preview.output, testcase.outputSize),
  ]);

  const index = testcases.findIndex((t) => t.id === testcase.id);
  return {
    problem: { id: problem.id, title: problem.title },
    testcase,
    count: testcases.length,
    previous: index > 0 ? (testcases[index - 1]?.id ?? null) : null,
    next: index >= 0 ? (testcases[index + 1]?.id ?? null) : null,
    files,
  };
}

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: loaderData ? `Testcase ${loaderData.testcase.name} · ${loaderData.problem.title}` : 'Testcase' },
];

type TestFile = Route.ComponentProps['loaderData']['files'][number];

const LABEL: Record<TestFile['kind'], string> = { input: 'Input', answer: 'Answer' };

function FileCard({ file, href }: { file: TestFile; href: string }) {
  return (
    <Card
      title={
        <>
          {LABEL[file.kind]} <Muted small>{formatBytes(file.size)}</Muted>
        </>
      }
      actions={
        // A plain link: the file is a download, not a page.
        <a href={href}>Download</a>
      }>
      {file.binary ? (
        <Muted>This file is not text. Download it to inspect the bytes.</Muted>
      ) : file.html === null ? (
        <Muted>Empty file.</Muted>
      ) : (
        <Stack gap="sm">
          <CodeView html={file.html} scroll />
          {file.truncated && (
            <Muted small>
              Showing the first {formatBytes(TESTDATA_PREVIEW_BYTES)} of {formatBytes(file.size)}. Download the file to
              see all of it.
            </Muted>
          )}
        </Stack>
      )}
    </Card>
  );
}

export default function ProblemTestcase({ loaderData }: Route.ComponentProps) {
  const { problem, testcase, count, previous, next, files } = loaderData;
  const base = `/problems/${problem.id}/testcases`;
  return (
    <>
      <PageHeader
        title={`Testcase ${testcase.name}`}
        meta={
          <Cluster>
            <span>
              {testcase.ordinal + 1} of {count} in judging order
            </span>
            <span>
              of{' '}
              <Link to={`/problems/${problem.id}`}>
                #{problem.id} {problem.title}
              </Link>
            </span>
          </Cluster>
        }
        actions={
          <>
            {previous !== null && <ButtonLink to={`${base}/${previous}`}>Previous</ButtonLink>}
            {next !== null && <ButtonLink to={`${base}/${next}`}>Next</ButtonLink>}
            <ButtonLink to={`/problems/${problem.id}/edit`}>All testcases</ButtonLink>
          </>
        }
      />
      <Grid columns={2}>
        {files.map((file) => (
          <FileCard key={file.kind} file={file} href={`${base}/${testcase.id}/${file.kind}`} />
        ))}
      </Grid>
    </>
  );
}
