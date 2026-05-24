import { Outlet, useLoaderData, useNavigate, useSearchParams } from 'react-router';

// TODO: replace fake data with API calling
// TODO: add types
export const loader = async () => ({
  id: '1',
  title: 'HIIT Open 2025',
  flavor: 'ICPC',
  registrability: 'Public',
  timeLeft: '1h 18m Left',
  action: { label: 'Registered', disabled: true },
});

export default function Contest() {
  const { id, title, flavor, registrability, timeLeft, action } = useLoaderData();
  const navigate = useNavigate();

  const [params] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold text-zinc-100">{title}</h1>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-zinc-400">
            <span className="font-mono text-zinc-200">{flavor}</span>
            <span className="mx-2">•</span>
            <span>{registrability}</span>
            <span className="mx-2">•</span>
            <span>{timeLeft}</span>
          </div>

          <div className="ml-auto">
            <button
              disabled={action.disabled}
              className={`h-9 rounded-md px-4 text-sm font-medium ${
                action.disabled
                  ? 'cursor-not-allowed bg-zinc-800 text-zinc-500'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
              type="button">
              {action.label}
            </button>
          </div>
        </div>
      </header>

      <nav className="flex gap-6 border-b border-zinc-800 text-sm">
        {['overview', 'problems', 'submissions', 'scoreboard'].map((k) => (
          <button
            key={k}
            onClick={() => navigate({ pathname: `/contests/${id}`, search: `?tab=${k}` })}
            className={`pb-2 ${
              tab === k ? 'border-b-2 border-blue-500 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            type="button">
            {k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
