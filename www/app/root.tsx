import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router"

import "@fontsource-variable/public-sans"
import "@fontsource-variable/inter-tight"

import "./app.css"

import Footer from "@/components/global/footer"
import Header from "@/components/global/header"

import type { Route } from "./+types/root"

export const links: Route.LinksFunction = () => [
  { rel: "preload", href: "/1f986.svg", as: "image" },
  { rel: "manifest", href: "/.vite/manifest.json" },
  { rel: "icon", type: "image/svg+xml", href: "/1f986.svg" }, // Twemoji U+1F986 duck emoji
  { rel: "icon", type: "image/png", href: "/favicon-96x96.png", sizes: "96x96" },
  { rel: "shortcut icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
]

export function Layout({ children }: { children: React.ReactElement }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="renderer" content="webkit" />
        <meta name="force-rendering" content="webkit" />
        <meta name="google" content="notranslate" />
        <meta name="theme-color" content="#09090b" />
        <meta name="msapplication-TileColor" content="#09090b" />
        <Meta />
        <Links />
      </head>
      <body className="font-normal scheme-dark bg-zinc-950">
        <div className="min-h-screen text-zinc-100">
          <Header />
          <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
          <Footer />
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!"
  let details = "An unexpected error occurred."
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error"
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
