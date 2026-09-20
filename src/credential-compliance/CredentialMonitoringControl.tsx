/* eslint-disable react-refresh/only-export-components */
import { useRef, useState } from 'react'
import { credentialMonitoringPortfolio, seededCredentialMonitoring, type CredentialMonitoringRecord } from './monitoring-portfolio'

export type MonitoringControlRole = 'Compliance Reviewer' | 'Compliance Lead'
export interface MonitoringReview { id: string; monitoringId: string; learner: string; previousOwner: string; owner: string; reviewOn: string; failedUses: number; evidenceRequested: string; decisionDue: true; immutable: true }
export interface MonitoringClosure { id: string; monitoringId: string; reviewId: string; learner: string; previousFailedUses: number; acceptedEvidence: string[]; supervisorApproval: string; complianceApproval: string; successfulUses: number; outcome: 'completed'; closedBy: string; closedOn: string; immutable: true }
export interface MonitoringPortfolioState { revision: number; records: CredentialMonitoringRecord[]; reviewHistory: MonitoringReview[]; closures: MonitoringClosure[] }
export const monitoringOwnerPolicy = { maximumHighRiskReviews: 2 } as const
export const initialMonitoringPortfolioState: MonitoringPortfolioState = { revision: 0, records: structuredClone(seededCredentialMonitoring), reviewHistory: [], closures: [] }
interface ScheduleMonitoringReview { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; owner: string; reviewOn: string; asOf: string; evidenceRequested: string }

export function scheduleMonitoringReview(state: MonitoringPortfolioState, command: ScheduleMonitoringReview) {
  if (state.reviewHistory.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before scheduling review.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can reassign a high-risk monitoring review.')
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
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can independently close monitoring.')
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

export class MonitoringPortfolioRepository {
  static key = 'skillorbit:monitoring-portfolio:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  read(): MonitoringPortfolioState { const raw = this.storage.getItem(MonitoringPortfolioRepository.key); return raw ? JSON.parse(raw) as MonitoringPortfolioState : structuredClone(initialMonitoringPortfolioState) }
  dispatch(command: ScheduleMonitoringReview | CloseCredentialMonitoring) { const current = this.read(); const next = 'acceptedEvidence' in command ? closeCredentialMonitoring(current, command) : scheduleMonitoringReview(current, command); if (next !== current) this.storage.setItem(MonitoringPortfolioRepository.key, JSON.stringify(next)); return next }
}

export function CredentialMonitoringControl() {
  const [repository] = useState(() => new MonitoringPortfolioRepository(localStorage)); const [state, setState] = useState(() => repository.read()); const [role, setRole] = useState<MonitoringControlRole>('Compliance Reviewer'); const [message, setMessage] = useState(''); const feedback = useRef<HTMLParagraphElement>(null); const portfolio = credentialMonitoringPortfolio(state.records, '2026-10-20')
  const schedule = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId: 'MON-AR-18', owner: 'Senior compliance reviewer', reviewOn: '2026-10-21', asOf: '2026-10-20', evidenceRequested: 'Provide supervisor observation for both failed credential uses.' })); setMessage('High-risk monitoring review reassigned with an evidence request.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Monitoring review failed.') } queueMicrotask(() => feedback.current?.focus()) }
  const close = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId: 'MON-AR-18', acceptedEvidence: ['SUPERVISOR-OBS-18'], supervisorApproval: 'SUP-APP-18', complianceApproval: 'COMP-APP-18', successfulUses: 5, closedBy: 'Compliance lead', closedOn: '2026-10-26' })); setMessage('Credential monitoring completed with current learner evidence and independent approval.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Monitoring closure failed.') } queueMicrotask(() => feedback.current?.focus()) }
  return <section className="card" aria-label="Credential monitoring portfolio"><h2>Credential monitoring portfolio</h2><label>Monitoring role<select value={role} onChange={(event) => { setRole(event.target.value as MonitoringControlRole) }}><option>Compliance Reviewer</option><option>Compliance Lead</option></select></label>{portfolio.map((item) => <p key={item.monitoringId}>{item.monitoringId} · {item.learner} · {item.risk} risk · {item.remainingDays} days · evidence pending {item.evidencePending} · owner {item.owner}</p>)}<button disabled={role !== 'Compliance Lead' || state.reviewHistory.length > 0} onClick={schedule}>Schedule high-risk monitoring review</button><button disabled={role !== 'Compliance Lead' || state.reviewHistory.length === 0 || state.closures.length > 0} onClick={close}>Complete governed credential monitoring</button>{message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}<ol aria-label="Monitoring review history">{state.reviewHistory.map((item) => <li key={item.id}>{item.monitoringId} · {item.previousOwner} to {item.owner} · review {item.reviewOn} · failed uses {item.failedUses}</li>)}</ol><ol aria-label="Monitoring closure history">{state.closures.map((item) => <li key={item.id}>{item.monitoringId} · {item.outcome} · successful uses {item.successfulUses} · prior failures {item.previousFailedUses}</li>)}</ol></section>
}
