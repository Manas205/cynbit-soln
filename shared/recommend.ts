import { z } from 'zod';
import {
  goals,
  needs,
  solutions,
  solutionIds,
  catalogVersion,
  type SolutionId,
  type GoalId,
} from './catalog.ts';

export const answersSchema = z
  .object({
    goal: z.enum(['automate', 'build', 'grow', 'property', 'learn', 'explore']),
    needs: z
      .array(z.string())
      .min(1, 'Choose at least one capability.')
      .max(3, 'Choose up to three capabilities.'),
    stage: z.enum(['new', 'existing', 'exploring']),
    timeline: z.enum(['soon', 'quarter', 'research']),
  })
  .strict()
  .superRefine((answers, ctx) => {
    const allowed = goals.find((g) => g.id === answers.goal)!.needIds;
    if (new Set(answers.needs).size !== answers.needs.length)
      ctx.addIssue({ code: 'custom', path: ['needs'], message: 'Capabilities must be unique.' });
    if (answers.needs.some((id) => !allowed.includes(id)))
      ctx.addIssue({
        code: 'custom',
        path: ['needs'],
        message: 'Choose capabilities associated with this goal.',
      });
    if (answers.needs.includes('unsure') && answers.needs.length > 1)
      ctx.addIssue({
        code: 'custom',
        path: ['needs'],
        message: 'Choose either a capability or the exploring option.',
      });
  });

export type Answers = z.infer<typeof answersSchema>;
export type DraftAnswers = {
  goal?: GoalId;
  needs: string[];
  stage?: Answers['stage'];
  timeline: Answers['timeline'];
};
export interface Match {
  id: SolutionId;
  reasons: string[];
}
export interface Recommendation {
  primary: Match;
  alternatives: Match[];
  mixed: boolean;
  context: string;
  version: string;
}

export function recommend(input: unknown): Recommendation {
  const answers = answersSchema.parse(input);
  const goal = goals.find((g) => g.id === answers.goal)!;
  const scores = Object.fromEntries(solutionIds.map((id) => [id, goal.base[id] || 0])) as Record<
    SolutionId,
    number
  >;
  for (const need of answers.needs)
    for (const [id, weight] of Object.entries(needs[need].weights))
      scores[id as SolutionId] += weight!;
  const ranked = solutionIds
    .map((id) => ({ id, score: scores[id] }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const top = ranked[0];
  const tied = ranked.length > 1 && ranked[1].score === top.score;
  const mixed = tied || top.id === 'discovery';
  const primaryId = mixed ? 'discovery' : top.id;
  const match = (id: SolutionId): Match => ({
    id,
    reasons:
      id === 'discovery'
        ? [
            tied
              ? 'Your priorities point to more than one solution, so a conversation can help narrow the scope.'
              : 'You’re still exploring, so there is no need to commit to a product yet.',
          ]
        : answers.needs.filter((n) => (needs[n].weights[id] || 0) > 0).map((n) => needs[n].title),
  });
  const alternatives = ranked
    .filter(
      (s) => s.id !== primaryId && s.id !== 'discovery' && (mixed || s.score >= top.score * 0.4),
    )
    .slice(0, 2)
    .map((s) => match(s.id));
  const context =
    answers.stage === 'existing'
      ? 'Bring a short overview of your current tools or process to the next conversation.'
      : answers.stage === 'new'
        ? 'Start with the outcome you want. You don’t need to know the technical stack yet.'
        : 'Use this as a starting point to explore. There is no commitment to a product or project.';
  return { primary: match(primaryId), alternatives, mixed, context, version: catalogVersion };
}

export const inquirySchema = z
  .object({
    answers: answersSchema,
    selectedSolution: z.enum(solutionIds as [SolutionId, ...SolutionId[]]),
    name: z.string().trim().min(2, 'Enter your full name.').max(100),
    email: z
      .email('Enter a valid email address.')
      .max(254)
      .transform((v) => v.toLowerCase()),
    company: z.string().trim().max(120).default(''),
    message: z.string().trim().max(2000, 'Keep your message under 2,000 characters.').default(''),
    consent: z.literal(true, { error: 'Please confirm that this demo can store your inquiry.' }),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!answersSchema.safeParse(data.answers).success) return;
    const result = recommend(data.answers);
    const offered = [result.primary.id, ...result.alternatives.map((a) => a.id), 'discovery'];
    if (!offered.includes(data.selectedSolution))
      ctx.addIssue({
        code: 'custom',
        path: ['selectedSolution'],
        message: 'Choose a solution offered for your answers, or change your answers first.',
      });
  });

export function buildBrief(answers: Answers, selectedSolution: SolutionId) {
  return {
    solution: solutions[selectedSolution].name,
    goal: goals.find((g) => g.id === answers.goal)!.title,
    priorities: answers.needs.map((id) => needs[id].title),
    stage: answers.stage,
    timeline: answers.timeline,
  };
}
