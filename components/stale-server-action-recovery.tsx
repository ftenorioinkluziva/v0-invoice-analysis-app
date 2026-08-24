'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  isServerActionRequest,
  isStaleServerActionError,
  isStaleServerActionResponse,
  STALE_SERVER_ACTION_GUARD_MS,
  STALE_SERVER_ACTION_RELOAD_KEY,
} from '@/lib/stale-server-action'

const RELOAD_DELAY_MS = 700

function hasRecentRecoveryAttempt(): boolean {
  try {
    const timestamp = Number(sessionStorage.getItem(STALE_SERVER_ACTION_RELOAD_KEY))

    if (!Number.isFinite(timestamp)) return false
    if (Date.now() - timestamp < STALE_SERVER_ACTION_GUARD_MS) return true

    sessionStorage.removeItem(STALE_SERVER_ACTION_RELOAD_KEY)
  } catch {
    // Storage may be unavailable in privacy-restricted browsers.
  }

  return false
}

function markRecoveryAttempt(): void {
  try {
    sessionStorage.setItem(STALE_SERVER_ACTION_RELOAD_KEY, String(Date.now()))
  } catch {
    // The in-memory guard still prevents a reload cascade in this tab.
  }
}

export function StaleServerActionRecovery() {
  const recoveryStarted = useRef(false)

  useEffect(() => {
    const recover = () => {
      if (recoveryStarted.current) return
      recoveryStarted.current = true

      if (hasRecentRecoveryAttempt()) {
        toast.error('A atualização automática não resolveu. Recarregue a página manualmente.')
        recoveryStarted.current = false
        return
      }

      markRecoveryAttempt()
      toast.info('Nova versão disponível — atualizando...', { duration: RELOAD_DELAY_MS })
      window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS)
    }

    const originalFetch = window.fetch
    const interceptedFetch: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init)

      if (isServerActionRequest(input, init) && [303, 404, 500].includes(response.status)) {
        void response
          .clone()
          .text()
          .then((body) => {
            if (isStaleServerActionResponse(response.status, body)) recover()
          })
          .catch(() => undefined)
      }

      return response
    }

    window.fetch = interceptedFetch

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isStaleServerActionError(event.reason)) recover()
    }
    const handleWindowError = (event: ErrorEvent) => {
      if (isStaleServerActionError(event.error ?? event.message)) recover()
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleWindowError)

    return () => {
      if (window.fetch === interceptedFetch) window.fetch = originalFetch
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleWindowError)
    }
  }, [])

  return null
}
