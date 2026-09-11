import { eligibility, type Assessment, type Certification, type Completion, type Course } from './eligibility'

export function EligibilityPanel({ certification, courses, completions, assessments, approved }: { certification: Certification; courses: Course[]; completions: Completion[]; assessments: Assessment[]; approved: boolean }) {
  const result = eligibility(certification, courses, completions, assessments, 'u1', approved)
  const checks = [{ label: 'Required learning complete', ok: result.missing.length === 0, detail: result.missing.length ? `${String(result.missing.length)} missing` : 'Complete' }, { label: `Assessment score ≥ ${String(certification.minimumScore)}`, ok: result.bestScore >= certification.minimumScore, detail: `${String(result.bestScore)} best score` }, { label: 'Supervisor approval', ok: !result.needsSupervisor, detail: result.needsSupervisor ? 'Pending' : 'Approved' }]
  return <section className="eligibility-panel"><header><div><span>CERTIFICATION RULE v{certification.ruleVersion}</span><h2>{certification.title}</h2></div><b className={result.eligible ? 'eligible' : ''}>{result.eligible ? 'eligible' : 'requirements open'}</b></header>{checks.map((check) => <div className="eligibility-check" key={check.label}><i className={check.ok ? 'ok' : ''}>{check.ok ? '✓' : '○'}</i><strong>{check.label}</strong><span>{check.detail}</span></div>)}</section>
}
