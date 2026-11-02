import type { Answers } from '../shared/recommend.ts';
import type { ProjectBrief } from '../shared/projectBrief.ts';

export const softwareAnswers: Answers = {
  goal: 'build',
  needs: ['web-app', 'integrations'],
  stage: 'existing',
  timeline: 'quarter',
};
export const automationAnswers: Answers = {
  goal: 'automate',
  needs: ['workflows'],
  stage: 'existing',
  timeline: 'soon',
};
const common = {
  version: 1 as const,
  problem: 'Customer follow-ups are getting lost in spreadsheets.',
  audience: 'Our 12-person support team.',
  mustHaves: 'Create requests\nAssign owners\nTrack status',
  niceToHaves: 'Weekly reports',
  integrations: 'Zoho CRM',
  success: 'Reduce daily manual work from two hours to 15 minutes.',
  budget: '₹2–5 lakh',
};
export const softwareBrief: ProjectBrief = {
  ...common,
  solution: 'software',
  currentSystem: 'Shared spreadsheets and email.',
};
export const automationBrief: ProjectBrief = {
  ...common,
  solution: 'ai-automation',
  currentProcess: 'Copy website leads into our CRM, deduplicate, and assign an owner.',
  frequency: 'daily',
  tools: 'Forms, email, Zoho CRM',
};
export const demoContact = {
  name: 'Demo Visitor',
  email: 'demo@example.com',
  company: 'Fictional Demo Co',
  consent: true,
};
