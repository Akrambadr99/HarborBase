import { credentialMonitoringPortfolio, seededCredentialMonitoring, type CredentialMonitoringRecord } from './monitoring-portfolio'

export type MonitoringControlRole = 'Learner' | 'Supervisor' | 'Compliance Reviewer' | 'Compliance Lead'
export function monitoringCapabilities(role: MonitoringControlRole) {
  return { canSubmitEvidence: role === 'Learner', canApproveEvidence: role === 'Supervisor' || role === 'Compliance Lead', canRequestEvidence: role === 'Compliance Reviewer' || role === 'Compliance Lead', canReassignReview: role === 'Compliance Lead', canCloseMonitoring: role === 'Compliance Lead' } as const
}
export interface MonitoringReview { id: string; monitoringId: string; learner: string; previousOwner: string; owner: string; reviewOn: string; failedUses: number; evidenceRequested: string; decisionDue: true; immutable: true }
export interface MonitoringClosure { id: string; monitoringId: string; reviewId: string; learner: string; previousFailedUses: number; acceptedEvidence: string[]; supervisorApproval: string; complianceApproval: string; successfulUses: number; outcome: 'completed'; closedBy: string; closedOn: string; immutable: true }
export interface MonitoringPortfolioState { revision: number; records: CredentialMonitoringRecord[]; reviewHistory: MonitoringReview[]; closures: MonitoringClosure[] }
export const monitoringOwnerPolicy = { maximumHighRiskReviews: 2 } as const
export const initialMonitoringPortfolioState: MonitoringPortfolioState = { revision: 0, records: structuredClone(seededCredentialMonitoring), reviewHistory: [], closures: [] }
interface ScheduleMonitoringReview { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; owner: string; reviewOn: string; asOf: string; evidenceRequested: string }

