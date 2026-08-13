export type DeleteAllDataInput = {
  confirmation: string
}

export interface UserDataDeletionRepository {
  deleteAllForUser(): Promise<void>
}

export class DataDeletionConfirmationError extends Error {
  readonly code = 'DATA_DELETION_CONFIRMATION_REQUIRED'
  readonly category = 'validation' as const
  readonly retryable = false

  constructor() {
    super('Digite "excluir" para confirmar a exclusão de todos os dados')
    this.name = 'DataDeletionConfirmationError'
  }
}

export async function deleteAllUserData(
  repository: UserDataDeletionRepository,
  input: DeleteAllDataInput
): Promise<void> {
  if (input.confirmation.trim().toLowerCase() !== 'excluir') {
    throw new DataDeletionConfirmationError()
  }

  await repository.deleteAllForUser()
}
