import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { Link, useLoaderData } from "react-router"

export function meta() {
  return [{ title: "Contests – YATO Judge" }]
}

export const loader = async () => [
  {
    id: 4,
    title: "Datatähti 2026 loppu",
    status: "Running",
    startTime: "2026-01-09 12:00:00",
    duration: "2h",
    participants: 67,
  },
  {
    id: 3,
    title: "HIIT Open 2025",
    status: "Upcoming",
    startTime: "2025-11-08 17:00:00",
    duration: "1.5h",
    participants: 67,
  },
  {
    id: 2,
    title: "Datatähti 2026 alku",
    status: "Finished",
    startTime: "2026-01-18 17:00:00",
    duration: "3h",
    participants: 67,
  },
  {
    id: 1,
    title: "Datatähti 2025 loppu",
    status: "Finished",
    startTime: "2025-10-27 00:00:00",
    duration: "2.5h",
    participants: 67,
  },
]

export default function Contests() {
  const data = useLoaderData()

  const statusBadge = {
    Upcoming: "bg-sky-950/40 text-sky-400 border border-sky-900/50",
    Running: "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50",
    Finished: "bg-zinc-900 text-zinc-500 border border-zinc-700",
  }

  const table = useReactTable({
    data,
    columns: [
      {
        header: "ID",
        accessorKey: "id",
        cell: (info: any) => <span className={`font-mono text-zinc-400`}>{info.getValue()}</span>,
      },
      {
        header: "Title",
        accessorKey: "title",
        cell: (info: any) => (
          <Link to={`/contests/${info.row.original.id}`} className="text-zinc-100 hover:underline">
            {info.getValue()}
          </Link>
        ),
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: (info: any) => (
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-mono ${
              statusBadge[info.getValue()]
            }`}>
            {info.getValue()}
          </span>
        ),
      },
      {
        header: "Start Time",
        accessorKey: "startTime",
        cell: (info: any) => <span className="font-mono text-zinc-300">{info.getValue()}</span>,
      },
      {
        header: "Duration",
        accessorKey: "duration",
        cell: (info: any) => <span className="font-mono text-zinc-300">{info.getValue()}</span>,
      },
      {
        header: "Participants",
        accessorKey: "participants",
        cell: (info: any) => <span className="font-mono text-zinc-400">{info.getValue()}</span>,
      },
    ],
    getCoreRowModel: getCoreRowModel(),
  })

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
  )
}
