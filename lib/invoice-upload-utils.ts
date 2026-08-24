export function getInvoiceSaveErrorMessage(status: number, apiError?: string): string {
  if (status === 409) {
    return 'Esta nota fiscal já foi importada anteriormente. Verifique sua lista de notas — não é necessário importar novamente.'
  }

  return apiError || 'Não foi possível salvar a nota. Tente novamente.'
}
