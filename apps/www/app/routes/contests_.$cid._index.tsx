import { Link, useLoaderData, useSearchParams } from "react-router"

export const meta = () => [{ title: "Contest – YATO Judge" }]

// TODO: replace fake data with API calling
// TODO: add types
export const loader = async () => ({
  contest: {
    id: "7",
    schedule: {
      registerBefore: new Date("2025-11-08 12:00:00").toISOString(),
      start: new Date("2025-11-08 12:00:00").toISOString(),
      end: new Date("2025-11-08 17:00:00").toISOString(),
    },
    description: `HIIT Open is an ICPC-style team contest organized by the Helsinki Institute for Information Technology (HIIT).`,
  },
  problems: [
    { key: "A", id: 1, title: "Aristocracy", myStatus: "Unattempted" },
    { key: "B", id: 2, title: "Broken car race", myStatus: "AC" },
    { key: "C", id: 3, title: "Coloring", myStatus: "Tried" },
  ],
  submissions: [
    {
      id: 1,
      problemKey: "A",
      user: "alice",
      verdict: "WA",
      score: 0,
      language: "C++",
      time: new Date().toISOString(),
    },
    {
      id: 1,
      problemKey: "A",
      user: "bob",
      verdict: "CE",
      score: 0,
      language: "Python",
      time: new Date().toISOString(),
    },
  ],
  scoreboard: [
    { rank: 1, user: "alice", pA: 100, pB: 100, pC: 0, total: 200 },
    { rank: 1, user: "bob", pA: 100, pB: 100, pC: 0, total: 200 },
  ],
})

