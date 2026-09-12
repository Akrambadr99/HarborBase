/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Product, Kind, Field, Operation, Entity } from '../workspace/types';
import { entity, find, rows, total, text, number, requireThat } from '../workspace/values';
const txt = (key: string, label: string): Field => ({ key, label, type: 'text', required: true });
const num = (key: string, label: string, initial = 0, min = 0, max = Number.MAX_SAFE_INTEGER): Field => ({ key, label, type: 'number', required: true, integer: true, initial, min, max });
const date = (key: string, label: string): Field => ({ key, label, type: 'date', required: true, initial: '2026-09-12' });
const ref = (key: string, label: string, reference: string): Field => ({ key, label, type: 'reference', reference, required: true });
const choice = (key: string, label: string, options: string[]): Field => ({ key, label, type: 'select', options, required: true, initial: options[0] ?? '' });
const kind = (key: string, label: string, states: string[], editors: string[], fields: Field[]): Kind => ({ key, label, states, editors, fields, initial: states[0] ?? 'draft' });
const linked = (entities: Entity[], kind: string, key: string, id: string) => rows(entities, kind).filter(item => item.fields[key] === id);
void txt;
void num;
void date;
void ref;
void choice;
void kind;
void linked;
void entity;
void find;
void rows;
void total;
void text;
void number;
void requireThat;
const roles = ['Learning Admin', 'Learner', 'Supervisor', 'Auditor'];
const kinds = [kind('course', 'Courses', ['draft', 'published', 'retired'], [roles[0]!], [txt('code', 'Course code'), num('version', 'Rule version', 1, 1), num('passing', 'Passing score', 80, 0, 100)]), kind('prerequisite', 'Prerequisite rules', ['active'], [roles[0]!], [ref('course', 'Course', 'course'), ref('requires', 'Required course', 'course')]), kind('attempt', 'Assessment attempts', ['submitted', 'passed', 'failed'], [roles[1]!], [ref('course', 'Course', 'course'), txt('learner', 'Learner identity'), num('score', 'Assessment score', 0, 0, 100), num('attempt', 'Attempt number', 1, 1, 5)]), kind('completion', 'Course completions', ['verified'], [], [ref('course', 'Course', 'course'), txt('learner', 'Learner identity'), num('ruleVersion', 'Completed rule version', 1, 1)]), kind('certification', 'Certifications', ['draft', 'published'], [roles[0]!], [txt('code', 'Certification code'), num('validDays', 'Validity days', 365, 1), num('minimumScore', 'Minimum score', 80, 0, 100)]), kind('requirement', 'Certification requirements', ['active'], [roles[0]!], [ref('certification', 'Certification', 'certification'), ref('course', 'Required course', 'course')]), kind('award', 'Credential awards', ['pending', 'awarded', 'expired'], [roles[2]!], [ref('certification', 'Certification', 'certification'), txt('learner', 'Learner identity'), date('expires', 'Expiry date')])];
const operations: Operation[] = [{ key: 'publish', label: 'Publish course', kind: 'course', from: ['draft'], roles: [roles[0]!], run: ({ state, entity }) => {
            const graph = new Map(rows(state.entities, 'prerequisite').map(row => [text(row.fields, 'course'), text(row.fields, 'requires')]));
            let cursor = entity.id;
            const seen = new Set<string>();
            while (graph.has(cursor)) {
                requireThat(!seen.has(cursor), 'Prerequisite rules contain a cycle.');
                seen.add(cursor);
                cursor = graph.get(cursor)!;
            }
            entity.status = 'published';
            return 'Course rule version published after graph validation.';
        } }, { key: 'score', label: 'Submit assessment result', kind: 'attempt', from: ['submitted'], roles: [roles[1]!], run: ({ state, entity, actor, add }) => {
            requireThat(entity.fields['learner'] === actor.name, 'Only the owning learner can submit this assessment.'); const course = find(state.entities, text(entity.fields, 'course'));
            requireThat(course.status === 'published', 'Assessment course is not published.');
            const previous = linked(state.entities, 'attempt', 'course', course.id).filter(row => row.id !== entity.id && row.fields['learner'] === entity.fields['learner']);
            requireThat(!previous.some(row => row.status === 'passed'), 'Learner already passed this assessment.');
            requireThat(number(entity.fields, 'attempt') === previous.length + 1, 'Attempt sequence is invalid.');
            entity.status = number(entity.fields, 'score') >= number(course.fields, 'passing') ? 'passed' : 'failed';
            if (entity.status === 'passed')
                add('completion', 'Completion · ' + course.title, { course: course.id, learner: text(entity.fields, 'learner'), ruleVersion: number(course.fields, 'version') }, 'verified');
            return 'Assessment scored and completion evidence updated.';
        } }, { key: 'award', label: 'Award credential', kind: 'award', from: ['pending'], roles: [roles[2]!], run: ({ state, entity }) => { const learner = text(entity.fields, 'learner'), requirements = linked(state.entities, 'requirement', 'certification', text(entity.fields, 'certification')); const completed = new Set(rows(state.entities, 'completion').filter(row => row.fields['learner'] === learner).map(row => text(row.fields, 'course'))); requireThat(requirements.length > 0 && requirements.every(row => completed.has(text(row.fields, 'course'))), 'Learner has not completed every certification requirement.'); entity.status = 'awarded'; return 'Credential awarded from versioned completion evidence.'; } }, { key: 'expire', label: 'Mark credential expired', kind: 'award', from: ['awarded'], roles: [roles[0]!], run: ({ entity, now }) => { requireThat(text(entity.fields, 'expires') < now.slice(0, 10), 'Credential is still current.'); entity.status = 'expired'; return 'Credential marked expired; historical award retained.'; } }];
