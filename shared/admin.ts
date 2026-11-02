import { z } from 'zod';
import { solutionIds, type SolutionId } from './catalog.ts';
import type { Answers } from './recommend.ts';
import type { ProjectBrief } from './projectBrief.ts';

export const inquiryStatuses = ['new', 'reviewing', 'contacted', 'closed'] as const;
export type InquiryStatus = (typeof inquiryStatuses)[number];
export const statusLabels: Record<InquiryStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  contacted: 'Contacted',
  closed: 'Closed',
};
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Choose a valid date.');
export const inquiryFiltersSchema = z
  .object({
    q: z.string().trim().max(120).default(''),
    status: z.enum(inquiryStatuses).optional(),
    solution: z.enum(solutionIds as [SolutionId, ...SolutionId[]]).optional(),
    from: date.optional(),
    to: date.optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'The end date must be on or after the start date.',
  });
export const inquiryUpdateSchema = z
  .object({
    status: z.enum(inquiryStatuses),
    notes: z.string().trim().max(5000, 'Keep internal notes under 5,000 characters.'),
    version: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER - 1),
  })
  .strict();
export interface InquirySummary {
  id: string;
  name: string;
  email: string;
  company: string;
  selectedSolution: SolutionId;
  createdAt: string;
  status: InquiryStatus;
  hasBrief: boolean;
}
export interface InquiryDetail extends InquirySummary {
  message: string;
  answers: Answers;
  projectBrief: ProjectBrief | null;
  recommendedSolution: SolutionId;
  notes: string;
  version: number;
  updatedAt: string | null;
}
export interface InquiryList {
  items: InquirySummary[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<InquiryStatus, number>;
}
export interface AdminSession {
  configured: boolean;
  authenticated: boolean;
  email?: string;
  csrfToken?: string;
  expiresAt?: string;
}
