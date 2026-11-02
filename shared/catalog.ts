export type SolutionId = 'ai-automation' | 'software' | 'cloud' | 'marketing' | 'tenantease' | 'revio' | 'studio' | 'bitelevate' | 'discovery';
export type GoalId = 'automate' | 'build' | 'grow' | 'property' | 'learn' | 'explore';

export interface Solution {
  id: SolutionId;
  name: string;
  category: 'Product' | 'Service' | 'Learning' | 'Consultation';
  icon: string;
  tagline: string;
  description: string;
  features: string[];
  bestFor: string;
  source: string;
}

export const solutions: Record<SolutionId, Solution> = {
  'ai-automation': {
    id: 'ai-automation', name: 'AI automation', category: 'Service', icon: 'sparkles',
    tagline: 'Less repetitive work. More room to grow.',
    description: 'Explore custom AI agents and workflow automation for the operational tasks that slow your team down.',
    features: ['Workflow & document automation', 'Custom AI assistants and agents', 'Integration with your existing tools'],
    bestFor: 'Teams with repetitive, clearly defined workflows.', source: 'https://www.cynbit.in/services',
  },
  software: {
    id: 'software', name: 'Custom software development', category: 'Service', icon: 'code',
    tagline: 'Software built around your business.',
    description: 'Plan a web application, mobile experience, or connected backend designed for your specific business needs.',
    features: ['Web & mobile applications', 'Backend APIs and integrations', 'Legacy system modernization'],
    bestFor: 'Businesses building a new product or replacing a limiting system.', source: 'https://www.cynbit.in/services',
  },
  cloud: {
    id: 'cloud', name: 'Cloud & infrastructure', category: 'Service', icon: 'cloud',
    tagline: 'A stronger foundation for what comes next.',
    description: 'Explore cloud architecture, deployment, and migration for applications that need a more reliable foundation.',
    features: ['Cloud architecture and migration', 'Deployment infrastructure', 'Scalable application foundations'],
    bestFor: 'Teams improving the infrastructure behind an existing or planned application.', source: 'https://www.cynbit.in/services',
  },
  marketing: {
    id: 'marketing', name: 'Digital growth & technical SEO', category: 'Service', icon: 'chart',
    tagline: 'Help the right customers find you.',
    description: 'Connect technical SEO, acquisition campaigns, and conversion improvements to your business growth goals.',
    features: ['Technical SEO', 'Performance advertising', 'Conversion and CRM workflows'],
    bestFor: 'Businesses focused on customer acquisition and website conversion.', source: 'https://www.cynbit.in/services',
  },
  tenantease: {
    id: 'tenantease', name: 'TenantEase', category: 'Product', icon: 'building',
    tagline: 'Your properties. One clear picture.',
    description: 'Bring properties, tenants, and rent tracking into one place, with less reliance on spreadsheets and scattered conversations.',
    features: ['Property and tenant management', 'Rent tracking and payment history', 'Automated payment reminders'],
    bestFor: 'Property owners and managers organizing rental operations.', source: 'https://www.cynbit.in/products#tenantease',
  },
  revio: {
    id: 'revio', name: 'Revio', category: 'Product', icon: 'message',
    tagline: 'Turn customer feedback into a clearer picture.',
    description: 'Explore a centralized approach to reviews, sentiment, and AI-assisted responses across your business locations.',
    features: ['Review aggregation and monitoring', 'AI-assisted review responses', 'Sentiment and multi-location visibility'],
    bestFor: 'Businesses managing customer reviews across channels or locations.', source: 'https://www.cynbit.in/products#revio',
  },
  studio: {
    id: 'studio', name: 'Cynbit Studio', category: 'Product', icon: 'terminal',
    tagline: 'Turn practice into career-ready progress.',
    description: 'Explore adaptive coding practice and career preparation tools that help you develop and demonstrate your skills.',
    features: ['Adaptive coding challenges', 'AI feedback on your work', 'Interview and resume preparation'],
    bestFor: 'Students and developers looking for independent practice and career preparation.', source: 'https://www.cynbit.in/products#cynbit-studio',
  },
  bitelevate: {
    id: 'bitelevate', name: 'BitElevate', category: 'Learning', icon: 'graduation',
    tagline: 'Build skills with a little more direction.',
    description: 'Explore a training program centered on mentorship, practical projects, and career development.',
    features: ['Mentor-guided learning', 'Practical industry projects', 'Career development support'],
    bestFor: 'Learners who prefer a guided program and mentor support.', source: 'https://www.cynbit.in/bitelevate',
  },
  discovery: {
    id: 'discovery', name: 'A discovery conversation', category: 'Consultation', icon: 'compass',
    tagline: 'Start with the problem. Shape the right next step.',
    description: 'Your needs span several areas, or you are still exploring. A short discovery conversation is a better starting point than choosing a product too early.',
    features: ['Clarify the problem you want to solve', 'Explore suitable products and services', 'Define a practical next step'],
    bestFor: 'Anyone with an open-ended or cross-functional challenge.', source: 'https://www.cynbit.in/contact',
  },
};

export const solutionIds = Object.keys(solutions) as SolutionId[];

