export interface Course {
    id: string;
    title: string;
    requires: string[];
    version: number;
}
export interface Completion {
    learnerId: string;
    courseId: string;
    completedAt: string;
    ruleVersion: number;
}
export interface Assessment {
    learnerId: string;
    courseId: string;
    score: number;
    attempt: number;
    submittedAt: string;
}
export interface Certification {
    id: string;
    title: string;
    requiredCourses: string[];
    minimumScore: number;
    validDays: number;
    ruleVersion: number;
}
export interface Award {
    learnerId: string;
    certificationId: string;
    awardedAt: string;
    expiresAt: string;
    ruleVersion: number;
}
export function detectCycle(courses: Course[]): string[] {
    const graph = new Map(courses.map(c => [c.id, c.requires]));
    const visiting = new Set<string>(), visited = new Set<string>(), path: string[] = [];
    const visit = (id: string): boolean => {
        if (visiting.has(id)) {
            path.push(id);
            return true;
        }
        if (visited.has(id))
            return false;
        visiting.add(id);
        for (const next of graph.get(id) ?? []) {
            if (visit(next)) {
                path.unshift(id);
                return true;
            }
        }
        visiting.delete(id);
        visited.add(id);
        return false;
    };
    for (const course of courses)
        if (visit(course.id))
            return path;
    return [];
}
export function prerequisiteClosure(courses: Course[], courseId: string): string[] {
    const byId = new Map(courses.map(c => [c.id, c]));
    const result = new Set<string>();
    const visit = (id: string) => {
        for (const requirement of byId.get(id)?.requires ?? []) {
            if (!result.has(requirement)) {
                result.add(requirement);
                visit(requirement);
            }
        }
    };
    visit(courseId);
    return [...result];
}
export function eligibility(cert: Certification, courses: Course[], completions: Completion[], assessments: Assessment[], learnerId: string, supervisorApproved: boolean) { const completed = new Set(completions.filter(c => c.learnerId === learnerId).map(c => c.courseId)); const missing = cert.requiredCourses.flatMap(id => [id, ...prerequisiteClosure(courses, id)]).filter((id, index, all) => !completed.has(id) && all.indexOf(id) === index); const best = Math.max(0, ...assessments.filter(a => a.learnerId === learnerId && cert.requiredCourses.includes(a.courseId)).map(a => a.score)); return { eligible: missing.length === 0 && best >= cert.minimumScore && supervisorApproved, missing, bestScore: best, needsSupervisor: !supervisorApproved }; }
export function awardCertification(cert: Certification, learnerId: string, at: string, eligible: boolean): Award {
    if (!eligible)
        throw new Error('Certification cannot be awarded until all current eligibility rules pass.');
    const expires = new Date(at);
    expires.setUTCDate(expires.getUTCDate() + cert.validDays);
    return { learnerId, certificationId: cert.id, awardedAt: at, expiresAt: expires.toISOString(), ruleVersion: cert.ruleVersion };
}
export function renewalState(award: Award, now: string, windowDays: number) { const remaining = Math.ceil((new Date(award.expiresAt).getTime() - new Date(now).getTime()) / 86400000); return remaining < 0 ? 'expired' : remaining <= windowDays ? 'renewal-due' : 'current'; }
