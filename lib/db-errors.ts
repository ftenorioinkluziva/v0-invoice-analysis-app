export function isMissingRelationError(error: unknown, relationName?: string) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false
  }

  if (error.code !== '42P01') {
    return false
  }

  if (!relationName) {
    return true
  }

  if (!('message' in error) || typeof error.message !== 'string') {
    return false
  }

  return error.message.includes(`relation "${relationName}" does not exist`)
}