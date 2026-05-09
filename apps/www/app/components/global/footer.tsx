import { Link } from "react-router"

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-zinc-800">
      <div className="mx-auto max-w-6xl px-4 py-4 text-sm text-zinc-500">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span>&copy; {new Date().getFullYear()} Yu-huan Kuo et al.</span>
            <span className="hidden sm:inline">·</span>
            <Link to="https://github.com/rnmeow/yato-judge/blob/master/LICENSE" className="hover:text-zinc-300">
              Apache 2.0
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link to="https://github.com/rnmeow/yato-judge" className="hover:text-zinc-300" target="_blank">
              GitHub
            </Link>
            <span className="font-mono text-zinc-600">v0.0.0-testing</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
