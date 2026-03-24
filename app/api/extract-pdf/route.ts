import { generateText, Output } from 'ai'
import { google } from '@ai-sdk/google'
import { ExtractedInvoiceSchema } from '@/lib/types'

type ExtractPdfError = {
  statusCode: number
  code: string
  message: string
  logMessage: string
}

const getExtractPdfError = (error: unknown): ExtractPdfError => {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      statusCode: 500,
      code: 'AI_CONFIG_MISSING',
      message:
        'A extração está temporariamente indisponível por configuração do serviço de IA. Tente novamente mais tarde.',
      logMessage: 'GOOGLE_GENERATIVE_AI_API_KEY is not configured',
    }
  }

  if (!(error instanceof Error)) {
    return {
      statusCode: 500,
      code: 'EXTRACT_UNKNOWN_ERROR',
      message: 'Não foi possível processar o arquivo agora. Tente novamente em instantes.',
      logMessage: 'Unknown non-Error thrown',
    }
  }

  const candidate = error as Error & {
    statusCode?: number
    responseBody?: string
  }

  const statusCode = candidate.statusCode
  const responseBody = candidate.responseBody ?? ''
  const lowerMessage = error.message.toLowerCase()
  const lowerResponseBody = responseBody.toLowerCase()

  if (
    statusCode === 403 &&
    (lowerMessage.includes('reported as leaked') || lowerResponseBody.includes('reported as leaked'))
  ) {
    return {
      statusCode: 503,
      code: 'AI_KEY_REVOKED',
      message:
        'A extração está temporariamente indisponível por manutenção da integração de IA. Tente novamente em alguns minutos.',
      logMessage: 'AI provider key rejected as leaked/revoked',
    }
  }

  if (statusCode === 401 || statusCode === 403) {
    return {
      statusCode: 503,
      code: 'AI_AUTH_ERROR',
      message:
        'A extração está temporariamente indisponível por autenticação do serviço de IA. Tente novamente mais tarde.',
      logMessage: `AI provider auth error (${statusCode})`,
    }
  }

  if (statusCode === 429) {
    return {
      statusCode: 429,
      code: 'AI_RATE_LIMIT',
      message: 'Muitas solicitações de extração no momento. Tente novamente em alguns instantes.',
      logMessage: 'AI provider rate limit',
    }
  }

  return {
    statusCode: 500,
    code: 'EXTRACT_PROCESSING_ERROR',
    message: 'Não foi possível extrair os dados da nota agora. Tente novamente em instantes.',
    logMessage: `Unhandled extraction error: ${error.message}`,
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const result = await generateText({
      model: google('gemini-2.5-flash'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extraia os dados desta nota fiscal brasileira.

Retorne os dados estruturados incluindo:
- Nome da loja
- CNPJ (se disponível)
- Endereço (se disponível)
- Número da nota
- Data da compra (formato YYYY-MM-DD)
- Lista de produtos com descrição, quantidade, preço unitário e preço total
- Valor total da nota

REGRAS IMPORTANTES para cada item:
- unit_price é SEMPRE o preço por unidade (ou preço por kg para itens vendidos por peso)
- total_price é SEMPRE unit_price × quantity
- Para itens por PESO (hortifruti, carnes, frios): quantity é o peso em kg (ex: 0.44), unit_price é o preço por kg (ex: 18.91), total_price = peso × preço/kg
- NUNCA inverta unit_price com total_price
- Confira: unit_price × quantity deve ser aproximadamente igual a total_price

Se algum campo não estiver disponível, use null.
Todos os valores monetários devem estar em BRL (reais).`,
            },
            {
              type: 'file',
              data: base64,
              mediaType: file.type,
              filename: file.name,
            },
          ],
        },
      ],
      output: Output.object({ schema: ExtractedInvoiceSchema }),
    })

    return Response.json({ success: true, data: result.output, filename: file.name })
  } catch (error) {
    const mappedError = getExtractPdfError(error)

    console.error('[extract-pdf] error:', {
      code: mappedError.code,
      message: mappedError.logMessage,
      statusCode: mappedError.statusCode,
    })

    return Response.json(
      {
        error: mappedError.message,
        code: mappedError.code,
      },
      { status: mappedError.statusCode }
    )
  }
}
