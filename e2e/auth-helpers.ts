import { expect, type Page } from '@playwright/test'

export const isOnSignInPage = async (page: Page): Promise<boolean> => {
  if (!page.url().includes('/sign-in')) {
    return false
  }

  await expect(page).toHaveURL(/\/sign-in/)
  await expect(page.getByText('Acesse o NoteWise com sua conta')).toBeVisible()

  return true
}
