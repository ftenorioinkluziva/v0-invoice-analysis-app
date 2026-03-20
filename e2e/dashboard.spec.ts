import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('should load the homepage with header and stats', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'NoteWise' })).toBeVisible()
    await expect(page.getByText('Analise de Notas Fiscais')).toBeVisible()
  })

  test('should display stats cards section', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Total Gasto')).toBeVisible()
    await expect(page.getByText('Notas Fiscais')).toBeVisible()
  })

  test('should display the PDF upload area', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText(/envie.*nota fiscal|arraste.*pdf/i)).toBeVisible()
  })

  test('should have a refresh button', async ({ page }) => {
    await page.goto('/')

    const refreshButton = page.getByRole('button', { name: 'Atualizar dados' })
    await expect(refreshButton).toBeVisible()
  })
})
