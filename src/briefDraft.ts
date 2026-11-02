import { z } from 'zod';
import { answersSchema, recommend, type Answers } from '../shared/recommend.ts';
import { projectBriefDraftSchema, projectBriefSchema } from '../shared/projectBrief.ts';

export const BRIEF_DRAFT_KEY = 'cynbit-project-brief-v1';
const envelopeSchema = z
  .object({
    answers: answersSchema,
    brief: projectBriefDraftSchema,
    step: z.number().int().min(0).max(2),
  })
  .strict();
export type BriefDraftEnvelope = z.infer<typeof envelopeSchema>;

// Order of selected capabilities does not change project intent.
export function sameBriefContext(left: Answers, right: Answers) {
  return (
    sameBriefIntent(left, right) &&
    left.stage === right.stage &&
    left.timeline === right.timeline &&
    left.sourceCaseStudyId === right.sourceCaseStudyId
  );
}

export function sameBriefIntent(left: Answers, right: Answers) {
  return (
    left.goal === right.goal &&
    [...left.needs].sort().join('|') === [...right.needs].sort().join('|')
  );
}

export function parseBriefDraft(raw: string | null): BriefDraftEnvelope | null {
  try {
    const parsed = envelopeSchema.safeParse(JSON.parse(raw || 'null'));
    if (!parsed.success) return null;
    const { answers, brief } = parsed.data;
    const match = recommend(answers);
    if (![match.primary.id, ...match.alternatives.map((item) => item.id)].includes(brief.solution))
      return null;
    const complete = projectBriefSchema.safeParse(brief);
    const problemFields = [
      'problem',
      'audience',
      'currentSystem',
      'currentProcess',
      'frequency',
      'tools',
    ];
    const step =
      !complete.success &&
      (parsed.data.step === 2 ||
        complete.error.issues.some((issue) => problemFields.includes(String(issue.path[0]))))
        ? 0
        : parsed.data.step;
    return { ...parsed.data, step };
  } catch {
    return null;
  }
}

export function readBriefDraft(): BriefDraftEnvelope | null {
  try {
    return parseBriefDraft(sessionStorage.getItem(BRIEF_DRAFT_KEY));
  } catch {
    return null;
  }
}
