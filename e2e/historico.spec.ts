import { test, expect } from '@playwright/test'
import { isOnSignInPage } from './auth-helpers'

test.describe('Historico de Precos', () => {
  test('should load the page with title and search', async ({ page }) => {
    await page.goto('/historico')

    if (await isOnSignInPage(page)) return

    await expect(page.getByRole('heading', { name: 'Historico de Precos' })).toBeVisible()
    await expect(page.getByPlaceholder('Buscar produto...')).toBeVisible()
  })

  test('should have category filter dropdown', async ({ page }) => {
    await page.goto('/historico')

    if (await isOnSignInPage(page)) return

    await expect(page.getByRole('combobox')).toBeVisible()
  })

  test('should show empty state or product list', async ({ page }) => {
    await page.goto('/historico')

    if (await isOnSignInPage(page)) return

    const hasProducts = await page.locator('[class*="cursor-pointer"]').count()
    if (hasProducts === 0) {
      await expect(page.getByText(/nenhum produto|adicione notas/i).first()).toBeVisible()
    }
  })
})
