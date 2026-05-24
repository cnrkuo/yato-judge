import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Link, useLoaderData } from 'react-router';

export const meta = () => [{ title: 'Ranking – YATO Judge' }];

// TODO: replace fake data with API calling
// TODO: add types
export const loader = async () => {
  const lastActive = new Date().toISOString().slice(0, 10);

  return {
    data: [
      {
        rank: 1,
        username: 'alice',
        avatar: 'https://api.dicebear.com/9.x/identicon/svg?seed=alice',
        solved: 777,
        rating: 2486,
        lastActive,
      },
      {
        rank: 2,
        username: 'bob',
        avatar: 'https://api.dicebear.com/9.x/identicon/svg?seed=bob',
        solved: 666,
        rating: 2000,
        lastActive,
      },
      {
        rank: 3,
        username: 'charlie',
        avatar: 'https://api.dicebear.com/9.x/identicon/svg?seed=charlie',
        solved: 555,
        rating: 1600,
        lastActive,
      },
      {
        rank: 4,
        username: 'diana',
        avatar: 'https://api.dicebear.com/9.x/identicon/svg?seed=diana',
        solved: 444,
        rating: 1200,
        lastActive,
      },
      {
        rank: 5,
        username: 'eve',
        avatar: 'https://api.dicebear.com/9.x/identicon/svg?seed=eve',
        solved: 333,
        rating: 800,
        lastActive,
      },
    ],
  };
};

export default function Ranking() {
  const { data } = useLoaderData();

  const table = useReactTable({
    data,
    columns: [
      {
        header: 'Rank',
        accessorKey: 'rank',
        cell: (info: any) => <span className="font-mono text-zinc-400">#{info.getValue()}</span>,
      },
      {
        header: 'User',
        accessorKey: 'username',
        cell: (info: any) => {
          const row = info.row.original;

          return (
            <div className="flex items-center gap-3">
              <img src={row.avatar} alt={row.username} className="h-7 w-7 rounded-full border border-zinc-700" />
              <Link to={`/users/${row.username}`} className="text-zinc-100 hover:underline">
                {row.username}
              </Link>
            </div>
          );
        },
      },
      {
        header: 'Solved',
        accessorKey: 'solved',
        cell: (info: any) => <span className="font-mono text-zinc-300">{info.getValue()}</span>,
      },
      {
        header: 'Rating',
        accessorKey: 'rating',
        cell: (info: any) => <span className="font-mono text-zinc-400">{info.getValue()}</span>,
      },
      {
        header: 'Last Active',
        accessorKey: 'lastActive',
        cell: (info: any) => <span className="font-mono text-zinc-500">{info.getValue()}</span>,
      },
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="relative overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="bg-zinc-900/80 border-b border-zinc-800">
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
