import { Link, useLocation } from "react-router"

export default function Header() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center px-4">
        {pathname === "/" ? (
          <span className="select-none hover:cursor-not-allowed">🦆</span>
        ) : (
          <button
            className="hover:cursor-pointer"
            onClick={() => {
              window.location.href = "/"
            }}
            type="button"
            aria-label="回到首頁">
            🦆
          </button>
        )}

        <nav className="ml-6 flex items-center gap-4 text-zinc-400">
          <Link to="/problems" className="hover:text-zinc-200">
            Problems
          </Link>
          <Link to="/collections" className="hover:text-zinc-200">
            Collections
          </Link>
          <Link to="/submissions" className="hover:text-zinc-200">
            Submissions
          </Link>
          <Link to="/contests" className="hover:text-zinc-200">
            Contests
          </Link>
          <Link to="/ranking" className="hover:text-zinc-200">
            Ranking
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <Link to="/signup" className="text-zinc-500 hover:text-zinc-200">
            Sign up
          </Link>
          <Link to="/login" className="text-zinc-500 hover:text-zinc-200">
            Login
          </Link>
        </div>
      </div>
    </header>
  )
}
