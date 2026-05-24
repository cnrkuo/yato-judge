import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Link, useLoaderData } from 'react-router';

export const meta = () => [{ title: 'Collections – YATO Judge' }];

// TODO: replace fake data with API calling
// TODO: add types
export const loader = async () => ({
  collections: [
    {
      id: 1,
      title: 'Collection #1',
      description: 'Collection for beginners',
      solved: 8,
      total: 12,
      difficulty: 'E–M',
    },
    {
      id: 2,
      title: 'Collection #2',
      description: 'Collection for beginners',
      solved: 3,
      total: 10,
      difficulty: 'M–H',
    },
    {
      id: 3,
      title: 'Collection #3',
      description: 'Collection for beginners',
      solved: 0,
      total: 15,
      difficulty: 'M–H',
    },
    {
      id: 4,
      title: 'Collection #4',
      description: 'Collection for beginners',
      solved: 1,
      total: 14,
      difficulty: 'H–I',
    },
  ],
});

export default function Collections() {
  const { collections } = useLoaderData();

  const table = useReactTable({
    data: collections,
    columns: [
      {
        header: 'ID',
        accessorKey: 'id',
        cell: (info: any) => <span className="font-mono text-zinc-400">{info.getValue()}</span>,
      },
      {
        header: 'Title',
        accessorKey: 'title',
        cell: (info: any) => {
          const row = info.row.original;
          return (
            <div className="flex flex-col">
              <Link to={`/collections/${row.id}`} className="text-zinc-100 hover:underline">
                {row.title}
              </Link>
              <span className="text-xs text-zinc-500">{row.description}</span>
            </div>
          );
        },
      },
      {
        header: 'Progress',
        cell: (info: any) => {
          const { solved, total } = info.row.original;
          const ratio = Math.round((solved / total) * 100);

          return (
            <div className="flex flex-col text-xs">
              <span className="font-mono text-zinc-300">
                {solved} / {total}
              </span>
              <span className="text-zinc-500">{ratio}%</span>
            </div>
          );
        },
      },
      {
        header: 'Problems',
        accessorKey: 'total',
        cell: (info: any) => <span className="font-mono text-zinc-300">{info.getValue()}</span>,
      },
      {
        header: 'Difficulty',
        accessorKey: 'difficulty',
        cell: (info: any) => (
          <span className="inline-flex items-center rounded-md border border-zinc-700 px-2 py-0.5 text-xs font-mono text-zinc-300">
            {info.getValue()}
          </span>
        ),
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
                <td key={cell.id} className="px-3 py-2 text-zinc-200">
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
