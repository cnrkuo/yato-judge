import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Link, useLoaderData } from 'react-router';

export const meta = () => [{ title: 'Problems – YATO Judge' }];

// TODO: replace fake data with API calling
// TODO: add types
export const loader = async () => ({
  submissions: [
    {
      id: 'V2S175CT',
      problemId: 1,
      problem: 'Weird Algorithm',
      user: 'alice',
      language: 'C++ (C++23)',
      result: 'AC',
      time: '1 ms',
      memory: '1.2 MB',
    },
    {
      id: '0RM88WLU',
      problemId: 2,
      problem: 'Missing Number',
      user: 'bob',
      language: 'Python',
      result: 'TLE',
      time: '1000 ms',
      memory: '—',
    },
    {
      id: 'FVHVEY6V',
      problemId: 3,
      problem: 'Repetitions',
      user: 'charlie',
      language: 'Rust',
      result: 'WA',
      time: '34 ms',
      memory: '2.8 MB',
    },
    {
      id: 'MQBVZ186',
      problemId: 4,
      problem: 'Increasing Array',
      user: 'diana',
      language: 'C++ (C++17)',
      result: 'CE',
      time: '—',
      memory: '—',
    },
  ],
});

export default function Submissions() {
  const { submissions } = useLoaderData();

  const table = useReactTable({
    data: submissions,
    columns: [
      {
        header: 'Submission ID',
        accessorKey: 'id',
        cell: (info: any) => (
          <Link to={`/submissions/${info.getValue()}`} className="font-mono text-zinc-400 hover:underline">
            {info.getValue()}
          </Link>
        ),
      },
      {
        header: 'Problem ID',
        accessorKey: 'problemId',
        cell: (info: any) => <span className="font-mono text-zinc-400">{info.getValue()}</span>,
      },
      {
        header: 'Problem',
        accessorKey: 'problem',
        cell: (info: any) => <span className="text-zinc-100">{info.getValue()}</span>,
      },
      {
        header: 'User',
        accessorKey: 'user',
        cell: (info: any) => <span className="text-zinc-300">{info.getValue()}</span>,
      },
      {
        header: 'Lang',
        accessorKey: 'language',
        cell: (info: any) => <span className="font-mono text-zinc-300">{info.getValue()}</span>,
      },
      {
        header: 'Result',
        accessorKey: 'result',
        cell: (info: any) => {
          const v = info.getValue();
          const color: Record<string, string> = {
            AC: 'text-emerald-400',
            WA: 'text-rose-400',
            TLE: 'text-purple-400',
            CE: 'text-amber-400',
          };
          return <span className={`font-mono ${color[v] ?? 'text-zinc-400'}`}>{v}</span>;
        },
      },
      {
        header: 'Time',
        accessorKey: 'time',
        cell: (info: any) => <span className="font-mono text-zinc-300">{info.getValue()}</span>,
      },
      {
        header: 'Memory',
        accessorKey: 'memory',
        cell: (info: any) => <span className="font-mono text-zinc-300">{info.getValue()}</span>,
      },
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-zinc-900/80">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="border-b border-zinc-800">
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-zinc-800 hover:bg-zinc-900/60">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 whitespace-nowrap text-zinc-200">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