export default function ContestInner() {
  const { contest, problems, submissions, scoreboard } = useLoaderData()
  const [params] = useSearchParams()

  const tab = params.get("tab") ?? "overview"
  const problemKey = params.get("problem") ?? "A"

  if (tab === "problems") {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <aside className="md:col-span-1 space-y-6">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/80 text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 text-left">p#</th>
                    <th className="px-3 py-2 text-left">Title</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.map((p) => (
                    <tr
                      key={p.key}
                      className={`border-b border-zinc-800 hover:bg-zinc-900/50 ${
                        p.key === problemKey ? "bg-zinc-900/50" : ""
                      }`}>
                      <td className="px-3 py-2 font-mono">{p.key}</td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/contests/${contest.id}?tab=problems&problem=${p.key}`}
                          className="text-blue-400 hover:underline">
                          {p.title}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-200">Submit</h3>

              <div className="space-y-2">
                <label className="block text-xs text-zinc-400">Language</label>
                <select className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-200">
                  <option>C++</option>
                  <option>Python</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-zinc-400">Source File</label>
                <label className="flex cursor-pointer items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900">
                  Choose file
                  <input type="file" className="hidden" />
                </label>
              </div>

              <button className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500">
                Submit
              </button>
            </div>
          </aside>

          <main className="md:col-span-3 space-y-6">
            <section className="space-y-2">
              <h1 className="text-xl font-semibold text-zinc-100">
                <span className="font-mono text-zinc-400">{problemKey}.</span> Missing Number
              </h1>

              <div className="flex gap-6 text-sm text-zinc-400">
                <span>
                  Time limit <span className="font-mono text-zinc-200">1.00 s</span>
                </span>
                <span>
                  Memory limit <span className="font-mono text-zinc-200">512 MB</span>
                </span>
              </div>
            </section>

            <section className="space-y-6 text-zinc-200">
              <p>
                You are given all numbers between{" "}
                <math>
                  <mn>1</mn>
                  <mo>,</mo>
                  <mn>2</mn>
                  <mo>,</mo>
                  <mo>…</mo>
                  <mo>,</mo>
                  <mi>n</mi>
                </math>{" "}
                except one. Your task is to find the missing number.
              </p>

              <div className="space-y-2">
                <h2 className="font-semibold text-zinc-100">Input</h2>
                <p>
                  The first input line contains an integer{" "}
                  <math>
                    <mi>n</mi>
                  </math>{" "}
                  .
                </p>
                <p>
                  The second line contains{" "}
                  <math>
                    <mi>n</mi>
                    <mo>−</mo>
                    <mi>1</mi>
                  </math>{" "}
                  numbers. Each number is distinct and between{" "}
                  <math>
                    <mi>1</mi>
                  </math>{" "}
                  and{" "}
                  <math>
                    <mi>n</mi>
                  </math>{" "}
                  (inclusive).
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="font-semibold text-zinc-100">Output</h2>
                <p>Print the missing number.</p>
              </div>

              <div className="space-y-2">
                <h2 className="font-semibold text-zinc-100">Constraints</h2>
                <math>
                  <mn>2</mn>
                  <mo>≤</mo>
                  <mi>n</mi>
                  <mo>≤</mo>
                  <mn>2</mn>
                  <mo>·</mo>
                  <msup>
                    <mn>10</mn>
                    <mn>5</mn>
                  </msup>
                </math>
              </div>

              <div className="space-y-3">
                <h2 className="font-semibold text-zinc-100">Example</h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="mb-2 text-xs uppercase text-zinc-400">Input</div>
                    <pre className="font-mono text-sm text-zinc-200">5{"\n"}2 3 1 5</pre>
                  </div>

                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="mb-2 text-xs uppercase text-zinc-400">Output</div>
                    <pre className="font-mono text-sm text-zinc-200">4</pre>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    )
  }

  if (tab === "submissions") {
    return (
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/40">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-900/80 text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-left">s#</th>
              <th className="px-3 py-2 text-left">p#</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Verdict</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-left">Language</th>
              <th className="px-3 py-2 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((r) => (
              <tr key={r.id} className="border-b border-zinc-800 hover:bg-zinc-900/50">
                <td className="px-3 py-2 font-mono">{r.id}</td>
                <td className="px-3 py-2">{r.problemKey}</td>
                <td className="px-3 py-2 text-blue-400">{r.user}</td>
                <td className="px-3 py-2 font-mono">{r.verdict}</td>
                <td className="px-3 py-2 text-right font-mono">{r.score}</td>
                <td className="px-3 py-2 text-zinc-400">{r.language}</td>
                <td className="px-3 py-2 font-mono">{r.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (tab === "scoreboard") {
    return (
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/40">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-900/80 border-b border-zinc-800">
              <th className="px-3 py-2 text-left text-xs uppercase text-zinc-400">Rank</th>
              <th className="px-3 py-2 text-left text-xs uppercase text-zinc-400">User</th>
              <th className="px-3 py-2 text-center text-xs uppercase text-zinc-400">pA</th>
              <th className="px-3 py-2 text-center text-xs uppercase text-zinc-400">pB</th>
              <th className="px-3 py-2 text-center text-xs uppercase text-zinc-400">pC</th>
              <th className="px-3 py-2 text-right text-xs uppercase text-zinc-400">Total</th>
            </tr>
          </thead>
          <tbody>
            {scoreboard.map((r) => (
              <tr key={r.rank} className="border-b border-zinc-800 hover:bg-zinc-900/50">
                <td className="px-3 py-2">{r.rank}</td>
                <td className="px-3 py-2 text-blue-400">{r.user}</td>
                <td className="px-3 py-2 text-center font-mono text-emerald-400">{r.pA}</td>
                <td className="px-3 py-2 text-center font-mono text-emerald-400">{r.pB}</td>
                <td className="px-3 py-2 text-center font-mono text-yellow-400">{r.pC}</td>
                <td className="px-3 py-2 text-right font-mono">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
        <dl className="grid grid-cols-1 gap-y-4 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-zinc-400">Register before</dt>
            <dd className="mt-1 font-mono text-zinc-200">{contest.schedule.registerBefore}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-400">Starts at</dt>
            <dd className="mt-1 font-mono text-zinc-200">{contest.schedule.start}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-400">Ends at</dt>
            <dd className="mt-1 font-mono text-zinc-200">{contest.schedule.end}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-zinc-200">{contest.description}</div>
    </div>
  )
}
