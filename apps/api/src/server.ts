import fastify from "fastify"

export function createServer() {
  const app = fastify({ logger: true })

  app.get("/", async () => {
    return { hello: "fastify" }
  })

  return app
}
