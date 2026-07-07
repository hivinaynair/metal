import { AsyncLocalStorage } from "node:async_hooks"

export interface RequestContext {
  mandateJson?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export const requestCtx = {
  run<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
    return storage.run(ctx, fn)
  },
  get(): RequestContext {
    return storage.getStore() ?? {}
  },
}
