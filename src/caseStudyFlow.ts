import { answersSchema, recommend, type Answers, type DraftAnswers } from '../shared/recommend.ts';
import type { CaseStudy, CaseStudyEvent } from '../shared/caseStudies.ts';

export function caseStudyContext(study: CaseStudy, current: DraftAnswers): Answers {
  const parsed = answersSchema.safeParse(current);
  if (parsed.success) {
    const result = recommend(parsed.data);
    if ([result.primary.id, ...result.alternatives.map((item) => item.id)].includes(study.service))
      return { ...parsed.data, sourceCaseStudyId: study.id };
  }
  // Visible, editable starting defaults from the chosen example, never project/client results.
  return {
    goal: study.service === 'software' ? 'build' : 'automate',
    needs: [...study.needs],
    stage: 'exploring',
    timeline: 'research',
    sourceCaseStudyId: study.id,
  };
}

export function trackCaseStudy(event: Omit<CaseStudyEvent, 'id'>) {
  try {
    void fetch('/api/case-study-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, id: crypto.randomUUID() }),
      keepalive: true,
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      /* Analytics must never interrupt a visitor's project. */
    });
  } catch {
    /* Browsers without crypto or fetch still support the journey. */
  }
}
