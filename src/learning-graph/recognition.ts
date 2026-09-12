import type { Context, Field, Kind, Operation } from '../workspace/types';
import { find, number, requireThat, rows, text } from '../workspace/values';
const note: Field = { key: 'note', label: 'Recognition evidence', type: 'text', required: true };
export const recognitionKind: Kind = {
    key: 'recognition', label: 'Prior learning recognition', initial: 'requested', editors: [],
    states: ['requested', 'reviewed', 'rejected', 'issued', 'cancelled'],
    fields: [
        { key: 'course', label: 'Recognized course', type: 'reference', reference: 'course', required: true },
        { key: 'ruleVersion', label: 'Pinned rule version', type: 'number', integer: true, min: 1, required: true },
        { key: 'courseVersion', label: 'Course revision', type: 'number', integer: true, min: 1, required: true },
        { key: 'learner', label: 'Learner identity', type: 'text', required: true },
        { key: 'requester', label: 'Requesting actor', type: 'text', required: true },
        { key: 'reference', label: 'External evidence reference', type: 'text', required: true },
        { key: 'completedOn', label: 'External completion date', type: 'date', required: true },
        { key: 'reviewer', label: 'Evidence reviewer', type: 'text', required: false }, note,
    ],
};
function rationale(context: Context) {
    const value = text(context.input, 'note').trim();
    requireThat(value.length >= 20, 'Describe the prior-learning evidence in at least 20 characters.');
    return value;
}
function currentCourse(context: Context) {
    const course = find(context.state.entities, text(context.entity.fields, 'course'), 'course');
    requireThat(course.status === 'published' && course.revision === context.entity.fields['courseVersion'] && course.fields['version'] === context.entity.fields['ruleVersion'],
        'Course rules changed. Cancel this recognition and submit fresh evidence against the current version.');
    return course;
}
export const recognitionOperations: Operation[] = [
    {
        key: 'recognition-request', label: 'Request prior-learning recognition', kind: 'course', from: ['published'], roles: ['Learner'],
        fields: [{ key: 'reference', label: 'External evidence reference', type: 'text', required: true },
            { key: 'completedOn', label: 'External completion date', type: 'date', required: true }, note],
        run: context => {
            requireThat(text(context.input, 'completedOn') <= context.now.slice(0, 10), 'External completion cannot be in the future.');
            const reference = text(context.input, 'reference').trim();
            requireThat(reference.length >= 6, 'Identify the external evidence with at least six characters.');
            requireThat(!rows(context.state.entities, 'recognition').some(item => item.fields['course'] === context.entity.id && item.fields['requester'] === context.actor.id && ['requested', 'reviewed'].includes(item.status)), 'A recognition request is already pending.');
            context.add('recognition', 'Recognition - ' + context.entity.title, {
                course: context.entity.id, ruleVersion: number(context.entity.fields, 'version'), courseVersion: context.entity.revision,
                learner: context.actor.name, requester: context.actor.id, reference,
                completedOn: text(context.input, 'completedOn'), reviewer: '', note: rationale(context),
            });
            return 'Prior-learning evidence submitted for independent review.';
        },
    },
    {
        key: 'recognition-review', label: 'Approve recognition evidence', kind: 'recognition', from: ['requested'], roles: ['Supervisor'], fields: [note],
        run: context => {
            currentCourse(context);
            requireThat(context.entity.fields['requester'] !== context.actor.id, 'Recognition requires independent evidence review.');
            const reason = rationale(context);context.entity.fields['reviewer'] = context.actor.id;context.entity.status = 'reviewed';
            return 'Prior-learning evidence reviewed: ' + reason;
        },
    },
    {
        key: 'recognition-reject', label: 'Reject recognition evidence', kind: 'recognition', from: ['requested', 'reviewed'], roles: ['Supervisor'], fields: [note],
        run: context => { const reason = rationale(context);context.entity.status = 'rejected';return 'Prior-learning recognition rejected: ' + reason; },
    },
    {
        key: 'recognition-issue', label: 'Issue recognized completion', kind: 'recognition', from: ['reviewed'], roles: ['Learning Admin'],
        run: context => {
            const course = currentCourse(context);
            requireThat(Boolean(context.entity.fields['reviewer']) && context.entity.fields['reviewer'] !== context.actor.id, 'Issuance requires independent supervisor evidence.');
            const learner = text(context.entity.fields, 'learner');
            requireThat(!rows(context.state.entities, 'completion').some(item => item.fields['course'] === course.id && item.fields['learner'] === learner && item.fields['ruleVersion'] === course.fields['version']), 'A completion already exists for these course rules.');
            context.add('completion', 'Recognized completion - ' + course.title, { course: course.id, learner, ruleVersion: number(course.fields, 'version') }, 'verified');
            context.entity.status = 'issued';
            return 'Recognized completion issued with course-version and evidence provenance.';
        },
    },
    {
        key: 'recognition-cancel', label: 'Cancel recognition request', kind: 'recognition', from: ['requested', 'reviewed'], roles: ['Learner'], fields: [note],
        run: context => {
            requireThat(context.entity.fields['requester'] === context.actor.id, 'Only the requesting learner may cancel recognition.');
            const reason = rationale(context);context.entity.status = 'cancelled';return 'Recognition request cancelled: ' + reason;
        },
    },
];
