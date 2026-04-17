import { test, expect } from '@playwright/test'
import { isOnSignInPage } from './auth-helpers'

test.describe('Historico de Precos', () => {
  test('should load the page with title and search', async ({ page }) => {
    await page.goto('/historico')

    if (await isOnSignInPage(page)) return

    await expect(page.getByRole('heading', { name: 'Historico de Precos' })).toBeVisible()
    await expect(page.getByPlaceholder('Buscar produto...')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Produtos' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Comparaveis' })).toBeVisible()
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

  test('should switch between produtos and comparaveis while keeping shared search', async ({ page }) => {
    await page.goto('/historico')

    if (await isOnSignInPage(page)) return

    await page.getByPlaceholder('Buscar produto...').fill('leite')
    await page.getByRole('button', { name: 'Comparaveis' }).click()

    await expect(page.getByPlaceholder('Buscar grupo comparavel...')).toHaveValue('leite')
    await page.getByRole('button', { name: 'Produtos' }).click()
    await expect(page.getByPlaceholder('Buscar produto...')).toHaveValue('leite')
  })
})
