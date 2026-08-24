const STALE_SERVER_ACTION_MESSAGE = 'Failed to find Server Action'

export const STALE_SERVER_ACTION_RELOAD_KEY = 'notewise:stale-server-action-reload'
export const STALE_SERVER_ACTION_GUARD_MS = 8_000

export function isServerActionRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers = new Headers(init?.headers)

  if (input instanceof Request) {
    input.headers.forEach((value, key) => headers.set(key, value))
  }

  return headers.has('next-action')
}

export function isStaleServerActionText(value: unknown): boolean {
  if (typeof value !== 'string') return false

  return (
    value.includes(STALE_SERVER_ACTION_MESSAGE) ||
    value.includes('failed-to-find-server-action')
  )
}

export function isStaleServerActionResponse(status: number, body: string): boolean {
  if (![303, 404, 500].includes(status)) return false

  return isStaleServerActionText(body)
}

export function isStaleServerActionError(error: unknown): boolean {
  if (error instanceof Error) {
    return isStaleServerActionText(`${error.name}: ${error.message}\n${error.stack ?? ''}`)
  }

  return isStaleServerActionText(String(error))
}
