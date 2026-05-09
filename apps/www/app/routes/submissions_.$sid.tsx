import { Link, useLoaderData } from "react-router"
import Shiki from "react-shiki"

export const meta = () => [{ title: "Submission – YATO Judge" }]

// TODO: replace fake data with API calling
// TODO: add types
export const loader = async () => ({
  submission: {
    id: "V2S175CT",
    problemId: 1,
    problemTitle: "Weird Algorithm",
    username: "alice",
    compiler: "C++ (g++ 13.2.0)",
    timestamp: new Date().toISOString(),
    verdict: "WA",
    totalTime: "312 ms",
    peakMemory: "18 MB",
    passed: 9,
    total: 12,
    testcases: Array.from({ length: 12 }).map((_, i) => ({
      id: i + 1,
      status: i < 9 ? "AC" : i === 9 ? "WA" : "SKIPPED",
      time: i < 9 ? `${12 + i * 3} ms` : "—",
      memory: i < 9 ? `${6 + i} MB` : "—",
    })),
  },
  subtasks: [
    { id: 1, points: 20, gained: true },
    { id: 2, points: 30, gained: true },
    { id: 3, points: 25, gained: false },
    { id: 4, points: 25, gained: false },
  ],
})

export default function Submission() {
  const { submission, subtasks } = useLoaderData<typeof loader>()

  const verdictColor = {
    AC: "text-emerald-400",
    WA: "text-rose-400",
    TLE: "text-purple-400",
    SKIPPED: "text-zinc-500",
  }

  const gainedPoints = subtasks.filter((s) => s.gained).reduce((a, b) => a + b.points, 0)
  const totalPoints = subtasks.reduce((a, b) => a + b.points, 0)

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <h1 className="font-mono text-xl text-zinc-100">{submission.id}</h1>

        <div className="flex flex-wrap gap-6 text-sm text-zinc-400">
          <span>
            Problem:{" "}
            <Link to={`/problems/${submission.problemId}`} className="text-zinc-200 hover:underline">
              #{submission.problemId} {submission.problemTitle}
            </Link>
          </span>
          <span>
            User:{" "}
            <Link to={`/users/${submission.username}`} className="text-zinc-200 hover:underline">
              {submission.username}
            </Link>
          </span>
          <span>
            Compiler: <span className="font-mono text-zinc-300">{submission.compiler}</span>
          </span>
          <span>
            Submitted at: <span className="font-mono text-zinc-300">{submission.timestamp}</span>
          </span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-6 md:grid-cols-3">
        <div>
          <div className="text-xs uppercase text-zinc-400">Verdict</div>
          <div className={`mt-1 font-mono ${verdictColor[submission.verdict]}`}>{submission.verdict}</div>
        </div>

        <div>
          <div className="text-xs uppercase text-zinc-400">Total Time</div>
          <div className="mt-1 font-mono text-zinc-200">{submission.totalTime}</div>
        </div>

        <div>
          <div className="text-xs uppercase text-zinc-400">Peak Memory</div>
          <div className="mt-1 font-mono text-zinc-200">{submission.peakMemory}</div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Subtasks</h2>
          <span className="font-mono text-sm text-zinc-400">
            (<span className="text-zinc-200">{gainedPoints}</span> / {totalPoints} pts)
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-900/80 text-xs uppercase text-zinc-400">
                {subtasks.map((st) => (
                  <th key={st.id} className="px-4 py-2 text-center font-mono">
                    Subtask {st.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {subtasks.map((st) => (
                  <td key={st.id} className="px-4 py-3 text-center">
                    {st.gained ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-mono text-emerald-400">✓</span>
                        <span className="text-xs text-zinc-400">{st.points} pts</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-mono text-zinc-500">—</span>
                        <span className="text-xs text-zinc-500">{st.points} pts</span>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Testcases</h2>
          <span className="font-mono text-sm text-zinc-400">
            (<span className="text-zinc-200">{submission.passed}</span> / {submission.total} accepted)
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-900/80 text-xs uppercase text-zinc-400">
                <th className="px-3 py-2 text-left">Case</th>
                {submission.testcases.map((tc) => (
                  <th key={tc.id} className="px-3 py-2 text-center font-mono">
                    #{tc.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800">
                <td className="px-3 py-2 text-zinc-400">Status</td>
                {submission.testcases.map((tc) => (
                  <td key={tc.id} className={`px-3 py-2 text-center font-mono ${verdictColor[tc.status]}`}>
                    {tc.status}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-zinc-800">
                <td className="px-3 py-2 text-zinc-400">Time</td>
                {submission.testcases.map((tc) => (
                  <td key={tc.id} className="px-3 py-2 text-center font-mono text-zinc-300">
                    {tc.time}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="px-3 py-2 text-zinc-400">Memory</td>
                {submission.testcases.map((tc) => (
                  <td key={tc.id} className="px-3 py-2 text-center font-mono text-zinc-300">
                    {tc.memory}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Submitted Code</h2>
        <Shiki language="cpp" theme="vitesse-dark" className="overflow-x-auto rounded-lg border border-zinc-800">
          {`#include <bits/stdc++.h>
#define int long long

using namespace std;

main() {
\tcin.tie(0)->sync_with_stdio(0);

\tint n;
\tcin >> n;

\twhile (n != 1) {
\t\tcout << n << ' ';

\t\tif (n & 1) n *= 3, n++;
\t\telse n /= 2;
\t}

\tcout << "1\\n";
}`}
        </Shiki>
      </section>
    </div>
  )
}
