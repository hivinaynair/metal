import { startServer } from "./server.ts"

startServer()
process.on("SIGINT", () => process.exit(0))
