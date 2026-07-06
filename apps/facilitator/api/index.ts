import app from "../src/app.ts"

// Vercel Serverless Function entry — exports the Hono fetch handler.
// The local dev server (src/index.ts) uses @hono/node-server instead.
export default app.fetch
