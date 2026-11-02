import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  caseStudies,
  filterCaseStudies,
  matchingCaseStudies,
  findCaseStudy,
} from '../shared/caseStudies.ts';
import { caseStudyContext } from '../src/caseStudyFlow.ts';
import { inquirySchema, recommend } from '../shared/recommend.ts';
import { createProjectBrief } from '../shared/projectBrief.ts';
import { parseBriefDraft, sameBriefContext } from '../src/briefDraft.ts';
import { softwareAnswers, softwareBrief, demoContact } from './brief-fixtures.ts';

test('gallery search combines words, service and industry, with a usable empty state', () => {
  assert.equal(filterCaseStudies('  INVOICE   review ').length, 1);
  assert.equal(
    filterCaseStudies('CRM', 'software', 'Professional services')[0].id,
    'connected-service-portal',
  );
  assert.equal(filterCaseStudies('', 'ai-automation').length, 2);
  assert.equal(filterCaseStudies('inventory', 'ai-automation').length, 0);
  assert.equal(filterCaseStudies('', 'software', 'E-commerce').length, 0);
  assert.equal(filterCaseStudies('   ').length, 4);
  assert.equal(filterCaseStudies('<script>').length, 0);
  assert.equal(findCaseStudy('not-a-project'), undefined);
});

test('recommendations stay relevant to the chosen service and rank matching priorities first', () => {
  assert.equal(matchingCaseStudies('software', ['migration'])[0].id, 'connected-inventory');
  assert.equal(
    matchingCaseStudies('ai-automation', ['assistants'])[0].id,
    'support-knowledge-assistant',
  );
  assert.ok(
    matchingCaseStudies('software', ['documents']).every((study) => study.service === 'software'),
  );
  for (const id of ['marketing', 'tenantease', 'discovery'] as const)
    assert.deepEqual(matchingCaseStudies(id, []), []);
});

test('every demonstration opens a valid service brief without copying fictional project content', () => {
  for (const study of caseStudies) {
    assert.equal(study.evidence.status, 'demonstration');
    assert.match(study.evidence.note, /No client results have been verified/);
    const answers = caseStudyContext(study, { needs: [], timeline: 'research' });
    assert.equal(recommend(answers).primary.id, study.service);
    assert.equal(answers.sourceCaseStudyId, study.id);
    assert.equal(answers.stage, 'exploring');
    const brief = createProjectBrief(study.service);
    assert.equal(brief.problem, '');
    assert.equal(brief.success, '');
    assert.ok(
      inquirySchema.safeParse({ ...demoContact, answers, selectedSolution: study.service }).success,
    );
    const restored = parseBriefDraft(JSON.stringify({ answers, brief, step: 0 }));
    assert.equal(restored?.brief.solution, study.service);
    assert.equal(restored?.answers.sourceCaseStudyId, study.id);
  }
});

test('handoff preserves matching finder answers and recovered project answers', () => {
  const study = findCaseStudy('connected-service-portal')!;
  const answers = caseStudyContext(study, softwareAnswers);
  assert.deepEqual(answers, { ...softwareAnswers, sourceCaseStudyId: study.id });
  const restored = parseBriefDraft(JSON.stringify({ answers, brief: softwareBrief, step: 2 }));
  assert.deepEqual(restored?.brief, softwareBrief);
  assert.equal(restored?.step, 2);
  assert.equal(sameBriefContext(softwareAnswers, answers), false);
  const switched = caseStudyContext(findCaseStudy('invoice-review-workflow')!, answers);
  assert.equal(switched.goal, 'automate');
  assert.equal(recommend(switched).primary.id, 'ai-automation');
});

test('source metadata cannot authorize unrelated solutions or unknown case studies', () => {
  const valid = {
    ...demoContact,
    selectedSolution: 'software',
    answers: caseStudyContext(caseStudies[0], softwareAnswers),
  };
  assert.ok(inquirySchema.safeParse(valid).success);
  assert.equal(inquirySchema.safeParse({ ...valid, selectedSolution: 'marketing' }).success, false);
  assert.equal(
    inquirySchema.safeParse({ ...valid, answers: { ...valid.answers, sourceCaseStudyId: 'fake' } })
      .success,
    false,
  );
  assert.equal(
    inquirySchema.safeParse({
      ...valid,
      answers: { ...valid.answers, sourceCaseStudyId: 'invoice-review-workflow' },
    }).success,
    false,
  );
});
