import { getSessionUserId } from '@/lib/auth-session'
import {
  extractInvoice,
  INVOICE_EXTRACTION_FILE_TYPES,
  type InvoiceExtractionError,
} from '@/lib/invoice-extraction'
import { createInvoiceExtractor } from '@/lib/ai/invoice-extractor'
import {
  operationErrorResponse,
  toOperationError,
  unauthorizedError,
  validationError,
} from '@/lib/operation-error'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const SUPPORTED_FILE_TYPES = INVOICE_EXTRACTION_FILE_TYPES

type UploadValidationResult =
  | { valid: true }
  | {
      valid: false
      statusCode: number
      code: string
      message: string
    }

export const validateUploadFile = (file: File | null): UploadValidationResult => {
  if (!file) {
    return {
      valid: false,
      statusCode: 400,
      code: 'FILE_REQUIRED',
      message: 'Selecione um PDF ou imagem de nota fiscal para importar.',
    }
  }

  if (!SUPPORTED_FILE_TYPES.includes(file.type as (typeof SUPPORTED_FILE_TYPES)[number])) {
    return {
      valid: false,
      statusCode: 415,
      code: 'UNSUPPORTED_FILE_TYPE',
      message: 'Formato não aceito. Envie PDF, JPG, PNG ou WEBP.',
    }
  }

  if (file.size <= 0) {
    return {
      valid: false,
      statusCode: 400,
      code: 'EMPTY_FILE',
      message: 'O arquivo está vazio. Selecione outro arquivo.',
    }
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      valid: false,
      statusCode: 413,
      code: 'FILE_TOO_LARGE',
      message: 'Arquivo muito grande. Envie uma nota de até 10 MB.',
    }
  }

  return { valid: true }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return operationErrorResponse(validationError(
        'FILE_REQUIRED',
        'Selecione um PDF ou imagem de nota fiscal para importar.'
      ))
    }

    const fileValidation = validateUploadFile(file)

    if (!fileValidation.valid) {
      return operationErrorResponse(
        validationError(fileValidation.code, fileValidation.message),
        { status: fileValidation.statusCode }
      )
    }

    const extraction = await extractInvoice(
      {
        data: Buffer.from(await file.arrayBuffer()).toString('base64'),
        mediaType: file.type,
        filename: file.name,
      },
      createInvoiceExtractor()
    )

    if (!extraction.ok) {
      logExtractionError(extraction.error)
      return operationErrorResponse(extraction.error, { status: toHttpStatus(extraction.error) })
    }

    return Response.json({ success: true, data: extraction.value, filename: file.name })
  } catch (error) {
    console.error('[extract-pdf] error:', error instanceof Error ? error.message : 'Unknown error')
    return operationErrorResponse(toOperationError(error, {
      code: 'EXTRACT_UNKNOWN_ERROR',
      message: 'Não foi possível processar o arquivo agora. Tente novamente em instantes.',
    }))
  }
}

function toHttpStatus(error: InvoiceExtractionError) {
  if (error.code === 'AI_RATE_LIMIT') return 429
  if (error.category === 'authorization') return 503
  if (error.category === 'validation') return 400
  if (error.code === 'AI_CONFIG_MISSING') return 500
  if (error.code === 'INVALID_EXTRACTION_OUTPUT') return 502
  return 500
}

function logExtractionError(error: InvoiceExtractionError) {
  console.error('[extract-pdf] error:', {
    code: error.code,
    category: error.category,
    retryable: error.retryable,
  })
}
