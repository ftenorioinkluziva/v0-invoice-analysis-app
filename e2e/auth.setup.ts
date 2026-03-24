import { expect, test as setup } from '@playwright/test'

const authFile = 'e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD

  if (!email || !password) {
    throw new Error('E2E_EMAIL and E2E_PASSWORD must be set for authenticated Playwright runs.')
  }

  await page.goto('/sign-in')

  await page.getByPlaceholder('seu@email.com').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), {
    timeout: 15_000,
  })

  await expect(page).toHaveURL(/\/(alertas|lista|historico|config)?$/)
  await page.context().storageState({ path: authFile })
})
