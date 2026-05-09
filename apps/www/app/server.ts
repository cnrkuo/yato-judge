import { Hono } from "hono"
import { RegExpRouter } from "hono/router/reg-exp-router"
import { createHonoServer } from "react-router-hono-server/node"

const app = new Hono({
  strict: false,
  router: new RegExpRouter(),
})

export default createHonoServer({ app })
