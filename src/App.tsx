import { useMemo, useState } from 'react'
import { EligibilityPanel } from './learning-graph/EligibilityPanel'
import { awardCertification, eligibility, renewalState } from './learning-graph/eligibility'
import { assessments, certification, completions, courses } from './learning-graph/fixtures'
import { LearnerPath } from './learning-graph/LearnerPath'
import { PrerequisiteGraph } from './learning-graph/PrerequisiteGraph'
import { skillGaps } from './learning-graph/skills'

type Studio = 'my path' | 'graph' | 'assessment' | 'certification' | 'team skills'

function App() {
  const [studio, setStudio] = useState<Studio>('my path')
  const [approved, setApproved] = useState(false)
  const [message, setMessage] = useState('')
  const completed = useMemo(() => new Set(completions.filter((item) => item.learnerId === 'u1').map((item) => item.courseId)), [])
  const result = eligibility(certification, courses, completions, assessments, 'u1', approved)
  const gaps = skillGaps([{ id: 'incident-leadership', name: 'Incident leadership', courseIds: ['SAFE-100', 'RISK-210', 'LEAD-320'], targetLevel: 5 }, { id: 'audit', name: 'Evidence auditing', courseIds: ['SAFE-100', 'AUDIT-240'], targetLevel: 4 }], completions, 'u1')

  function award() { try { const issued = awardCertification(certification, 'u1', '2027-03-15T00:00:00.000Z', result.eligible); setMessage(`Credential issued until ${issued.expiresAt.slice(0, 10)} under rule v${String(issued.ruleVersion)}.`) } catch (error) { setMessage(error instanceof Error ? error.message : 'Credential could not be issued.') } }

  return <div className="learning-app"><header className="learning-header"><div className="learning-brand"><span>SO</span><div><strong>SkillOrbit</strong><small>COMPETENCY CLOUD</small></div></div><div className="learner"><span>LEARNER</span><strong>Samira Nabil</strong><small>Operations cohort · Spring 2027</small></div><button>SN</button></header>
    <nav className="studio-nav" aria-label="Learning studios">{(['my path', 'graph', 'assessment', 'certification', 'team skills'] as Studio[]).map((item) => <button key={item} aria-current={studio === item ? 'page' : undefined} onClick={() => { setStudio(item) }}>{item}</button>)}</nav>
    <main>{message && <p className="learning-message" role="status">{message}</p>}
      {studio === 'my path' && <><StudioHeading eyebrow="PERSONAL PROGRESSION" title="Incident Response Lead path" detail="Your path follows current graph rules while historical completions retain their original rule versions." /><div className="learning-layout"><LearnerPath courses={courses} completions={completions} /><EligibilityPanel certification={certification} courses={courses} completions={completions} assessments={assessments} approved={approved} /></div></>}
      {studio === 'graph' && <><StudioHeading eyebrow="PREREQUISITE MODEL" title="Learning dependency graph" detail="Publishing a new edge affects future eligibility and rejects cycles before activation." /><PrerequisiteGraph courses={courses} completed={completed} /></>}
      {studio === 'assessment' && <><StudioHeading eyebrow="ATTEMPT 01" title="Incident leadership assessment" detail="Attempt limits, cooldown, and best-score rules are evaluated independently." /><section className="assessment-card"><div className="score-ring"><strong>84</strong><span>PASS</span></div><div><span>SUBMITTED 10 MAR 2027</span><h2>Scenario-based response assessment</h2><p>Threshold 80 · one of three attempts used · supervisor review available</p></div><button>Review responses</button></section></>}
      {studio === 'certification' && <><StudioHeading eyebrow="RULED CREDENTIAL" title="Certification eligibility" detail="Course closure, assessment threshold, and supervisor decision must all pass." /><div className="certification-layout"><EligibilityPanel certification={certification} courses={courses} completions={completions} assessments={assessments} approved={approved} /><section className="credential-actions"><span>SUPERVISOR DECISION</span><h2>{approved ? 'Approval recorded' : 'Approval pending'}</h2><p>Awarded credentials will expire after {certification.validDays} days and retain rule v{certification.ruleVersion}.</p><button onClick={() => { setApproved(true); setMessage('Supervisor approval recorded in the learner evidence timeline.') }}>Record approval</button><button className="award" onClick={award}>Award certification</button><small>Example renewal state: {renewalState({ learnerId: 'u1', certificationId: 'CERT-IR', awardedAt: '2026-03-15', expiresAt: '2027-03-15', ruleVersion: 3 }, '2027-02-20', 30)}</small></section></div></>}
      {studio === 'team skills' && <><StudioHeading eyebrow="CAPABILITY MATRIX" title="Cohort skill gaps" detail="Competency levels derive from course-linked completion evidence." /><div className="skill-grid">{gaps.map((gap) => <article key={gap.competencyId}><span>{gap.competencyId}</span><strong>{gap.level}</strong><p>target {gap.level + gap.gap} · {gap.completed}/{gap.required} courses</p><div><i style={{ width: `${String(gap.level / (gap.level + gap.gap) * 100)}%` }} /></div></article>)}</div></>}
    </main></div>
}

function StudioHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) { return <div className="studio-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div> }
export default App
