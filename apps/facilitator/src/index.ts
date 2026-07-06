import { serve } from "@hono/node-server"
import app from "./app.ts"
import { env } from "./lib/env.ts"

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`Metal facilitator running on http://localhost:${env.PORT}`)
})
