import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('SkillOrbit workspace', () => {
  it('opens a domain-specific operational surface', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Incident Response Lead path' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'graph' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Learning dependency graph' })).toBeVisible()
  })
})
