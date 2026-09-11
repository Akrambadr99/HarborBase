import { expect, test } from '@playwright/test'

test('SkillOrbit exposes its primary domain workflow', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('SkillOrbit')
  await expect(page.getByRole('heading', { level: 1, name: 'Incident Response Lead path' })).toBeVisible()
  await page.getByRole('button', { name: 'graph' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Learning dependency graph' })).toBeVisible()
})
