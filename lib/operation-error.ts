export type OperationErrorCategory =
  | 'validation'
  | 'authorization'
  | 'conflict'
  | 'rate_limit'
  | 'upstream'
  | 'internal'

export type OperationError = {
  code: string
  category: OperationErrorCategory
  message: string
  hint?: string
  retryable: boolean
  invalidFields?: string[]
}

export type OperationErrorResponseOptions = {
  status?: number
  extra?: Record<string, unknown>
}

const defaultStatusByCategory: Record<OperationErrorCategory, number> = {
  validation: 400,
  authorization: 401,
  conflict: 409,
  rate_limit: 429,
  upstream: 502,
  internal: 500,
}

export function toOperationError(
  error: unknown,
  fallback: Pick<OperationError, 'code' | 'message'> & Partial<Pick<OperationError, 'hint'>>
): OperationError {
  if (isOperationError(error)) return error

  return {
    code: fallback.code,
    category: 'internal',
    message: fallback.message,
    ...(fallback.hint ? { hint: fallback.hint } : {}),
    retryable: false,
  }
}

export function operationErrorResponse(
  error: OperationError,
  options: OperationErrorResponseOptions = {}
): Response {
  return Response.json(
    {
      error: error.message,
      code: error.code,
      category: error.category,
      retryable: error.retryable,
      ...(error.hint ? { hint: error.hint } : {}),
      ...(error.invalidFields ? { invalidFields: error.invalidFields } : {}),
      ...options.extra,
    },
    { status: options.status ?? defaultStatusByCategory[error.category] }
  )
}

export function unauthorizedError(): OperationError {
  return {
    code: 'UNAUTHORIZED',
    category: 'authorization',
    message: 'Unauthorized',
    retryable: false,
  }
}

export function validationError(
  code: string,
  message: string,
  invalidFields?: string[]
): OperationError {
  return {
    code,
    category: 'validation',
    message,
    retryable: false,
    ...(invalidFields ? { invalidFields } : {}),
  }
}

function isOperationError(error: unknown): error is OperationError {
  if (!error || typeof error !== 'object') return false
  const candidate = error as Partial<OperationError>
  return typeof candidate.code === 'string'
    && typeof candidate.message === 'string'
    && typeof candidate.category === 'string'
    && typeof candidate.retryable === 'boolean'
}
