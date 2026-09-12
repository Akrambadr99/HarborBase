import type { Assessment } from './eligibility';
export interface AttemptPolicy {
    maximumAttempts: number;
    cooldownHours: number;
    passingScore: number;
}
export function canStartAttempt(attempts: Assessment[], learnerId: string, courseId: string, policy: AttemptPolicy, now: string) {
    const relevant = attempts.filter((attempt) => attempt.learnerId === learnerId && attempt.courseId === courseId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    if (relevant.some((attempt) => attempt.score >= policy.passingScore))
        return { allowed: false, reason: 'Assessment is already passed.' };
    if (relevant.length >= policy.maximumAttempts)
        return { allowed: false, reason: 'Maximum assessment attempts reached.' };
    const latest = relevant[0];
    if (latest && new Date(now).getTime() - new Date(latest.submittedAt).getTime() < policy.cooldownHours * 3600000)
        return { allowed: false, reason: 'Assessment cooldown is still active.' };
    return { allowed: true };
}
export function recordAttempt(attempts: Assessment[], attempt: Assessment): Assessment[] {
    const expected = attempts.filter((item) => item.learnerId === attempt.learnerId && item.courseId === attempt.courseId).length + 1;
    if (attempt.attempt !== expected)
        throw new Error(`Expected attempt number ${String(expected)}.`);
    if (attempt.score < 0 || attempt.score > 100)
        throw new Error('Assessment score must be between 0 and 100.');
    return [...attempts, attempt];
}