const seed = [entity('course-1', 'course', 'Secure cloud foundations', 'draft', { code: 'SCF-101', version: 1, passing: 80 }), entity('cert-1', 'certification', 'Cloud operations certification', 'published', { code: 'COC-1', validDays: 365, minimumScore: 80 }), entity('req-1', 'requirement', 'Cloud foundation requirement', 'active', { certification: 'cert-1', course: 'course-1' }), entity('attempt-1', 'attempt', 'Omar · SCF attempt 1', 'submitted', { course: 'course-1', learner: 'Omar Saleh', score: 65, attempt: 1 })];
const attemptKind = kinds.find(item => item.key === 'attempt')!;
attemptKind.states.push('draft', 'cancelled');
attemptKind.fields.push({ ...num('ruleVersion', 'Pinned rule version', 1, 1), required: false }, { ...num('passingSnapshot', 'Pinned passing score', 80, 0, 100), required: false }, { ...ref('previousAttempt', 'Previous attempt', 'attempt'), required: false }, { ...num('previousVersion', 'Previous result version', 1, 1), required: false });
const awardKind = kinds.find(item => item.key === 'award')!;
awardKind.fields.push({...ref('previousAward','Previous credential','award'),required:false});
const retakeEligibility = (entities: Entity[], previous: Entity, learner: string, excludeId?: string) => {
    const course = find(entities, text(previous.fields, 'course'), 'course');
    requireThat(course.status === 'published', 'Assessment course is not published.');
    requireThat(previous.fields['learner'] === learner && previous.status === 'failed', 'Retakes require the owning learner and a failed previous result.');
    const attempts = linked(entities, 'attempt', 'course', course.id).filter(item => item.fields['learner'] === learner && item.id !== excludeId && item.status !== 'cancelled');
    requireThat(!attempts.some(item => item.status === 'passed'), 'Learner already passed this assessment.');
    requireThat(attempts.every(item => item.status === 'failed'), 'Finish or cancel the pending assessment before starting a retake.');
    const ordered = [...attempts].sort((a, b) => number(a.fields, 'attempt') - number(b.fields, 'attempt'));
    requireThat(ordered.every((item, index) => item.fields['attempt'] === index + 1) && ordered.at(-1)?.id === previous.id, 'Retake must follow the latest contiguous attempt.');
    requireThat(ordered.length < 5, 'The five-attempt limit has been reached.');
    const prerequisites = linked(entities, 'prerequisite', 'course', course.id);
    requireThat(prerequisites.every(rule => rows(entities, 'completion').some(completion => completion.fields['course'] === rule.fields['requires'] && completion.fields['learner'] === learner)), 'Complete all prerequisite courses before a retake.');
    return course;
};
operations.push(
    {key:'save-retake-draft',label:'Save unfinished retake',kind:'attempt',from:['draft'],roles:[roles[1]!],fields:[num('score','Draft retake score',0,0,100)],run:({state,entity,actor,input}) => {
        requireThat(entity.fields['learner'] === actor.name,'Only the owning learner can save this retake draft.');
        const previous=find(state.entities,text(entity.fields,'previousAttempt'),'attempt');
        retakeEligibility(state.entities,previous,actor.name,entity.id);
        requireThat(previous.revision === entity.fields['previousVersion'],'Previous result changed. Refresh the retake before saving.');
        entity.fields['score']=number(input,'score');return 'Unfinished retake saved without submitting a result or issuing completion evidence.';
    }},
    { key: 'start-retake', label: 'Create assessment retake', kind: 'attempt', from: ['failed'], roles: [roles[1]!], run: ({ state, entity, actor, add }) => {
        const course = retakeEligibility(state.entities, entity, actor.name);
        add('attempt', 'Retake · ' + course.title, { course: course.id, learner: actor.name, score: 0, attempt: number(entity.fields, 'attempt') + 1, previousAttempt: entity.id, previousVersion: entity.revision, ruleVersion: number(course.fields, 'version'), passingSnapshot: number(course.fields, 'passing') }, 'draft');
        return 'Retake draft created with ordered attempt and pinned assessment rules.';
    } },
    { key: 'submit-retake', label: 'Submit retake result', kind: 'attempt', from: ['draft'], roles: [roles[1]!], fields: [num('score', 'Retake score', 0, 0, 100)], run: ({ state, entity, actor, input, add }) => {
        requireThat(entity.fields['learner'] === actor.name, 'Only the owning learner can submit this retake.');
        const previous = find(state.entities, text(entity.fields, 'previousAttempt'), 'attempt');
        const course = retakeEligibility(state.entities, previous, actor.name, entity.id);
        requireThat(previous.revision === entity.fields['previousVersion'] && number(entity.fields, 'attempt') === number(previous.fields, 'attempt') + 1, 'Previous result changed. Refresh the retake before submission.');
        requireThat(course.fields['version'] === entity.fields['ruleVersion'] && course.fields['passing'] === entity.fields['passingSnapshot'], 'Assessment rules changed. Refresh retake rules before submitting.');
        entity.fields['score'] = number(input, 'score');
        entity.status = number(input, 'score') >= number(entity.fields, 'passingSnapshot') ? 'passed' : 'failed';
        if (entity.status === 'passed') add('completion', 'Completion · ' + course.title, { course: course.id, learner: actor.name, ruleVersion: number(entity.fields, 'ruleVersion') }, 'verified');
        return 'Retake ' + entity.status + '; result and versioned completion evidence saved.';
    } },
    { key: 'refresh-retake', label: 'Refresh retake rules', kind: 'attempt', from: ['draft'], roles: [roles[1]!], run: ({ state, entity, actor }) => {
        requireThat(entity.fields['learner'] === actor.name, 'Only the owning learner can refresh this retake.');
        const previous = find(state.entities, text(entity.fields, 'previousAttempt'), 'attempt');
        const course = retakeEligibility(state.entities, previous, actor.name, entity.id);
        entity.fields['ruleVersion'] = number(course.fields, 'version');
        entity.fields['passingSnapshot'] = number(course.fields, 'passing');
        entity.fields['previousVersion'] = previous.revision;
        entity.fields['score'] = 0;
        return 'Retake refreshed; review the current passing score before submitting a new result.';
    } },
    { key: 'cancel-retake', label: 'Cancel assessment retake', kind: 'attempt', from: ['draft'], roles: [roles[1]!], run: ({ entity, actor }) => { requireThat(entity.fields['learner'] === actor.name, 'Only the owning learner can cancel this retake.'); entity.status = 'cancelled'; return 'Retake cancelled without changing previous results.'; } },
    { key: 'revise-rules', label: 'Publish revised assessment rules', kind: 'course', from: ['published'], roles: [roles[0]!], fields: [num('passing', 'New passing score', 80, 0, 100)], run: ({ entity, input }) => { entity.fields['version'] = number(entity.fields, 'version') + 1; entity.fields['passing'] = number(input, 'passing'); return 'New assessment rule version published; historical results retained.'; } },
);
const recertificationEvidence = (entities: Entity[], award: Entity) => {
    const certification=find(entities,text(award.fields,'certification'),'certification');
    requireThat(certification.status === 'published','Certification is not published.');
    const requirements=linked(entities,'requirement','certification',certification.id);
    const evidence=requirements.map(rule => {
        const course=find(entities,text(rule.fields,'course'),'course');
        requireThat(course.status === 'published','Every required course must remain published.');
        const completion=rows(entities,'completion').find(item => item.fields['course'] === course.id && item.fields['learner'] === award.fields['learner'] && item.fields['ruleVersion'] === course.fields['version']);
        requireThat(completion,'Complete every required course under its current rule version.');
        return [completion.id,completion.revision,course.id,course.revision,course.fields['version']];
    });
    requireThat(requirements.length > 0,'Certification has no active requirements.');
    return JSON.stringify(evidence);
};
kinds.push(kind('recertification','Recertification requests',['requested','issued','cancelled'],[],[ref('previous','Expired credential','award'),ref('certification','Certification','certification'),txt('learner','Learner identity'),txt('requestedBy','Requesting learner'),txt('evidence','Pinned completion evidence'),date('expires','Renewed expiry')]));
operations.push(
    {key:'request-recertification',label:'Request credential renewal',kind:'award',from:['expired'],roles:[roles[1]!],run:({state,entity,actor,now,add}) => {
        requireThat(entity.fields['learner'] === actor.name,'Only the credential learner can request renewal.');
        requireThat(!rows(state.entities,'recertification').some(item => item.fields['previous'] === entity.id && item.status !== 'cancelled'),'A renewal request already exists for this credential.');
        const certification=find(state.entities,text(entity.fields,'certification'),'certification');
        const expires=new Date(now);expires.setUTCDate(expires.getUTCDate()+number(certification.fields,'validDays'));
        add('recertification','Renewal · '+entity.title,{previous:entity.id,certification:certification.id,learner:actor.name,requestedBy:actor.id,evidence:recertificationEvidence(state.entities,entity),expires:expires.toISOString().slice(0,10)});
        return 'Credential renewal requested with current version completion evidence.';
    }},
    {key:'issue-recertification',label:'Issue renewed credential',kind:'recertification',from:['requested'],roles:[roles[0]!],run:({state,entity,actor,add}) => {
        requireThat(actor.id !== entity.fields['requestedBy'],'Renewal requires independent administrator approval.');
        const previous=find(state.entities,text(entity.fields,'previous'),'award');
        requireThat(previous.status === 'expired' && recertificationEvidence(state.entities,previous) === entity.fields['evidence'],'Completion evidence or course rules changed. Submit a fresh renewal request.');
        add('award','Renewed · '+previous.title,{certification:text(entity.fields,'certification'),learner:text(entity.fields,'learner'),expires:text(entity.fields,'expires'),previousAward:previous.id},'awarded');
        entity.status='issued';return 'Renewed credential issued; expired award and pinned evidence retained.';
    }},
    {key:'cancel-recertification',label:'Cancel credential renewal',kind:'recertification',from:['requested'],roles:[roles[1]!],run:({entity,actor}) => {requireThat(actor.id === entity.fields['requestedBy'],'Only the requesting learner can cancel renewal.');entity.status='cancelled';return 'Credential renewal cancelled without issuing an award.';}},
);
const validate: Product['validate'] = entities => {
    for (const rule of rows(entities, 'prerequisite'))
        requireThat(rule.fields['course'] !== rule.fields['requires'], 'A course cannot require itself.');
    for (const request of rows(entities,'recertification').filter(item => item.status === 'issued')) requireThat(rows(entities,'award').some(item => item.fields['previousAward'] === request.fields['previous'] && item.status === 'awarded'),'Issued recertification requires a renewed credential.');
};
const metrics: Product['metrics'] = entities => [{ label: 'Published courses', value: String(rows(entities, 'course').filter(row => row.status === 'published').length) }, { label: 'Verified completions', value: String(rows(entities, 'completion').length) }, { label: 'Current awards', value: String(rows(entities, 'award').filter(row => row.status === 'awarded').length) }];
export const product: Product = { name: 'SkillOrbit', description: 'Versioned learning rules, assessments and credential eligibility', accent: '#4338ca', actors: roles.map((role, index) => ({ id: 'actor-' + String(index), name: ['Maya Hassan', 'Omar Saleh', 'Lina Farouk', 'Nadia Ali'][index] ?? role, role })), kinds, operations, seed, validate, metrics };
