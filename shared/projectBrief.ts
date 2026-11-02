import { z } from 'zod';
import { goals, needs, solutions, stages, timelines, type SolutionId } from './catalog.ts';
import type { Answers } from './recommend.ts';

export const briefSolutions = ['software', 'ai-automation'] as const;
export type BriefSolution = (typeof briefSolutions)[number];
export const frequencies = [
  { id: 'daily', label: 'Every day' },
  { id: 'weekly', label: 'Every week' },
  { id: 'monthly', label: 'Every month' },
  { id: 'variable', label: 'As requests arrive' },
  { id: 'unsure', label: 'Not sure yet' },
] as const;

export function supportsProjectBrief(solution: SolutionId): solution is BriefSolution {
  return briefSolutions.some((id) => id === solution);
}

const commonFields = {
  version: z.literal(1),
  problem: z.string().max(1200),
  audience: z.string().max(400),
  mustHaves: z.string().max(1200),
  niceToHaves: z.string().max(800),
  integrations: z.string().max(600),
  success: z.string().max(800),
  budget: z.string().max(120),
};
const softwareFields = {
  solution: z.literal('software'),
  currentSystem: z.string().max(800),
};
const automationFields = {
  solution: z.literal('ai-automation'),
  currentProcess: z.string().max(1200),
  frequency: z.enum(['', 'daily', 'weekly', 'monthly', 'variable', 'unsure']),
  tools: z.string().max(600),
};

// Drafts may be incomplete, but must have the expected shape and bounded values.
export const projectBriefDraftSchema = z.discriminatedUnion('solution', [
  z.object({ ...commonFields, ...softwareFields }).strict(),
  z.object({ ...commonFields, ...automationFields }).strict(),
]);
export type ProjectBriefDraft = z.infer<typeof projectBriefDraftSchema>;

const requiredText = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max);
const completeFields = {
  ...commonFields,
  problem: requiredText(10, 1200, 'Describe the problem in at least 10 characters.'),
  audience: requiredText(3, 400, 'Tell us who this project is for.'),
  mustHaves: requiredText(3, 1200, 'Add at least one must-have requirement.'),
  niceToHaves: z.string().trim().max(800),
  integrations: z.string().trim().max(600),
  success: requiredText(10, 800, 'Describe what success would look like.'),
  budget: z.string().trim().max(120),
};

export const projectBriefSchema = z.discriminatedUnion('solution', [
  z
    .object({
      ...completeFields,
      ...softwareFields,
      currentSystem: requiredText(
        3,
        800,
        'Describe the current system, or write “Starting fresh”.',
      ),
    })
    .strict(),
  z
    .object({
      ...completeFields,
      ...automationFields,
      currentProcess: requiredText(10, 1200, 'Describe how the task is handled today.'),
      frequency: z.enum(['daily', 'weekly', 'monthly', 'variable', 'unsure'], {
        error: 'Choose how often this task happens.',
      }),
      tools: requiredText(2, 600, 'List your current tools, or write “None yet”.'),
    })
    .strict(),
]);
export type ProjectBrief = z.infer<typeof projectBriefSchema>;

export function createProjectBrief(solution: BriefSolution): ProjectBriefDraft {
  const common = {
    version: 1 as const,
    problem: '',
    audience: '',
    mustHaves: '',
    niceToHaves: '',
    integrations: '',
    success: '',
    budget: '',
  };
  return solution === 'software'
    ? { ...common, solution, currentSystem: '' }
    : { ...common, solution, currentProcess: '', frequency: '', tools: '' };
}

export function briefSections(brief: ProjectBrief) {
  return [
    {
      title: 'The problem',
      step: 0,
      entries: [
        ['Business problem', brief.problem],
        ['Intended users or team', brief.audience],
        ...(brief.solution === 'software'
          ? [['Current system', brief.currentSystem]]
          : [
              ['Current process', brief.currentProcess],
              ['Task frequency', frequencies.find((f) => f.id === brief.frequency)!.label],
              ['Current tools', brief.tools],
            ]),
      ],
    },
    {
      title: 'Scope & success',
      step: 1,
      entries: [
        ['Must-have requirements', brief.mustHaves],
        ['Optional improvements', brief.niceToHaves || 'None specified'],
        ['Integrations', brief.integrations || 'To discuss'],
        ['Success criteria', brief.success],
        ['Budget range', brief.budget || 'Not sure yet'],
      ],
    },
  ];
}

export function projectBriefText(brief: ProjectBrief, answers: Answers, reference?: string) {
  return [
    'CYNBIT · PROJECT BRIEF',
    'Independent assessment prototype',
    '',
    ...(reference ? [`Demo reference: ${reference}`, ''] : []),
    `Selected solution: ${solutions[brief.solution].name}`,
    `Goal: ${goals.find((goal) => goal.id === answers.goal)!.title}`,
    ...(answers.sourceCaseStudyId
      ? [
          `Starting example (demonstration): ${answers.sourceCaseStudyId}`,
          'Example-derived context is editable. No client results are claimed.',
        ]
      : []),
    `Priorities: ${answers.needs.map((id) => needs[id].title).join('; ')}`,
    `Starting point: ${stages.find((s) => s.id === answers.stage)!.title}`,
    `Timeline: ${timelines.find((t) => t.id === answers.timeline)!.title}`,
    '',
    ...briefSections(brief).flatMap((section) => [
      section.title.toUpperCase(),
      '',
      ...section.entries.flatMap(([label, value]) => [label, value, '']),
    ]),
    'This brief describes your needs. It is not a quote or a confirmed service agreement.',
    'No inquiry has been sent to Cynbit by this prototype.',
  ].join('\n');
}
