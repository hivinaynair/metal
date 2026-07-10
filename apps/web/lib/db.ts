import { createDb } from "@workspace/db"

let _db: ReturnType<typeof createDb> | undefined
export function getDb() {
  if (!_db) _db = createDb()
  return _db
}
