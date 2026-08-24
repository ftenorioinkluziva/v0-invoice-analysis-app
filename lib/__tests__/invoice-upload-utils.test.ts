import { describe, expect, it } from 'vitest'
import { getInvoiceSaveErrorMessage } from '@/lib/invoice-upload-utils'

describe('invoice upload error messages', () => {
  it('explains that a 409 invoice is already imported', () => {
    expect(getInvoiceSaveErrorMessage(409)).toBe(
      'Esta nota fiscal já foi importada anteriormente. Verifique sua lista de notas — não é necessário importar novamente.'
    )
  })

  it('preserves API errors for other save failures', () => {
    expect(getInvoiceSaveErrorMessage(500, 'Banco temporariamente indisponível')).toBe(
      'Banco temporariamente indisponível'
    )
    expect(getInvoiceSaveErrorMessage(500)).toBe('Não foi possível salvar a nota. Tente novamente.')
  })
})
