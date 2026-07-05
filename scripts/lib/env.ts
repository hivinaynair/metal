import { existsSync, readFileSync, writeFileSync } from "fs"
import { resolve } from "path"

const ENV_PATH = resolve(process.cwd(), ".env.local")

export function readEnv(): string {
  return existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : ""
}

export function setEnvVar(key: string, value: string): void {
  let contents = readEnv()
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*`, "m")
  contents = re.test(contents)
    ? contents.replace(re, line)
    : contents
      ? `${contents.trimEnd()}\n${line}\n`
      : `${line}\n`
  writeFileSync(ENV_PATH, contents)
}
