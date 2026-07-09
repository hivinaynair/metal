import { serve } from "@hono/node-server"
import app from "./app.js"
import { env } from "./env.js"

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`Metal facilitator running on http://localhost:${env.PORT}`)
})
