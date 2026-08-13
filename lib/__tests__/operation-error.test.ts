import { describe, expect, it } from 'vitest'
import {
  operationErrorResponse,
  toOperationError,
  unauthorizedError,
  validationError,
} from '@/lib/operation-error'

describe('operation error contract', () => {
  it('maps expected error categories to stable HTTP responses', async () => {
    const response = operationErrorResponse({
      ...validationError('INVALID_INPUT', 'Invalid request', ['name']),
      hint: 'Check the request body',
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request',
      code: 'INVALID_INPUT',
      category: 'validation',
      retryable: false,
      hint: 'Check the request body',
      invalidFields: ['name'],
    })
  })

  it('does not expose unknown exception messages', async () => {
    const error = toOperationError(new Error('database password'), {
      code: 'INTERNAL_FAILURE',
      message: 'Operation failed',
    })
    const response = operationErrorResponse(error)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Operation failed',
      code: 'INTERNAL_FAILURE',
      category: 'internal',
      retryable: false,
    })
  })

  it('provides a stable authorization error', async () => {
    const response = operationErrorResponse(unauthorizedError())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: 'UNAUTHORIZED',
      category: 'authorization',
      retryable: false,
    })
  })
})
