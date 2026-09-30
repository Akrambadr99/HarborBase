import type { PublishedAssessmentReference } from '../assessment-moderation/assessment-moderation'
export interface CredentialMonitoringRecord {
  learnerId?: string
  credentialId?: string
  assessmentSource?: PublishedAssessmentReference
  monitoringId: string
  learner: string
  credential: string
  startsOn: string
  endsOn: string
  successfulUses: number
  failedUses: number
  evidencePending: number
  owner: string
}

export interface CredentialMonitoringStatus extends CredentialMonitoringRecord {
  progressPercent: number
  remainingDays: number
  risk: 'high' | 'elevated' | 'standard'
  dueReview: boolean
  closureReady: boolean
}

export const seededCredentialMonitoring: CredentialMonitoringRecord[] = [
  { monitoringId: 'MON-AR-18', learner: 'Amira Rahman', credential: 'Clinical assessor', startsOn: '2026-09-01', endsOn: '2026-10-25', successfulUses: 3, failedUses: 2, evidencePending: 1, owner: 'Credential council' },
  { monitoringId: 'MON-JL-07', learner: 'Jonas Lee', credential: 'Rigging lead', startsOn: '2026-08-15', endsOn: '2026-10-22', successfulUses: 6, failedUses: 0, evidencePending: 0, owner: 'Safety academy' },
  { monitoringId: 'MON-SK-12', learner: 'Sofia Kim', credential: 'Quality reviewer', startsOn: '2026-10-01', endsOn: '2026-12-01', successfulUses: 2, failedUses: 1, evidencePending: 0, owner: 'Quality faculty' },
]

export function credentialMonitoringPortfolio(
  records: CredentialMonitoringRecord[],
  asOf: string,
): CredentialMonitoringStatus[] {
  const now = Date.parse(asOf)
  const rank = { high: 0, elevated: 1, standard: 2 } as const
  return records
    .map((record) => {
      const start = Date.parse(record.startsOn)
      const end = Date.parse(record.endsOn)
      const progressPercent = Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)))
      const remainingDays = Math.ceil((end - now) / 86_400_000)
      const risk = record.failedUses >= 2 ? 'high' : record.failedUses === 1 || record.evidencePending > 0 ? 'elevated' : 'standard'
      return {
        ...record,
        progressPercent,
        remainingDays,
        risk,
        dueReview: remainingDays <= 14 || risk === 'high',
        closureReady: remainingDays <= 0 && record.failedUses === 0 && record.evidencePending === 0,
      } satisfies CredentialMonitoringStatus
    })
    .sort((a, b) => rank[a.risk] - rank[b.risk] || a.remainingDays - b.remainingDays)
}
