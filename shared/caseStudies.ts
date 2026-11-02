import { z } from 'zod';
import { solutions, type SolutionId } from './catalog.ts';

export type CaseStudyService = 'software' | 'ai-automation';
export interface CaseStudy {
  id: string;
  title: string;
  industry: string;
  service: CaseStudyService;
  needs: string[];
  summary: string;
  problem: string;
  solution: string;
  challenge: string;
  approach: { title: string; description: string }[];
  deliverables: string[];
  measurements: string[];
  visual: 'portal' | 'inventory' | 'documents' | 'support';
  // Demonstrations have no client, outcome metric, or approval claim.
  evidence: { status: 'demonstration'; note: string };
}

const demoEvidence: CaseStudy['evidence'] = {
  status: 'demonstration',
  note: 'Fictional scenario created to explain a possible approach. This is not a delivered Cynbit client project. No client results have been verified.',
};

export const caseStudies: CaseStudy[] = [
  {
    id: 'connected-service-portal',
    title: 'One place for every service request.',
    industry: 'Professional services',
    service: 'software',
    needs: ['web-app', 'integrations'],
    summary:
      'A shared workspace that could bring customers, requests, and delivery teams together.',
    problem: 'Requests get scattered across email and spreadsheets.',
    solution: 'A customer portal with ownership, status, and a shared history.',
    challenge:
      'Imagine a service business where customers email requests to different teams. Staff copy details into spreadsheets, and nobody has a reliable view of who owns the next step. The challenge is to make handoffs visible without adding another disconnected tool.',
    approach: [
      {
        title: 'Map the handoffs',
        description:
          'Interview the people handling requests and agree on a small set of statuses, owners, and customer permissions.',
      },
      {
        title: 'Build the shared workspace',
        description:
          'Prototype request intake, assignment, attachments, and a customer-facing status view. Connect the existing CRM through an API.',
      },
      {
        title: 'Pilot before expanding',
        description:
          'Test with a small team, verify access boundaries, and collect feedback before migrating additional work.',
      },
    ],
    deliverables: [
      'Customer request portal',
      'Role-based access',
      'CRM integration',
      'Request audit history',
    ],
    measurements: [
      'Compare request assignment time before and after a pilot.',
      'Count missed handoffs using the same definition in both periods.',
      'Ask customers whether they can find the status without emailing.',
    ],
    visual: 'portal',
    evidence: demoEvidence,
  },
  {
    id: 'connected-inventory',
    title: 'A clearer view of stock, across stores.',
    industry: 'Retail',
    service: 'software',
    needs: ['migration', 'integrations'],
    summary:
      'A possible path from disconnected stock sheets to a connected operations application.',
    problem: 'Store teams work from different versions of inventory data.',
    solution: 'A central inventory app connected to existing sales tools.',
    challenge:
      'In this example, a retailer reconciles stock through spreadsheets shared between stores. Updates arrive late, and staff must check several sources before confirming availability. A replacement needs to respect existing store workflows and remain useful when a connection fails.',
    approach: [
      {
        title: 'Understand the source data',
        description:
          'Map product identifiers, stock movements, and the systems responsible for each record. Identify migration and reconciliation rules.',
      },
      {
        title: 'Connect the operations',
        description:
          'Build a shared inventory view, transfer requests, and exception alerts. Make synchronization failures visible and safe to retry.',
      },
      {
        title: 'Migrate in stages',
        description:
          'Validate a sample import, reconcile stock totals, and pilot one location before planning a wider rollout.',
      },
    ],
    deliverables: [
      'Inventory workspace',
      'Store transfer workflow',
      'Sales-system API connection',
      'Migration and reconciliation plan',
    ],
    measurements: [
      'Compare physical stock counts with recorded balances.',
      'Measure time needed to answer a stock availability request.',
      'Track synchronization failures and recovery during the pilot.',
    ],
    visual: 'inventory',
    evidence: demoEvidence,
  },
  {
    id: 'invoice-review-workflow',
    title: 'From invoice inbox to review-ready data.',
    industry: 'Finance & operations',
    service: 'ai-automation',
    needs: ['documents', 'workflows'],
    summary: 'An example of document automation with a person in control of the final approval.',
    problem: 'Finance teams repeatedly copy invoice details between tools.',
    solution: 'AI-assisted extraction with validation and human approval.',
    challenge:
      'Consider an operations team receiving invoices in different layouts. People retype the same fields, check supplier details, and chase missing information. The opportunity is to reduce repetitive entry while keeping financial decisions with an authorized reviewer.',
    approach: [
      {
        title: 'Define the review rules',
        description:
          'Agree on required fields, duplicate checks, approval responsibilities, and how sensitive documents should be handled.',
      },
      {
        title: 'Extract, then validate',
        description:
          'Use document extraction to prepare draft records. Flag missing fields, uncertain readings, and mismatched totals for review.',
      },
      {
        title: 'Keep a person in control',
        description:
          'Show the source alongside extracted data. Export only approved records and keep a history of edits; never authorize payments automatically.',
      },
    ],
    deliverables: [
      'Document intake workflow',
      'Extraction and validation rules',
      'Human review queue',
      'Approved-record export',
    ],
    measurements: [
      'Check field accuracy against a manually reviewed sample.',
      'Measure reviewer corrections and missed exceptions.',
      'Compare handling time on equivalent document batches.',
    ],
    visual: 'documents',
    evidence: demoEvidence,
  },
  {
    id: 'support-knowledge-assistant',
    title: 'Give support teams a better starting point.',
    industry: 'E-commerce',
    service: 'ai-automation',
    needs: ['assistants', 'workflows'],
    summary: 'A support assistant concept grounded in approved help content and human review.',
    problem: 'Agents repeatedly search for policies and write similar replies.',
    solution: 'An internal assistant that drafts answers with source links.',
    challenge:
      'In this fictional store, support agents answer recurring questions about orders, returns, and product information. Policies change, and copying an old reply can create confusion. An assistant would need to show where an answer comes from and know when to hand the question back.',
    approach: [
      {
        title: 'Prepare trusted content',
        description:
          'Identify approved policies, their owners, and a process for updates. Exclude information the support team should not access.',
      },
      {
        title: 'Draft with sources',
        description:
          'Retrieve relevant content and suggest a response with links. Ask for human input when the material does not support an answer.',
      },
      {
        title: 'Evaluate before release',
        description:
          'Review a representative set of questions for correctness and unsupported claims. Keep agents responsible for sending customer replies.',
      },
    ],
    deliverables: [
      'Internal knowledge assistant',
      'Source-linked draft responses',
      'Escalation rules',
      'Evaluation question set',
    ],
    measurements: [
      'Have reviewers check answer correctness and source support.',
      'Track unsupported answers and successful escalations.',
      'Compare agent handling time without compromising answer quality.',
    ],
    visual: 'support',
    evidence: demoEvidence,
  },
];

