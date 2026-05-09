import { createServer } from "./server.ts"

const server = createServer()

try {
  await server.listen({ port: 4000 })
} catch (err) {
  server.log.error(err)

  process.exit(1)
}
