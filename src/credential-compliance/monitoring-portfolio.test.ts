import { describe, expect, it } from 'vitest'
import { credentialMonitoringPortfolio, seededCredentialMonitoring } from './monitoring-portfolio'

describe('credential monitoring portfolio', () => {
  it('prioritizes repeated supervised-use failures for review', () => {
    const portfolio = credentialMonitoringPortfolio(seededCredentialMonitoring, '2026-10-20')
    expect(portfolio[0]).toMatchObject({ monitoringId: 'MON-AR-18', risk: 'high', dueReview: true, evidencePending: 1 })
  })

  it('closes completed monitoring only when evidence and observed uses are clear', () => {
    const [monitoring] = credentialMonitoringPortfolio([seededCredentialMonitoring[1]!], '2026-10-23')
    expect(monitoring).toMatchObject({ risk: 'standard', closureReady: true, remainingDays: -1 })
  })
})
