import { api, load } from '~/lib/api.server';
import { downloadDisposition } from '~/lib/files';
import { idParam } from '~/lib/params';
import type { Route } from './+types/problem-testcase-file';

/** `/problems/:id/testcases/:testcaseId/input` or `…/answer`. */
function kindOf(file: string): 'input' | 'output' {
  if (file === 'input') return 'input';
  if (file === 'answer') return 'output';
  throw new Response('Not found', { status: 404 });
}

/**
 * Downloads one testcase file through the web server. The API lets only
 * those who may edit the problem have it.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const kind = kindOf(params.file);
  const file = await load(request, (o) =>
    api.problem.getTestcaseFile({ problemId: idParam(params.id), testcaseId: idParam(params.testcaseId), kind }, o),
  );
  return new Response(file.stream(), {
    headers: {
      // Always a download, never rendered: testdata is arbitrary bytes.
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': downloadDisposition(file.name),
      'Content-Length': String(file.size),
      'X-Content-Type-Options': 'nosniff',
      // Testdata is meant to stay secret: keep it out of shared and disk caches.
      'Cache-Control': 'private, no-store',
    },
  });
}