export const goals: { id: GoalId; title: string; description: string; icon: string; base: Partial<Record<SolutionId, number>>; needIds: string[] }[] = [
  { id: 'automate', title: 'Automate everyday work', description: 'Give repetitive tasks a smarter workflow.', icon: 'sparkles', base: { 'ai-automation': 4 }, needIds: ['workflows', 'documents', 'assistants', 'integrations'] },
  { id: 'build', title: 'Build or improve software', description: 'Create an app. Modernize what you have.', icon: 'code', base: { software: 2 }, needIds: ['web-app', 'integrations', 'cloud', 'migration'] },
  { id: 'grow', title: 'Grow my business', description: 'Reach customers and build a stronger reputation.', icon: 'chart', base: {}, needIds: ['acquisition', 'conversion', 'reviews', 'locations'] },
  { id: 'property', title: 'Manage rental properties', description: 'Bring tenants, rent, and units together.', icon: 'building', base: { tenantease: 5 }, needIds: ['rent', 'tenants', 'units', 'reminders'] },
  { id: 'learn', title: 'Build career-ready skills', description: 'Find the right way to learn and practice.', icon: 'graduation', base: {}, needIds: ['practice', 'interviews', 'mentorship', 'projects'] },
  { id: 'explore', title: 'Help me find a starting point', description: 'I have a challenge. Let’s make sense of it.', icon: 'compass', base: {}, needIds: ['workflows', 'web-app', 'acquisition', 'reviews', 'cloud', 'unsure'] },
];

export const needs: Record<string, { title: string; description: string; icon: string; weights: Partial<Record<SolutionId, number>> }> = {
  workflows: { title: 'Automate manual workflows', description: 'Move recurring work off your team’s plate.', icon: 'workflow', weights: { 'ai-automation': 5 } },
  documents: { title: 'Process documents & data', description: 'Reduce repetitive entry and document handling.', icon: 'file', weights: { 'ai-automation': 5 } },
  assistants: { title: 'Add an AI assistant', description: 'Support customers or internal teams.', icon: 'sparkles', weights: { 'ai-automation': 5 } },
  integrations: { title: 'Connect existing tools', description: 'Help your systems work together.', icon: 'workflow', weights: { software: 3, 'ai-automation': 2 } },
  'web-app': { title: 'Build a web or mobile app', description: 'Bring a new digital product to life.', icon: 'code', weights: { software: 5 } },
  cloud: { title: 'Improve cloud infrastructure', description: 'Strengthen hosting, deployment, and scale.', icon: 'cloud', weights: { cloud: 6 } },
  migration: { title: 'Modernize a legacy system', description: 'Move beyond software that holds you back.', icon: 'layers', weights: { software: 5, cloud: 2 } },
  acquisition: { title: 'Reach more customers', description: 'Improve search visibility and acquisition.', icon: 'chart', weights: { marketing: 5 } },
  conversion: { title: 'Convert more website visitors', description: 'Make the path from interest to inquiry clearer.', icon: 'target', weights: { marketing: 5 } },
  reviews: { title: 'Manage customer reviews', description: 'Monitor feedback and respond consistently.', icon: 'message', weights: { revio: 5 } },
  locations: { title: 'Track reputation across locations', description: 'See feedback across your business in one place.', icon: 'building', weights: { revio: 5 } },
  rent: { title: 'Track rent & payments', description: 'Keep payment status and history organized.', icon: 'wallet', weights: { tenantease: 5 } },
  tenants: { title: 'Organize tenant information', description: 'Keep profiles and property records together.', icon: 'users', weights: { tenantease: 5 } },
  units: { title: 'Manage units & availability', description: 'Get a clearer picture of your properties.', icon: 'building', weights: { tenantease: 5 } },
  reminders: { title: 'Automate rent reminders', description: 'Spend less time following up manually.', icon: 'bell', weights: { tenantease: 5 } },
  practice: { title: 'Practice coding independently', description: 'Learn by doing, with feedback on your work.', icon: 'terminal', weights: { studio: 5 } },
  interviews: { title: 'Prepare for interviews', description: 'Practice and strengthen your career profile.', icon: 'message', weights: { studio: 5 } },
  mentorship: { title: 'Learn with a mentor', description: 'Get guidance through a learning program.', icon: 'graduation', weights: { bitelevate: 6 } },
  projects: { title: 'Build projects with guidance', description: 'Apply new skills with structured support.', icon: 'layers', weights: { bitelevate: 5 } },
  unsure: { title: 'I’m still figuring this out', description: 'Help me clarify the problem first.', icon: 'compass', weights: { discovery: 10 } },
};

export const stages = [
  { id: 'new', title: 'Starting fresh', description: 'An idea, a new project, or a clean slate.', icon: 'sprout' },
  { id: 'existing', title: 'Improving what I have', description: 'I already use tools, software, or a process.', icon: 'sliders' },
  { id: 'exploring', title: 'Exploring possibilities', description: 'I want to understand my options first.', icon: 'compass' },
] as const;

export const timelines = [
  { id: 'soon', title: 'As soon as practical' },
  { id: 'quarter', title: 'In the next few months' },
  { id: 'research', title: 'Just researching' },
] as const;

export const catalogVersion = '2026-11-02.1';
