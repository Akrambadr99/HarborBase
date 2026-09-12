# SkillOrbit task calibration report

SkillOrbit is calibrated around prerequisite graphs, versioned learning evidence, assessment ownership, and expiring requirements. The new planner makes proposed graph edges and their cycle path visible before mutation.

| Workflow group | Why it is medium | React/state concepts | Hidden-test determinism | Likely future patch |
|---|---|---|---|---|
| Prerequisite planning | Two selections and a transitive graph determine one outcome | graph traversal, memoized derived state | High | 1–3 existing files |
| Learner eligibility | Versions, completions, expiry, and filters interact | selectors, keyed state, fixed clock | High | 2–4 files |
| Assessment attempts | Drafts and delayed scoring must remain learner-owned | entity drafts, stale response control | High | 2–4 files |
| Certification lifecycle | Awards, notifications, and evidence span bounded states | reducer transitions, permissions | High | 1–4 files |

## Calibration

- **Medium majority:** prerequisite cycle path; proposed-edge selection; course-switch graph state; learner eligibility filters; saved views per instructor; assessment drafts per learner; stale scoring results; optimistic score rollback; version-aware completion; expiring requirement dates; partial certification award; course cursor pagination; structured catalog search; evidence attachment validation; comment mentions; dated approval delegation; notification snooze; import mapping conflicts; activity filters; cross-tab refresh preserving attempts.
- **Reject as Too Easy:** rename a course state; change one badge; require a score field; show static expiry copy.
- **Reject as Too Hard:** replace the learning graph; migrate all course versions; build a content-authoring suite; orchestrate several external LMS products.

The 20 Medium directions above use fixed courses, edges, attempts, learners, versions, and dates and normally fit 1–4 existing files.
