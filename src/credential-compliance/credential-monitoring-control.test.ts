import { describe, expect, it } from 'vitest'
import { initialMonitoringPortfolioState, scheduleMonitoringReview } from './CredentialMonitoringControl'

const command = { id: 'monitor-1', expectedRevision: 0, role: 'Compliance Lead' as const, monitoringId: 'MON-AR-18', owner: 'Senior compliance reviewer', reviewOn: '2026-10-21', asOf: '2026-10-20', evidenceRequested: 'Provide supervisor observation for both failed credential uses.' }
describe('credential monitoring review control', () => {
  it('reassigns due high-risk monitoring and retains learner evidence context', () => { const next = scheduleMonitoringReview(initialMonitoringPortfolioState, command); expect(next.records.find((item) => item.monitoringId === command.monitoringId)?.owner).toBe(command.owner); expect(next.reviewHistory[0]).toMatchObject({ learner: 'Amira Rahman', previousOwner: 'Credential council', failedUses: 2, decisionDue: true }) })
  it('rejects reviewer and stale commands without changing learner history', () => { expect(() => scheduleMonitoringReview(initialMonitoringPortfolioState, { ...command, role: 'Compliance Reviewer' })).toThrow('compliance lead'); expect(() => scheduleMonitoringReview(initialMonitoringPortfolioState, { ...command, expectedRevision: 4 })).toThrow('changed'); expect(initialMonitoringPortfolioState.reviewHistory).toEqual([]) })
  it('does not duplicate a repeated evidence request', () => { const next = scheduleMonitoringReview(initialMonitoringPortfolioState, command); expect(scheduleMonitoringReview(next, command)).toBe(next) })
})
