import { generateText, Output } from 'ai'
import { ExtractedInvoiceSchema } from '@/lib/types'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    const mimeType = file.type || 'application/pdf'

    const result = await generateText({
      model: 'openai/gpt-4o',
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

Se algum campo não estiver disponível, use null.
Todos os valores monetários devem estar em BRL (reais).`,
            },
            {
              type: 'file',
              data: base64,
              mimeType,
            },
          ],
        },
      ],
      output: Output.object({
        schema: ExtractedInvoiceSchema,
      }),
    })

    return Response.json({ 
      success: true, 
      data: result.output,
      filename: file.name 
    })
  } catch (error) {
    console.error('Error extracting PDF:', error)
    return Response.json(
      { error: 'Failed to extract data from PDF' },
      { status: 500 }
    )
  }
}
