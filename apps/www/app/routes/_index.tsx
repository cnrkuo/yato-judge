import { Link, useLoaderData } from "react-router"

export const meta = (/* {}: Route.MetaArgs */) => [
  { title: "YATO Judge" },
  { name: "description", content: "Yet another trash-like online judge." },
]

// TODO: replace fake data with API calling
// TODO: add types
export const loader = async () => ({
  topCoders: [
    { user: "alice", solved: 777 },
    { user: "bob", solved: 666 },
    { user: "charlie", solved: 555 },
  ],
  recentSubmissions: [
    {
      id: "FSWJXTSD",
      user: "alice",
      problem: "Weird Algorithm",
      result: "AC",
      color: "text-emerald-400",
    },
    {
      id: "7F3MOH08",
      user: "bob",
      problem: "Missing Number",
      result: "TLE",
      color: "text-purple-400",
    },
    {
      id: "FIT42OQP",
      user: "charlie",
      problem: "Repetitions",
      result: "WA",
      color: "text-red-400",
    },
  ],
})

export default function Home() {
  const { topCoders, recentSubmissions } = useLoaderData()

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <section className="lg:col-span-2 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-100 uppercase">YATO Judge</h1>
          <p className="max-w-2xl text-zinc-400">
            Yet Another <del className="text-zinc-600">Trash-like</del> Trustworthy Online Judge.
          </p>
        </div>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">How-To’s</h2>

          <ol className="list-decimal space-y-2 pl-5 text-zinc-300">
            <li>Select a problem.</li>
            <li>Write and submit your solution.</li>
            <li>Wait for evaluation.</li>
            <li>View detailed results.</li>
          </ol>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Compiler Capabilities</h2>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-400">
                <th className="px-3 py-2 text-left">Language</th>
                <th className="px-3 py-2 text-left">Toolchain</th>
                <th className="px-3 py-2 text-left">Version</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800">
                <td className="px-3 py-2">C++</td>
                <td className="px-3 py-2 font-mono">G++</td>
                <td className="px-3 py-2">
                  <span className="font-mono">14.2.0</span>
                  <span className="ml-2 text-xs text-zinc-500">(C++23, C++17, C++11)</span>
                </td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="px-3 py-2">C</td>
                <td className="px-3 py-2">GCC</td>
                <td className="px-3 py-2 font-mono">14.2.0</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="px-3 py-2">Python</td>
                <td className="px-3 py-2">CPython</td>
                <td className="px-3 py-2 font-mono">3.13.5</td>
              </tr>
              <tr className="text-zinc-600 border-b border-zinc-800">
                <td className="px-3 py-2">Rust</td>
                <td className="px-3 py-2">rustc</td>
                <td className="px-3 py-2 font-mono">1.85.0</td>
              </tr>
              <tr className="text-zinc-600 border-b border-zinc-800">
                <td className="px-3 py-2">Zig</td>
                <td className="px-3 py-2">zig</td>
                <td className="px-3 py-2 font-mono">0.16.0</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">System Status</h2>

          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-b border-zinc-800">
                <td className="px-3 py-2 text-zinc-400">Judge Nodes</td>
                <td className="px-3 py-2 font-mono text-red-400">Offline</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="px-3 py-2 text-zinc-400">Average Queue Time</td>
                <td className="px-3 py-2 font-mono">TIMEOUT</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-zinc-400">Last Outage</td>
                <td className="px-3 py-2 font-mono">{new Date().toISOString()}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>

      <aside className="space-y-8">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Top Coders
          </div>
          <ul className="divide-y divide-zinc-800">
            {topCoders.map((c: any, i: number) => (
              <li key={c.user} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-zinc-200">
                  {i + 1}. {c.user}
                </span>
                <span className="font-mono text-zinc-400">{c.solved}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Recent Submissions
          </div>
          <ul className="divide-y divide-zinc-800">
            {recentSubmissions.map((s: any) => (
              <li key={s.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <Link to={`/submissions/${s.id}`} className="font-mono text-zinc-300 hover:text-zinc-100">
                    {s.id}
                  </Link>
                  <span className={`font-mono ${s.color}`}>{s.result}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {s.user} · {s.problem}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Submission Results
          </div>
          <ul className="divide-y divide-zinc-800">
            <li className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-mono text-emerald-400">AC</span>
              <span className="text-zinc-400">Accepted</span>
            </li>

            <li className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-mono text-rose-400">WA</span>
              <span className="text-zinc-400">Wrong Answer</span>
            </li>

            <li className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-mono text-purple-400">TLE</span>
              <span className="text-zinc-400">Time Limit Exceeded</span>
            </li>

            <li className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-mono text-pink-400">MLE</span>
              <span className="text-zinc-400">Memory Limit Exceeded</span>
            </li>

            <li className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-mono text-cyan-400">RE</span>
              <span className="text-zinc-400">Runtime Error</span>
            </li>

            <li className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-mono text-sky-400">SIG</span>
              <span className="text-zinc-400">Terminated by Signal</span>
            </li>

            <li className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-mono text-yellow-400">CE</span>
              <span className="text-zinc-400">Compile Error</span>
            </li>

            <li className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-mono text-zinc-400">RNG</span>
              <span className="text-zinc-400">Running</span>
            </li>

            <li className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-mono text-zinc-400">IE</span>
              <span className="text-zinc-400">Internal Error</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
