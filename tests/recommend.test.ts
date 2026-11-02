import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answersSchema, inquirySchema, recommend, type Answers } from '../shared/recommend.ts';

const answer = (
  goal: Answers['goal'],
  needs: string[],
  stage: Answers['stage'] = 'existing',
): Answers => ({ goal, needs, stage, timeline: 'quarter' });

const cases: [Answers['goal'], string[], string][] = [
  ['property', ['rent', 'tenants'], 'tenantease'],
  ['grow', ['reviews', 'locations'], 'revio'],
  ['grow', ['acquisition', 'conversion'], 'marketing'],
  ['automate', ['workflows', 'documents'], 'ai-automation'],
  ['build', ['web-app', 'integrations'], 'software'],
  ['build', ['cloud'], 'cloud'],
  ['learn', ['practice', 'interviews'], 'studio'],
  ['learn', ['mentorship', 'projects'], 'bitelevate'],
  ['explore', ['unsure'], 'discovery'],
];
for (const [goal, needs, expected] of cases)
  test(`${goal}: ${needs.join(', ')} recommends ${expected}`, () => {
    assert.equal(recommend(answer(goal, needs)).primary.id, expected);
  });

test('equally strong cross-service priorities recommend a conversation with both options explained', () => {
  const result = recommend(answer('grow', ['reviews', 'acquisition']));
  assert.equal(result.primary.id, 'discovery');
  assert.equal(result.mixed, true);
  assert.deepEqual(new Set(result.alternatives.map((a) => a.id)), new Set(['marketing', 'revio']));
  assert.ok(result.alternatives.every((a) => a.reasons.length > 0));
});

test('timing and starting stage never upsell or change the recommended product', () => {
  assert.equal(
    recommend({ ...answer('property', ['rent'], 'exploring'), timeline: 'research' }).primary.id,
    'tenantease',
  );
  assert.equal(
    recommend({ ...answer('property', ['rent'], 'new'), timeline: 'soon' }).primary.id,
    'tenantease',
  );
});

test('invalid, stale, duplicate, excessive, and contradictory answers are rejected', () => {
  for (const input of [
    { ...answer('property', ['rent']), goal: 'unknown' },
    answer('property', []),
    answer('property', ['reviews']),
    answer('property', ['rent', 'rent']),
    answer('property', ['rent', 'tenants', 'units', 'reminders']),
    answer('explore', ['unsure', 'reviews']),
  ])
    assert.equal(answersSchema.safeParse(input).success, false);
});

test('an unrelated product cannot be substituted in an inquiry', () => {
  const valid = {
    answers: answer('property', ['rent']),
    selectedSolution: 'tenantease',
    name: 'Demo Visitor',
    email: 'demo@example.com',
    consent: true,
  };
  assert.equal(inquirySchema.safeParse(valid).success, true);
  assert.equal(inquirySchema.safeParse({ ...valid, selectedSolution: 'studio' }).success, false);
  assert.equal(inquirySchema.safeParse({ ...valid, selectedSolution: 'discovery' }).success, true);
});

test('invalid nested answers return validation errors instead of throwing', () => {
  const parsed = inquirySchema.safeParse({
    answers: answer('property', ['reviews']),
    selectedSolution: 'studio',
    name: 'Demo Visitor',
    email: 'demo@example.com',
    consent: true,
  });
  assert.equal(parsed.success, false);
});
