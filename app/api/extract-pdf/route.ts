import { generateText, Output } from 'ai'
import { google } from '@ai-sdk/google'
import { ExtractedInvoiceSchema } from '@/lib/types'

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
    console.error('[extract-pdf] error:', error)
    return Response.json({ error: 'Failed to extract data from PDF' }, { status: 500 })
  }
}
