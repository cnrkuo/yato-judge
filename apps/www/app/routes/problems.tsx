import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Link, useLoaderData } from 'react-router';

export const meta = () => [{ title: 'Problems – YATO Judge' }];

// TODO: replace fake data with API calling
// TODO: add types
export const loader = async () => ({
  problems: [
    { id: 1, myStatus: 'AC', title: 'Weird Algorithm', difficulty: 'E', userAcceptance: 95, submissionAcceptance: 92 },
    { id: 2, myStatus: 'AC', title: 'Missing Number', difficulty: 'E', userAcceptance: 94, submissionAcceptance: 90 },
    { id: 3, myStatus: 'AC', title: 'Repetitions', difficulty: 'E', userAcceptance: 93, submissionAcceptance: 89 },
    { id: 4, myStatus: 'AC', title: 'Increasing Array', difficulty: 'E', userAcceptance: 92, submissionAcceptance: 88 },
    { id: 5, myStatus: '—', title: 'Permutations', difficulty: 'E', userAcceptance: 90, submissionAcceptance: 85 },
    { id: 6, myStatus: '—', title: 'Number Spiral', difficulty: 'E', userAcceptance: 89, submissionAcceptance: 84 },
    { id: 7, myStatus: '—', title: 'Two Knights', difficulty: 'E', userAcceptance: 88, submissionAcceptance: 83 },
    { id: 8, myStatus: '—', title: 'Two Sets', difficulty: 'E', userAcceptance: 87, submissionAcceptance: 82 },
    { id: 9, myStatus: 'AC', title: 'Bit Strings', difficulty: 'E', userAcceptance: 91, submissionAcceptance: 86 },
    { id: 10, myStatus: '—', title: 'Trailing Zeros', difficulty: 'E', userAcceptance: 86, submissionAcceptance: 80 },
    { id: 11, myStatus: '—', title: 'Coin Piles', difficulty: 'E', userAcceptance: 85, submissionAcceptance: 79 },
    {
      id: 12,
      myStatus: '—',
      title: 'Palindrome Reorder',
      difficulty: 'E',
      userAcceptance: 84,
      submissionAcceptance: 78,
    },
    { id: 13, myStatus: '—', title: 'Gray Code', difficulty: 'E', userAcceptance: 83, submissionAcceptance: 77 },
    { id: 14, myStatus: '—', title: 'Tower of Hanoi', difficulty: 'E', userAcceptance: 82, submissionAcceptance: 76 },
    { id: 15, myStatus: '—', title: 'Creating Strings', difficulty: 'E', userAcceptance: 81, submissionAcceptance: 75 },
    { id: 16, myStatus: '—', title: 'Apple Division', difficulty: 'E', userAcceptance: 80, submissionAcceptance: 74 },
  ],
});

export default function Problems() {
  const { problems } = useLoaderData();

  const table = useReactTable({
    data: problems,
    columns: [
      {
        header: 'ID',
        accessorKey: 'id',
        cell: (info: any) => <span className="font-mono text-zinc-400">{info.getValue()}</span>,
      },
      {
        header: 'Status',
        accessorKey: 'myStatus',
        cell: (info: any) =>
          info.getValue() === 'AC' ? (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-emerald-400 text-emerald-950">
              ✓
            </span>
          ) : (
            <span className="text-zinc-500">—</span>
          ),
      },
      {
        header: 'Title',
        accessorKey: 'title',
        cell: (info: any) => (
          <Link to={`/problems/${info.row.original.id}`} className="text-blue-400 hover:underline">
            {info.getValue()}
          </Link>
        ),
      },
      {
        header: 'Difficulty',
        accessorKey: 'difficulty',
        cell: (info: any) => <span className="font-mono text-zinc-300">{info.getValue()}</span>,
      },
      {
        header: 'User AC%',
        accessorKey: 'userAcceptance',
        cell: (info: any) => <span className="font-mono text-zinc-300">{info.getValue()}%</span>,
      },
      {
        header: 'Sub AC%',
        accessorKey: 'submissionAcceptance',
        cell: (info: any) => <span className="font-mono text-zinc-500">{info.getValue()}%</span>,
      },
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-zinc-900/80 text-zinc-400">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} className="px-3 py-2 text-left text-xs uppercase">
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
