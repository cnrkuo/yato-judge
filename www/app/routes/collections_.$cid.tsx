import { Link, useLoaderData } from "react-router"

export const meta = () => [{ title: "Collection – YATO Judge" }]

// TODO: replace fake data with API calling
// TODO: add types
export const loader = async () => ({
  problems: [1, 2, 3, 4, 5, 6],
  data: [
    {
      rank: 1,
      username: "json",
      totalScore: 600,
      solved: 6,
      problems: [
        { problemId: 1, score: 100, attempts: 2 },
        { problemId: 2, score: 100, attempts: 1 },
        { problemId: 3, score: 100, attempts: 1 },
        { problemId: 4, score: 100, attempts: 1 },
        { problemId: 5, score: 100, attempts: 4 },
        { problemId: 6, score: 100, attempts: 1 },
      ],
    },
    {
      rank: 2,
      username: "yaml",
      totalScore: 500,
      solved: 5,
      problems: [
        { problemId: 1, score: 100, attempts: 1 },
        { problemId: 2, score: 100, attempts: 1 },
        { problemId: 3, score: 100, attempts: 2 },
        { problemId: 4, score: 100, attempts: 3 },
        { problemId: 5, score: 100, attempts: 2 },
        { problemId: 6, score: 0, attempts: 0 },
      ],
    },
    {
      rank: 3,
      username: "toml",
      totalScore: 300,
      solved: 3,
      problems: [
        { problemId: 1, score: 100, attempts: 4 },
        { problemId: 2, score: 0, attempts: 2 },
        { problemId: 3, score: 100, attempts: 1 },
        { problemId: 4, score: 0, attempts: 0 },
        { problemId: 5, score: 100, attempts: 3 },
        { problemId: 6, score: 0, attempts: 0 },
      ],
    },
  ],
})

export default function Collection() {
  const { data, problems } = useLoaderData()

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Intro to Algorithms</h1>
        <p className="text-sm text-neutral-400">Scoreboard · cumulative progress</p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-neutral-900/80 text-xs uppercase text-neutral-400">
              <th className="px-3 py-2 text-left">Rank</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-right">Solved</th>

              {problems.map((pid) => (
                <th key={pid} className="px-3 py-2 text-center font-mono">
                  {pid}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.map((row) => (
              <tr key={row.username} className="hover:bg-neutral-900/60">
                <td className="px-3 py-2 text-sm border-b border-neutral-800 text-left">{row.rank}</td>
                <td className="px-3 py-2 text-sm border-b border-neutral-800 text-left">
                  <Link to={`/users/${row.username}`} className="text-neutral-100 hover:underline">
                    {row.username}
                  </Link>
                </td>
                <td className="px-3 py-2 text-sm border-b border-neutral-800 text-right font-mono">{row.totalScore}</td>
                <td className="px-3 py-2 text-sm border-b border-neutral-800 text-right font-mono">{row.solved}</td>

                {row.problems.map((p) => (
                  <td key={p.problemId} className="px-3 py-2 text-center text-sm border-b border-neutral-800">
                    {p.score === 100 ? (
                      <div className="text-emerald-400 font-mono">
                        100
                        <span className="ml-1 text-xs text-neutral-500">/{p.attempts}</span>
                      </div>
                    ) : (
                      <div className="text-neutral-600 font-mono">—</div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