export const findCaseStudy = (id: string | undefined) =>
  caseStudies.find((study) => study.id === id);
export const caseStudyIdSchema = z
  .string()
  .refine((id) => !!findCaseStudy(id), 'Choose a known case study.');

export function filterCaseStudies(query: string, service = '', industry = '') {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return caseStudies.filter((study) => {
    const text = [
      study.title,
      study.industry,
      solutions[study.service].name,
      study.summary,
      study.problem,
      study.solution,
      ...study.deliverables,
    ]
      .join(' ')
      .toLocaleLowerCase();
    return (
      (!service || study.service === service) &&
      (!industry || study.industry === industry) &&
      words.every((word) => text.includes(word))
    );
  });
}

export function matchingCaseStudies(service: SolutionId, priorities: string[]) {
  return caseStudies
    .filter((study) => study.service === service)
    .map((study, index) => ({
      study,
      index,
      score: study.needs.filter((need) => priorities.includes(need)).length,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 2)
    .map(({ study }) => study);
}

export const caseStudyEventSchema = z
  .object({
    id: z.uuid(),
    caseStudyId: caseStudyIdSchema,
    type: z.enum(['view', 'brief_start', 'inquiry_start']),
    source: z.enum(['gallery', 'recommendation']),
  })
  .strict();
export type CaseStudyEvent = z.infer<typeof caseStudyEventSchema>;
export type CaseStudyMetrics = {
  caseStudyId: string;
  views: number;
  briefStarts: number;
  inquiryStarts: number;
};
