import type { Assessment, Certification, Completion, Course } from './eligibility';
export const courses: Course[] = [{ id: 'SAFE-100', title: 'Operational safety', requires: [], version: 1 }, { id: 'RISK-210', title: 'Applied risk analysis', requires: ['SAFE-100'], version: 3 }, { id: 'LEAD-320', title: 'Incident leadership', requires: ['RISK-210'], version: 2 }, { id: 'AUDIT-240', title: 'Evidence-based auditing', requires: ['SAFE-100'], version: 1 }];
export const completions: Completion[] = [{ learnerId: 'u1', courseId: 'SAFE-100', completedAt: '2027-01-10', ruleVersion: 1 }, { learnerId: 'u1', courseId: 'RISK-210', completedAt: '2027-02-20', ruleVersion: 2 }];
export const assessments: Assessment[] = [{ learnerId: 'u1', courseId: 'LEAD-320', score: 84, attempt: 1, submittedAt: '2027-03-10' }];
export const certification: Certification = { id: 'CERT-IR', title: 'Incident Response Lead', requiredCourses: ['LEAD-320'], minimumScore: 80, validDays: 365, ruleVersion: 4 };
