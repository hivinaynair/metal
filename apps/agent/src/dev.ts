import { startServer } from "./server.js"

startServer()
process.on("SIGINT", () => process.exit(0))
