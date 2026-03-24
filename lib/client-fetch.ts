const getSignInRedirectUrl = (): string => {
  if (typeof window === 'undefined') {
    return '/sign-in'
  }

  const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  return `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
}

export const redirectToSignIn = (): void => {
  if (typeof window === 'undefined') {
    return
  }

  if (window.location.pathname.startsWith('/sign-in')) {
    return
  }

  window.location.assign(getSignInRedirectUrl())
}

export const fetchWithAuthRedirect = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const response = await fetch(input, init)

  if (response.status === 401) {
    redirectToSignIn()
    throw new Error('Unauthorized')
  }

  return response
}

export const fetchJsonWithAuthRedirect = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> => {
  const response = await fetchWithAuthRedirect(input, init)

  if (!response.ok) {
    let message = 'Falha ao carregar dados'

    try {
      const errorBody = (await response.json()) as { error?: string }
      if (errorBody?.error) {
        message = errorBody.error
      }
    } catch {}

    throw new Error(message)
  }

  return response.json() as Promise<T>
}
