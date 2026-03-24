import { test, expect } from '@playwright/test'
import { isOnSignInPage } from './auth-helpers'

test.describe('Navigation', () => {
  test('should display bottom navigation bar with all tabs', async ({ page }) => {
    await page.goto('/')

    if (await isOnSignInPage(page)) return

    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Lista' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Precos' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Alertas' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Config' })).toBeVisible()
  })

  test('should navigate to /lista page', async ({ page }) => {
    await page.goto('/')

    if (await isOnSignInPage(page)) return

    await page.getByRole('link', { name: 'Lista' }).click()
    await expect(page).toHaveURL('/lista')
    await expect(page.getByText('Listas de Compras')).toBeVisible()
  })

  test('should navigate to /historico page', async ({ page }) => {
    await page.goto('/')

    if (await isOnSignInPage(page)) return

    await page.getByRole('link', { name: 'Precos' }).click()
    await expect(page).toHaveURL('/historico')
    await expect(page.getByText('Historico de Precos')).toBeVisible()
  })

  test('should navigate to /alertas page', async ({ page }) => {
    await page.goto('/')

    if (await isOnSignInPage(page)) return

    await page.getByRole('link', { name: 'Alertas' }).click()
    await expect(page).toHaveURL('/alertas')
    await expect(page.getByText('Central de Alertas')).toBeVisible()
  })

  test('should navigate to /config page', async ({ page }) => {
    await page.goto('/')

    if (await isOnSignInPage(page)) return

    await page.getByRole('link', { name: 'Config' }).click()
    await expect(page).toHaveURL('/config')
  })

  test('should highlight active nav item', async ({ page }) => {
    await page.goto('/lista')

    if (await isOnSignInPage(page)) return

    const listaLink = page.getByRole('link', { name: 'Lista' })
    await expect(listaLink).toHaveClass(/text-primary/)
  })
})
