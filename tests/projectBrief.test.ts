import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProjectBrief,
  projectBriefSchema,
  projectBriefText,
} from '../shared/projectBrief.ts';
import { inquirySchema } from '../shared/recommend.ts';
import { parseBriefDraft, sameBriefContext, sameBriefIntent } from '../src/briefDraft.ts';
import {
  softwareAnswers,
  automationAnswers,
  softwareBrief,
  automationBrief,
  demoContact,
} from './brief-fixtures.ts';

test('both service briefs validate and export the complete project context', () => {
  for (const [brief, answers] of [
    [softwareBrief, softwareAnswers],
    [automationBrief, automationAnswers],
  ] as const) {
    const valid = projectBriefSchema.parse(brief);
    const text = projectBriefText(valid, answers, 'DEMO-123');
    for (const value of [
      brief.problem,
      brief.audience,
      brief.mustHaves,
      brief.niceToHaves,
      brief.integrations,
      brief.success,
      brief.budget,
      'DEMO-123',
    ])
      assert.ok(text.includes(value));
    assert.match(text, /Timeline:/);
    assert.match(text, /Priorities:/);
    assert.match(text, /No inquiry has been sent/);
    assert.ok(!text.includes(demoContact.email));
  }
  assert.match(projectBriefText(automationBrief, automationAnswers), /Every day/);
  assert.match(projectBriefText(softwareBrief, softwareAnswers), /Shared spreadsheets/);
});

test('required requirements and service-specific answers cannot be blank or oversized', () => {
  for (const brief of [softwareBrief, automationBrief]) {
    for (const key of ['problem', 'audience', 'mustHaves', 'success'])
      assert.equal(projectBriefSchema.safeParse({ ...brief, [key]: '   ' }).success, false);
    assert.equal(
      projectBriefSchema.safeParse({ ...brief, problem: 'a'.repeat(1201) }).success,
      false,
    );
  }
  assert.equal(
    projectBriefSchema.safeParse({ ...softwareBrief, currentSystem: '' }).success,
    false,
  );
  assert.equal(
    projectBriefSchema.safeParse({ ...automationBrief, currentProcess: '' }).success,
    false,
  );
  assert.equal(projectBriefSchema.safeParse({ ...automationBrief, frequency: '' }).success, false);
  assert.equal(projectBriefSchema.safeParse({ ...automationBrief, tools: '' }).success, false);
});

test('optional fields stay optional and unknown budget is represented honestly', () => {
  const brief = projectBriefSchema.parse({
    ...softwareBrief,
    budget: '  ',
    integrations: '',
    niceToHaves: '',
  });
  assert.match(projectBriefText(brief, softwareAnswers), /Not sure yet/);
  assert.match(projectBriefText(brief, softwareAnswers), /To discuss/);
});

test('inquiry validation rejects mismatched and unsupported brief types and stale fields', () => {
  const base = { answers: softwareAnswers, selectedSolution: 'software', ...demoContact };
  assert.equal(inquirySchema.safeParse({ ...base, projectBrief: softwareBrief }).success, true);
  assert.equal(inquirySchema.safeParse({ ...base, projectBrief: automationBrief }).success, false);
  for (const brief of [
    { ...softwareBrief, solution: 'tenantease' },
    { ...softwareBrief, currentProcess: 'Stale automation data' },
    { ...automationBrief, currentSystem: 'Stale software data' },
    { ...softwareBrief, version: 2 },
  ])
    assert.equal(projectBriefSchema.safeParse(brief).success, false);
  assert.equal(inquirySchema.safeParse(base).success, true);
});

test('draft recovery preserves unfinished scope and rejects malformed or unrelated data', () => {
  const envelope = { answers: softwareAnswers, brief: { ...softwareBrief, success: '' }, step: 1 };
  assert.deepEqual(parseBriefDraft(JSON.stringify(envelope)), envelope);
  assert.equal(parseBriefDraft('{broken'), null);
  assert.equal(parseBriefDraft(JSON.stringify({ ...envelope, step: 10 })), null);
  assert.equal(
    parseBriefDraft(
      JSON.stringify({ ...envelope, brief: { ...softwareBrief, contact: demoContact } }),
    ),
    null,
  );
  assert.equal(
    parseBriefDraft(
      JSON.stringify({
        ...envelope,
        answers: { ...softwareAnswers, goal: 'property', needs: ['rent'] },
      }),
    ),
    null,
  );
  const incomplete = { ...envelope, brief: createProjectBrief('software'), step: 2 };
  assert.equal(parseBriefDraft(JSON.stringify(incomplete))?.step, 0);
});

test('context changes invalidate a draft while capability order does not', () => {
  assert.equal(
    sameBriefContext(softwareAnswers, {
      ...softwareAnswers,
      needs: [...softwareAnswers.needs].reverse(),
    }),
    true,
  );
  assert.equal(sameBriefContext(softwareAnswers, { ...softwareAnswers, timeline: 'soon' }), false);
  assert.equal(
    sameBriefContext(softwareAnswers, { ...softwareAnswers, needs: ['web-app'] }),
    false,
  );
  assert.equal(sameBriefContext(softwareAnswers, automationAnswers), false);
});

test('switching service starts a clean draft with only the new service fields', () => {
  const fresh = createProjectBrief('ai-automation');
  assert.equal(fresh.problem, '');
  assert.equal('currentSystem' in fresh, false);
  assert.equal('currentProcess' in fresh, true);
  assert.equal('tools' in createProjectBrief('software'), false);
});

test('timing and stage edits keep project intent while goal and priority edits change it', () => {
  assert.equal(
    sameBriefIntent(softwareAnswers, { ...softwareAnswers, timeline: 'soon', stage: 'new' }),
    true,
  );
  assert.equal(sameBriefIntent(softwareAnswers, { ...softwareAnswers, needs: ['web-app'] }), false);
  assert.equal(sameBriefIntent(softwareAnswers, automationAnswers), false);
});
