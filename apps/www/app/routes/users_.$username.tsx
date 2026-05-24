import { Link, useLoaderData } from 'react-router';

export const meta = () => [{ title: 'User – YATO Judge' }];

// TODO: replace fake data with API calling
// TODO: add types
export const loader = async () => {
  const user = {
    username: 'rnduser114514',
    displayName: 'Random',
    avatarUrl: '',
    joinedAt: new Date().toISOString(),
    bio: 'Lorem ipsum dolor sit amet.',
    stats: {
      rating: 6767,
      globalRank: 67,
      contests: 67,
      submissions: 67,
      accepted: 67,
    },
  };

  const recentSubmissions = [
    { id: 'QLH7QBWT', problem: 'Example', verdict: 'AC', time: new Date().toISOString() },
    { id: 'HSTAPSUI', problem: 'Example', verdict: 'WA', time: new Date().toISOString() },
    { id: 'NT3TYYQP', problem: 'Example', verdict: 'TLE', time: new Date().toISOString() },
  ];

  const recentContests = [
    { id: 7, title: 'HIIT Open 2025', rank: 12 },
    { id: 5, title: 'Datatähti 2026 loppu', rank: 3 },
  ];

  const problems = Array.from({ length: 100 }, (_, i) => {
    const rnd = Math.random();

    return { id: i + 1, status: rnd < 0.33 ? 'ac' : rnd < 0.67 ? 'attempted' : 'untried' };
  });

  const total = problems.length;
  const acCount = problems.filter((p) => p.status === 'ac').length;
  const attemptedCount = problems.filter((p) => p.status === 'attempted').length;
  const untriedCount = total - acCount - attemptedCount;

  return {
    user,
    recentSubmissions,
    recentContests,
    problems,
    total,
    acCount,
    attemptedCount,
    untriedCount,
  };
};

export default function User() {
  const { user, recentSubmissions, recentContests, problems, total, acCount, attemptedCount, untriedCount } =
    useLoaderData();

  return (
    <div className="space-y-10">
      <header className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-zinc-500">
              {user.displayName[0]}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-zinc-100">{user.displayName}</h1>
          <div className="text-sm text-zinc-400">
            <span className="font-mono">@{user.username}</span>
            <span className="mx-2">•</span>
            <span>Joined {user.joinedAt}</span>
          </div>
        </div>
      </header>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
          <div>
            <dt className="text-xs uppercase text-zinc-400">Rating</dt>
            <dd className="mt-1 font-mono text-zinc-200">{user.stats.rating}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-400">Global Rank</dt>
            <dd className="mt-1 font-mono text-zinc-200">#{user.stats.globalRank}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-400">Contests</dt>
            <dd className="mt-1 font-mono text-zinc-200">{user.stats.contests}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-400">Submissions</dt>
            <dd className="mt-1 font-mono text-zinc-200">{user.stats.submissions}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-400">Accepted</dt>
            <dd className="mt-1 font-mono text-zinc-200">{user.stats.accepted}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-100">About</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-200">{user.bio}</div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Recent Submissions</h2>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/80 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Problem</th>
                  <th className="px-3 py-2 text-left">Verdict</th>
                  <th className="px-3 py-2 text-left">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSubmissions.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-800 hover:bg-zinc-900/50">
                    <td className="px-3 py-2 font-mono">
                      <Link to={`/submissions/${s.id}`} className="hover:underline">
                        {s.id}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{s.problem}</td>
                    <td className="px-3 py-2 font-mono">{s.verdict}</td>
                    <td className="px-3 py-2 font-mono text-zinc-400">{s.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Recent Contests</h2>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/80 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-left">Contest</th>
                  <th className="px-3 py-2 text-right">Rank</th>
                </tr>
              </thead>
              <tbody>
                {recentContests.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-800 hover:bg-zinc-900/50">
                    <td className="px-3 py-2">
                      <Link to={`/contests/${c.id}`} className="text-blue-400 hover:underline">
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{c.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-100">Problem Completion</h2>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
          <div className="space-y-1">
            <div className="flex h-3 w-full overflow-hidden rounded bg-zinc-800">
              <div className="bg-emerald-500/80" style={{ width: `${(acCount / total) * 100}%` }} />
              <div className="bg-yellow-500/40" style={{ width: `${(attemptedCount / total) * 100}%` }} />
            </div>

            <div className="flex justify-between text-xs text-zinc-400 font-mono">
              <span>
                {acCount} / {total} solved
              </span>
              <span>{attemptedCount} attempted</span>
              <span>{untriedCount} untried</span>
            </div>
          </div>

          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(2rem,1fr))]">
            {problems.map((p) => (
              <div
                key={p.id}
                title={`Problem ${p.id}`}
                className={`flex h-8 items-center justify-center rounded text-xs font-mono ${
                  p.status === 'ac'
                    ? 'bg-emerald-500/80 text-emerald-950'
                    : p.status === 'attempted'
                      ? 'bg-yellow-500/30 text-yellow-200'
                      : 'bg-zinc-800 text-zinc-500'
                }`}>
                {p.id}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
