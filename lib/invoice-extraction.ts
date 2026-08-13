import { z } from 'zod'
import { ExtractedInvoiceSchema, type ExtractedInvoice } from '@/lib/types'

export const INVOICE_EXTRACTION_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const InvoiceExtractionInputSchema = z.object({
  data: z.string().min(1),
  mediaType: z.enum(INVOICE_EXTRACTION_FILE_TYPES),
  filename: z.string().min(1).max(255),
})

export type InvoiceExtractionInput = z.infer<typeof InvoiceExtractionInputSchema>

export type InvoiceExtractionErrorCategory =
  | 'validation'
  | 'authorization'
  | 'conflict'
  | 'rate_limit'
  | 'upstream'
  | 'internal'

export type InvoiceExtractionError = {
  code: string
  category: InvoiceExtractionErrorCategory
  message: string
  hint?: string
  retryable: boolean
  invalidFields?: string[]
}

export type InvoiceExtractionResult =
  | { ok: true; value: ExtractedInvoice }
  | { ok: false; error: InvoiceExtractionError }

export interface InvoiceExtractionPort {
  extract(input: InvoiceExtractionInput): Promise<unknown>
}

export async function extractInvoice(
  input: unknown,
  extractor: InvoiceExtractionPort
): Promise<InvoiceExtractionResult> {
  const parsedInput = InvoiceExtractionInputSchema.safeParse(input)
  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_EXTRACTION_INPUT',
        category: 'validation',
        message: 'The invoice extraction input is invalid.',
        retryable: false,
        invalidFields: parsedInput.error.issues.map(issue => issue.path.join('.')),
      },
    }
  }

  try {
    const output = await extractor.extract(parsedInput.data)
    const parsedOutput = ExtractedInvoiceSchema.safeParse(output)

    if (!parsedOutput.success) {
      return {
        ok: false,
        error: {
          code: 'INVALID_EXTRACTION_OUTPUT',
          category: 'upstream',
          message: 'The extraction provider returned an invalid invoice payload.',
          retryable: false,
          invalidFields: parsedOutput.error.issues.map(issue => issue.path.join('.')),
        },
      }
    }

    return { ok: true, value: parsedOutput.data }
  } catch (error) {
    if (isInvoiceExtractionError(error)) {
      return { ok: false, error: error.details }
    }

    return {
      ok: false,
      error: {
        code: 'EXTRACTION_UPSTREAM_ERROR',
        category: 'upstream',
        message: 'The extraction provider could not process the invoice.',
        retryable: true,
      },
    }
  }
}

export class InvoiceExtractionOperationError extends Error {
  readonly details: InvoiceExtractionError

  constructor(details: InvoiceExtractionError) {
    super(details.message)
    this.name = 'InvoiceExtractionOperationError'
    this.details = details
  }
}

function isInvoiceExtractionError(error: unknown): error is InvoiceExtractionOperationError {
  return error instanceof InvoiceExtractionOperationError
}
