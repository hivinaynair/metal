import { handle } from "hono/vercel"
import app from "./app.ts"

// Vercel Serverless Function entry - exports the Hono fetch handler.
// The local dev server (src/index.ts) uses @hono/node-server instead.
export const config = { runtime: "nodejs" }
export default handle(app)
