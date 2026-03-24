import { test, expect } from '@playwright/test'
import { isOnSignInPage } from './auth-helpers'

test.describe('Dashboard', () => {
  test('should load the homepage with header and stats', async ({ page }) => {
    await page.goto('/')

    if (await isOnSignInPage(page)) return

    await expect(page.getByRole('heading', { name: 'NoteWise' })).toBeVisible()
    await expect(page.getByText('Analise de Notas Fiscais')).toBeVisible()
  })

  test('should display stats cards section', async ({ page }) => {
    await page.goto('/')

    if (await isOnSignInPage(page)) return

    await expect(page.getByText('Inflação', { exact: true })).toBeVisible()
    await expect(page.getByText('Notas', { exact: true })).toBeVisible()
    await expect(page.getByText('Produtos', { exact: true })).toBeVisible()
  })

  test('should display the PDF upload area', async ({ page }) => {
    await page.goto('/')

    if (await isOnSignInPage(page)) return

    await expect(page.getByText(/envie.*nota fiscal|arraste.*pdf/i)).toBeVisible()
  })

  test('should have a refresh button', async ({ page }) => {
    await page.goto('/')

    if (await isOnSignInPage(page)) return

    const refreshButton = page.getByRole('button', { name: 'Atualizar dados' })
    await expect(refreshButton).toBeVisible()
  })
})