export function scheduleMonitoringReview(state: MonitoringPortfolioState, command: ScheduleMonitoringReview) {
  if (state.reviewHistory.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before scheduling review.')
  if (!monitoringCapabilities(command.role).canReassignReview) throw new Error('Only the compliance lead can reassign a high-risk monitoring review.')
  const record = state.records.find((item) => item.monitoringId === command.monitoringId)
  if (!record) throw new Error('Monitoring record was not found.')
  const status = credentialMonitoringPortfolio([record], command.asOf)[0]
  if (status?.risk !== 'high' || !status.dueReview) throw new Error('Only due high-risk monitoring can be escalated.')
  const activeForOwner = state.reviewHistory.filter((item) => item.owner === command.owner).length
  if (activeForOwner >= monitoringOwnerPolicy.maximumHighRiskReviews) throw new Error('Selected compliance owner is at review capacity.')
  if (command.reviewOn < command.asOf) throw new Error('Monitoring review cannot be scheduled in the past.')
  if (command.evidenceRequested.trim().length < 20) throw new Error('A specific evidence request is required.')
  const next = structuredClone(state)
  const target = next.records.find((item) => item.monitoringId === record.monitoringId)
  if (!target) throw new Error('Monitoring record disappeared during review scheduling.')
  next.reviewHistory.push({ id: command.id, monitoringId: record.monitoringId, learner: record.learner, previousOwner: record.owner, owner: command.owner, reviewOn: command.reviewOn, failedUses: record.failedUses, evidenceRequested: command.evidenceRequested.trim(), decisionDue: true, immutable: true })
  target.owner = command.owner
  next.revision += 1
  return next
}

interface CloseCredentialMonitoring { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; acceptedEvidence: string[]; supervisorApproval: string; complianceApproval: string; successfulUses: number; closedBy: string; closedOn: string }
export function closeCredentialMonitoring(state: MonitoringPortfolioState, command: CloseCredentialMonitoring) {
  if (state.closures.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before closure.')
  if (!monitoringCapabilities(command.role).canCloseMonitoring) throw new Error('Only the compliance lead can independently close monitoring.')
  const record = state.records.find((item) => item.monitoringId === command.monitoringId)
  const review = [...state.reviewHistory].reverse().find((item) => item.monitoringId === command.monitoringId)
  if (!record || !review) throw new Error('A governed monitoring review is required before closure.')
  if (command.closedOn < record.endsOn) throw new Error('Monitoring cannot close before its governed window ends.')
  if (command.acceptedEvidence.length < record.evidencePending || !command.supervisorApproval || !command.complianceApproval || command.successfulUses < 5) throw new Error('Current learner evidence, supervisor approval, and independent compliance approval are required.')
  const next = structuredClone(state)
  const target = next.records.find((item) => item.monitoringId === record.monitoringId)
  if (!target) throw new Error('Monitoring record disappeared during closure.')
  next.closures.push({ id: command.id, monitoringId: record.monitoringId, reviewId: review.id, learner: record.learner, previousFailedUses: record.failedUses, acceptedEvidence: [...command.acceptedEvidence], supervisorApproval: command.supervisorApproval, complianceApproval: command.complianceApproval, successfulUses: command.successfulUses, outcome: 'completed', closedBy: command.closedBy, closedOn: command.closedOn, immutable: true })
  target.successfulUses = command.successfulUses
  target.failedUses = 0
  target.evidencePending = 0
  next.revision += 1
  return next
}

export function queryLearnerMonitoringHistory(state: MonitoringPortfolioState, monitoringId: string) {
  const learnerProgress = queryLearnerProgress(state, monitoringId)
  const complianceHistory = queryComplianceMonitoringHistory(state, monitoringId)
  if (!learnerProgress || !complianceHistory) return null
  return { ...learnerProgress, ...complianceHistory }
}

export function queryLearnerProgress(state: MonitoringPortfolioState, monitoringId: string) {
  const record = state.records.find((item) => item.monitoringId === monitoringId)
  if (!record) return null
  return {
    monitoringId,
    learner: record.learner,
    credential: record.credential,
    currentProgress: { successfulUses: record.successfulUses, failedUses: record.failedUses, evidencePending: record.evidencePending },
  }
}

export function queryComplianceMonitoringHistory(state: MonitoringPortfolioState, monitoringId: string) {
  const record = state.records.find((item) => item.monitoringId === monitoringId)
  if (!record) return null
  return {
    reviews: state.reviewHistory.filter((item) => item.monitoringId === monitoringId).map((item) => ({ reviewId: item.id, owner: item.owner, requestedEvidence: item.evidenceRequested, priorFailures: item.failedUses })),
    closures: state.closures.filter((item) => item.monitoringId === monitoringId).map((item) => ({ closureId: item.id, outcome: item.outcome, acceptedEvidence: [...item.acceptedEvidence], previousFailedUses: item.previousFailedUses })),
  }
}

export function queryCredentialMonitoringState(state: MonitoringPortfolioState, monitoringId: string) {
  const record = state.records.find((item) => item.monitoringId === monitoringId)
  if (!record) return null
  const closure = [...state.closures].reverse().find((item) => item.monitoringId === monitoringId) ?? null
  return { credential: record.credential, monitoringPeriod: { startsOn: record.startsOn, endsOn: record.endsOn }, monitoringStatus: closure ? 'completed' as const : 'active' as const, latestComplianceDecision: closure ? { closureId: closure.id, outcome: closure.outcome, acceptedEvidence: [...closure.acceptedEvidence], supervisorApproval: closure.supervisorApproval, complianceApproval: closure.complianceApproval } : null }
}

export interface LearnerProgressReader { readLearnerProgress(monitoringId: string): ReturnType<typeof queryLearnerProgress> }
export interface CredentialMonitoringReader { readCredentialState(monitoringId: string): ReturnType<typeof queryCredentialMonitoringState> }
export interface ComplianceMonitoringReader { readComplianceHistory(monitoringId: string): ReturnType<typeof queryComplianceMonitoringHistory> }
export class MonitoringReadAdapter implements LearnerProgressReader, CredentialMonitoringReader, ComplianceMonitoringReader {
  private readonly readState: () => MonitoringPortfolioState
  constructor(readState: () => MonitoringPortfolioState) { this.readState = readState }
  readLearnerProgress(monitoringId: string) { return queryLearnerProgress(this.readState(), monitoringId) }
  readCredentialState(monitoringId: string) { return queryCredentialMonitoringState(this.readState(), monitoringId) }
  readComplianceHistory(monitoringId: string) { return queryComplianceMonitoringHistory(this.readState(), monitoringId) }
}

export interface MonitoringPersistence { load(): MonitoringPortfolioState | null; saveMonitoring(state: MonitoringPortfolioState): void }
export class BrowserMonitoringPersistence implements MonitoringPersistence {
  static key = 'skillorbit:monitoring-portfolio:v3'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  load() { const raw = this.storage.getItem(BrowserMonitoringPersistence.key); if (!raw) return null; const saved = JSON.parse(raw) as Partial<MonitoringPortfolioState>; return { ...(saved as MonitoringPortfolioState), reviewHistory: saved.reviewHistory ?? [], closures: saved.closures ?? [] } }
  saveMonitoring(state: MonitoringPortfolioState) { this.storage.setItem(BrowserMonitoringPersistence.key, JSON.stringify(state)) }
}
export class MonitoringPortfolioRepository {
  private readonly persistence: MonitoringPersistence
  constructor(persistence: MonitoringPersistence) { this.persistence = persistence }
  read(): MonitoringPortfolioState { return this.persistence.load() ?? structuredClone(initialMonitoringPortfolioState) }
  dispatch(command: ScheduleMonitoringReview | CloseCredentialMonitoring) { const current = this.read(); const next = 'acceptedEvidence' in command ? closeCredentialMonitoring(current, command) : scheduleMonitoringReview(current, command); if (next !== current) this.persistence.saveMonitoring(next); return next }
}
