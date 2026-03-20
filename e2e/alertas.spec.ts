import { test, expect } from '@playwright/test'

test.describe('Central de Alertas', () => {
  test('should load the page with title', async ({ page }) => {
    await page.goto('/alertas')

    await expect(page.getByRole('heading', { name: 'Central de Alertas' })).toBeVisible()
  })

  test('should show alert count badge or empty state', async ({ page }) => {
    await page.goto('/alertas')

    const hasAlerts = await page.getByText(/alertas nao lidos/).count()
    const hasEmpty = await page.getByText(/nenhum alerta/i).count()

    expect(hasAlerts + hasEmpty).toBeGreaterThan(0)
  })
})
