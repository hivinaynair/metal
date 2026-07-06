import { existsSync, readFileSync, writeFileSync } from "fs"
import { resolve } from "path"

// Navigate from apps/agent/src/lib/ up to the monorepo root where .env.local lives.
// This is stable regardless of which directory the process is started from.
const ENV_PATH = resolve(import.meta.dirname, "../../../../.env.local")

export function setEnvVar(key: string, value: string): void {
  let contents = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : ""
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*`, "m")
  contents = re.test(contents)
    ? contents.replace(re, line)
    : contents
      ? `${contents.trimEnd()}\n${line}\n`
      : `${line}\n`
  writeFileSync(ENV_PATH, contents)
}
