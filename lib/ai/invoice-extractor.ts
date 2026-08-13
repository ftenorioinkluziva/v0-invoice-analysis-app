import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, Output } from 'ai'
import {
  InvoiceExtractionOperationError,
  type InvoiceExtractionInput,
  type InvoiceExtractionPort,
} from '@/lib/invoice-extraction'
import { ExtractedInvoiceSchema } from '@/lib/types'

export const INVOICE_EXTRACTION_MODEL = 'google/gemini-2.5-flash'

const EXTRACTION_PROMPT = `Extraia os dados desta nota fiscal brasileira.

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
Todos os valores monetários devem estar em BRL (reais).`

export type InvoiceExtractorConfig = {
  apiKey?: string
}

export function createInvoiceExtractor(
  config: InvoiceExtractorConfig = {}
): InvoiceExtractionPort {
  const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY

  return {
    async extract(input: InvoiceExtractionInput) {
      if (!apiKey) {
        throw new InvoiceExtractionOperationError({
          code: 'AI_CONFIG_MISSING',
          category: 'internal',
          message: 'A extração está temporariamente indisponível por configuração do serviço de IA.',
          retryable: false,
        })
      }

      try {
        const openrouter = createOpenRouter({ apiKey })
        const result = await generateText({
          model: openrouter(INVOICE_EXTRACTION_MODEL),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: EXTRACTION_PROMPT },
                {
                  type: 'file',
                  data: input.data,
                  mediaType: input.mediaType,
                  filename: input.filename,
                },
              ],
            },
          ],
          output: Output.object({ schema: ExtractedInvoiceSchema }),
        })

        return result.output
      } catch (error) {
        throw new InvoiceExtractionOperationError(mapProviderError(error))
      }
    },
  }
}

function mapProviderError(error: unknown) {
  const candidate = error as Error & { statusCode?: number; responseBody?: string }
  const statusCode = candidate.statusCode
  const message = candidate instanceof Error ? candidate.message : ''
  const responseBody = candidate.responseBody ?? ''
  const lowerMessage = message.toLowerCase()
  const lowerResponseBody = responseBody.toLowerCase()

  if (statusCode === 403 && (lowerMessage.includes('reported as leaked') || lowerResponseBody.includes('reported as leaked'))) {
    return {
      code: 'AI_KEY_REVOKED',
      category: 'authorization' as const,
      message: 'A extração está temporariamente indisponível por manutenção da integração de IA.',
      retryable: false,
    }
  }

  if (statusCode === 401 || statusCode === 403) {
    return {
      code: 'AI_AUTH_ERROR',
      category: 'authorization' as const,
      message: 'A extração está temporariamente indisponível por autenticação do serviço de IA.',
      retryable: false,
    }
  }

  if (statusCode === 429) {
    return {
      code: 'AI_RATE_LIMIT',
      category: 'rate_limit' as const,
      message: 'Muitas solicitações de extração no momento. Tente novamente em alguns instantes.',
      retryable: true,
    }
  }

  return {
    code: 'EXTRACT_PROCESSING_ERROR',
    category: 'upstream' as const,
    message: 'Não foi possível extrair os dados da nota agora. Tente novamente em instantes.',
    retryable: true,
  }
}
