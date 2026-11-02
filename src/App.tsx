import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Info,
  LoaderCircle,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  catalogVersion,
  goals,
  needs,
  solutions,
  stages,
  timelines,
  type SolutionId,
} from '../shared/catalog.ts';
import {
  answersSchema,
  buildBrief,
  inquirySchema,
  recommend,
  type Answers,
  type DraftAnswers,
  type Recommendation,
} from '../shared/recommend.ts';
import { Icon } from './icons.tsx';
import ProjectBriefBuilder, { BriefPreview } from './ProjectBriefBuilder.tsx';
import {
  createProjectBrief,
  projectBriefSchema,
  projectBriefText,
  supportsProjectBrief,
} from '../shared/projectBrief.ts';
import {
  BRIEF_DRAFT_KEY,
  readBriefDraft,
  sameBriefContext,
  sameBriefIntent,
  type BriefDraftEnvelope,
} from './briefDraft.ts';

const DRAFT_KEY = 'cynbit-finder-answers-v1';
const emptyAnswers: DraftAnswers = { needs: [], timeline: 'research' };
function readDraft(): DraftAnswers {
  try {
    const raw = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    const goal = goals.find((g) => g.id === raw?.goal);
    if (!goal) return { ...emptyAnswers };
    const selected = Array.isArray(raw.needs)
      ? [
          ...new Set<string>(
            raw.needs.filter((n: unknown) => typeof n === 'string' && goal.needIds.includes(n)),
          ),
        ].slice(0, 3)
      : [];
    return {
      goal: goal.id,
      needs: selected.includes('unsure') ? ['unsure'] : selected,
      stage: stages.some((s) => s.id === raw.stage) ? raw.stage : undefined,
      timeline: timelines.some((t) => t.id === raw.timeline) ? raw.timeline : 'research',
    };
  } catch {
    return { ...emptyAnswers };
  }
}

class ApiError extends Error {
  constructor(
    message: string,
    public issues: { field: string; message: string }[] = [],
    public status = 0,
  ) {
    super(message);
  }
}
async function post<T>(path: string, payload: unknown, key?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new ApiError(
      'We couldn’t reach the server. Your answers are still here. Please try again.',
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      data.error || 'Something went wrong. Please try again.',
      data.issues,
      response.status,
    );
  return data as T;
}

type Receipt = { reference: string; solution: string; receivedAt: string; prototype: true };
type Contact = { name: string; email: string; company: string; message: string; consent: boolean };
const emptyContact: Contact = { name: '', email: '', company: '', message: '', consent: false };

export default function App() {
  const [initialBrief] = useState(() => {
    const saved = readBriefDraft();
    const finder = answersSchema.safeParse(readDraft());
    return saved && finder.success && sameBriefIntent(saved.answers, finder.data)
      ? { ...saved, answers: finder.data }
      : null;
  });
  const [answers, setAnswers] = useState<DraftAnswers>(readDraft);
  const [step, setStep] = useState(initialBrief ? 4 : 0);
  const [restored, setRestored] = useState(() => !!readDraft().goal);
  const [result, setResult] = useState<Recommendation | null>(() =>
    initialBrief ? recommend(initialBrief.answers) : null,
  );
  const [selected, setSelected] = useState<SolutionId>(initialBrief?.brief.solution || 'discovery');
  const [briefDraft, setBriefDraft] = useState<BriefDraftEnvelope | null>(initialBrief);
  const [includeBrief, setIncludeBrief] = useState(false);
  const [briefStorageAvailable, setBriefStorageAvailable] = useState(true);
  const [contact, setContact] = useState<Contact>({ ...emptyContact });
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [about, setAbout] = useState(false);
  const [copied, setCopied] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const initial = useRef(true);
  const request = useRef<{ body: string; key: string } | null>(null);
  const parsedAnswers = answersSchema.safeParse(answers);
  const activeBrief =
    briefDraft &&
    parsedAnswers.success &&
    briefDraft.brief.solution === selected &&
    sameBriefIntent(briefDraft.answers, parsedAnswers.data)
      ? briefDraft
      : null;
  const validatedBrief = projectBriefSchema.safeParse(activeBrief?.brief);
  const attachedBrief = includeBrief && validatedBrief.success ? validatedBrief.data : undefined;

  useEffect(() => {
    const updatedBrief =
      activeBrief &&
      parsedAnswers.success &&
      !sameBriefContext(activeBrief.answers, parsedAnswers.data)
        ? { ...activeBrief, answers: parsedAnswers.data }
        : activeBrief;
    if (briefDraft && !activeBrief) {
      setBriefDraft(null);
      setIncludeBrief(false);
    }
    if (updatedBrief !== activeBrief) setBriefDraft(updatedBrief);
    try {
      if (!updatedBrief || step === 6) sessionStorage.removeItem(BRIEF_DRAFT_KEY);
      else sessionStorage.setItem(BRIEF_DRAFT_KEY, JSON.stringify(updatedBrief));
      setBriefStorageAvailable(true);
    } catch {
      setBriefStorageAvailable(false);
    }
  }, [briefDraft, activeBrief, answers, step]);

  useEffect(() => {
    try {
      if (step === 6 || !answers.goal) sessionStorage.removeItem(DRAFT_KEY);
      else sessionStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
    } catch {
      /* The finder works without browser storage. */
    }
  }, [answers, step]);

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    heading.current?.focus({ preventScroll: true });
    if (window.innerWidth < 900)
      panel.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [step]);

  useEffect(() => {
    if (about) dialog.current?.showModal();
    else dialog.current?.close();
  }, [about]);

  function go(next: number) {
    setError('');
    setFieldErrors({});
    setLimitMessage('');
    setStep(next);
  }
  function startOver() {
    setBriefDraft(null);
    setIncludeBrief(false);
    setAnswers({ ...emptyAnswers });
    setContact({ ...emptyContact });
    setResult(null);
    setReceipt(null);
    setRestored(false);
    setCopied(false);
    request.current = null;
    go(0);
  }
  function openBrief() {
    if (!supportsProjectBrief(selected) || !parsedAnswers.success) return;
    if (!activeBrief)
      setBriefDraft({ answers: parsedAnswers.data, brief: createProjectBrief(selected), step: 0 });
    go(4);
  }
  function pickGoal(id: DraftAnswers['goal']) {
    setAnswers((a) => ({ ...a, goal: id, needs: a.goal === id ? a.needs : [] }));
    setRestored(false);
    setError('');
  }
  function toggleNeed(id: string) {
    setLimitMessage('');
    setAnswers((a) => {
      if (a.needs.includes(id)) return { ...a, needs: a.needs.filter((n) => n !== id) };
      if (id === 'unsure') return { ...a, needs: ['unsure'] };
      const current = a.needs.filter((n) => n !== 'unsure');
      if (current.length >= 3) {
        setLimitMessage('You’ve selected three priorities. Deselect one to choose another.');
        return a;
      }
      return { ...a, needs: [...current, id] };
    });
  }
  async function findSolution() {
    setBusy(true);
    setError('');
    try {
      const response = await post<Recommendation>('/api/recommend', answers);
      setResult(response);
      const offered = [response.primary.id, ...response.alternatives.map((match) => match.id)];
      setSelected(activeBrief && offered.includes(selected) ? selected : response.primary.id);
      setRestored(false);
      go(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function submitInquiry(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    const payload = {
      answers,
      selectedSolution: selected,
      ...contact,
      email: contact.email.trim(),
      ...(attachedBrief ? { projectBrief: attachedBrief } : {}),
    };
    const parsed = inquirySchema.safeParse(payload);
    if (!parsed.success) {
      const errors = Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join('.'), i.message]),
      );
      setFieldErrors(errors);
      setError('Please check the highlighted fields.');
      const firstField = parsed.error.issues[0]?.path[0];
      if (typeof firstField === 'string') document.getElementById(`contact-${firstField}`)?.focus();
      return;
    }
    const serialized = JSON.stringify(parsed.data);
    if (request.current?.body !== serialized)
      request.current = { body: serialized, key: crypto.randomUUID() };
    setBusy(true);
    try {
      const saved = await post<Receipt>('/api/inquiries', parsed.data, request.current.key);
      setReceipt(saved);
      setContact({ ...emptyContact });
      go(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
      if (e instanceof ApiError) {
        setFieldErrors(Object.fromEntries(e.issues.map((i) => [i.field, i.message])));
        if (e.status === 409) request.current = null;
      }
    } finally {
      setBusy(false);
    }
  }
  function downloadBrief() {
    const parsed = answersSchema.safeParse(answers);
    if (!parsed.success) return;
    const brief = buildBrief(parsed.data, selected);
    const lines = [
      'CYNBIT · SOLUTION FINDER',
      'Independent assessment prototype',
      '',
      ...(receipt ? [`Demo reference: ${receipt.reference}`, ''] : []),
      `Suggested next step: ${brief.solution}`,
      `Goal: ${brief.goal}`,
      '',
      'Priorities:',
      ...brief.priorities.map((p) => `- ${p}`),
      '',
      `Starting point: ${stages.find((s) => s.id === brief.stage)?.title}`,
      `Timing: ${timelines.find((t) => t.id === brief.timeline)?.title}`,
      '',
      `Explore the offering: ${solutions[selected].source}`,
      '',
      'This summary is a starting point, not a quote or a confirmed service agreement.',
      'No inquiry has been sent to Cynbit by this prototype.',
    ];
    const fullBrief =
      validatedBrief.success && (step === 4 || (step >= 5 && includeBrief))
        ? validatedBrief.data
        : undefined;
    const text = fullBrief
      ? projectBriefText(fullBrief, parsed.data, receipt?.reference)
      : lines.join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fullBrief ? 'my-cynbit-project-brief.txt' : 'my-cynbit-solution-brief.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const currentGoal = goals.find((g) => g.id === answers.goal);
  const solution = solutions[selected];
  const availableMatches = result ? [result.primary, ...result.alternatives] : [];
  const activeMatch = availableMatches.find((m) => m.id === selected);
  const otherMatches = availableMatches.filter((m) => m.id !== selected);
  const validStep =
    step === 0 ? !!answers.goal : step === 1 ? answers.needs.length > 0 : !!answers.stage;
  const stepLabels = [
    { step: 0, title: 'Your goal', sub: 'What would you like to do?' },
    { step: 1, title: 'Your priorities', sub: 'The things that matter most.' },
    { step: 2, title: 'Your starting point', sub: 'A little more about you.' },
    { step: 3, title: 'Your recommendation', sub: 'A clearer way forward.' },
    ...(supportsProjectBrief(selected)
      ? [{ step: 4, title: 'Your project brief', sub: 'Shape the details. Optional.' }]
      : []),
    { step: 5, title: 'Your inquiry', sub: 'Review and send test details.' },
  ];
  const progressStep =
    step === 6 ? stepLabels.length - 1 : stepLabels.findIndex((item) => item.step === step);

  return (
    <>
      <a className="skip-link" href="#finder">
        Skip to solution finder
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Cynbit Solution Finder home">
          <svg className="brand-mark" viewBox="0 0 44 44" fill="none" aria-hidden="true">
            <path
              d="M28 10a15 15 0 1 0 0 24M15 22h24m-7-7 7 7-7 7"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            cynbit<span className="brand-dot">.</span>
          </span>
        </a>
        <span className="header-divider" />
        <span className="product-name">Solution finder</span>
        <div className="header-right">
          <button className="prototype-badge" onClick={() => setAbout(true)}>
            <span />
            Assessment prototype
          </button>
          <a
            className="official-link"
            href="https://www.cynbit.in/"
            target="_blank"
            rel="noreferrer"
          >
            Visit Cynbit <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </header>

      <main className="shell">
        <div className="intro">
          <div>
            <p className="eyebrow">
              <span className="little-line" /> LESS GUESSWORK. MORE DIRECTION.
            </p>
            <h1>
              Find your next step<span>.</span>
            </h1>
            <p className="intro-copy">Tell us what you want to do. We’ll connect the dots.</p>
          </div>
          <div className="time-note">
            <Clock3 size={17} aria-hidden="true" />
            <span>
              {step === 4 ? 'Project brief' : '3 discovery steps'}{' '}
              <span className="dot-separator">·</span>{' '}
              {step === 4 ? 'About 3–5 minutes' : 'About a minute'}
            </span>
          </div>
        </div>

        <div className="workspace">
          <aside className="route-panel" aria-label="Your progress">
            <div className="route-top">
              <span className="eyebrow">YOUR ROUTE</span>
              <span className="route-count">
                0{progressStep + 1} / 0{stepLabels.length}
              </span>
            </div>
            <ol className="step-list">
              {stepLabels.map((item, index) => {
                const done =
                  (index < progressStep && (item.step !== 4 || includeBrief)) || step === 6;
                const canVisit = !busy && step !== 6 && index < progressStep;
                return (
                  <li
                    key={item.title}
                    className={`${index === progressStep ? 'current' : ''} ${done ? 'complete' : ''}`}
                    aria-current={index === progressStep ? 'step' : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => (item.step === 4 ? openBrief() : go(item.step))}
                      disabled={!canVisit}
                      aria-label={`${done ? 'Edit' : 'Step ' + (index + 1) + ':'} ${item.title}`}
                    >
                      <span className="step-number">
                        {done ? <Check size={16} aria-hidden="true" /> : `0${index + 1}`}
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.sub}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="route-bottom">
              <svg viewBox="0 0 160 105" className="route-art" fill="none" aria-hidden="true">
                <path
                  d="M15 81h42c26 0 18-53 45-53h36"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4 5"
                />
                <circle cx="15" cy="81" r="6" fill="currentColor" />
                <circle cx="139" cy="28" r="14" stroke="currentColor" />
                <path
                  d="m133 28 4 4 8-9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path d="M48 16h23M59 5v23" stroke="currentColor" strokeWidth="1.2" opacity=".5" />
                <circle cx="116" cy="83" r="4" stroke="currentColor" opacity=".5" />
              </svg>
              <h2>
                Good solutions start
                <br />
                with the right questions.
              </h2>
              <p>
                No account needed.
                <br />
                No technical jargon required.
              </p>
            </div>
          </aside>

          <section
            className={`finder-panel ${step >= 3 ? 'result-panel' : ''}`}
            id="finder"
            ref={panel}
            aria-labelledby="question-heading"
            aria-busy={busy}
          >
            {restored && step < 3 && (
              <div className="restore-note">
                <RotateCcw size={15} aria-hidden="true" />
                <span>Your previous answers are ready to continue.</span>
                <button onClick={startOver}>Start fresh</button>
              </div>
            )}
            {step < 3 && (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">STEP 0{step + 1} OF 03</p>
                    <h2 id="question-heading" tabIndex={-1} ref={heading}>
                      {step === 0
                        ? 'What brings you here?'
                        : step === 1
                          ? 'What would make a difference?'
                          : 'Where are you starting from?'}
                    </h2>
                    <p>
                      {step === 0
                        ? 'Choose the goal that feels closest to yours.'
                        : step === 1
                          ? 'Pick up to three priorities. We’ll use these to find your fit.'
                          : 'This helps shape a useful next conversation.'}
                    </p>
                  </div>
                  {step === 1 && (
                    <span className="selection-count" aria-live="polite">
                      {answers.needs.length} / 3 selected
                    </span>
                  )}
                </div>
                {step === 0 && (
                  <fieldset className="choice-grid">
                    <legend className="sr-only">Choose your main goal</legend>
                    {goals.map((goal) => (
                      <label
                        className={`choice-card ${answers.goal === goal.id ? 'selected' : ''}`}
                        key={goal.id}
                      >
                        <input
                          type="radio"
                          name="goal"
                          value={goal.id}
                          checked={answers.goal === goal.id}
                          onChange={() => pickGoal(goal.id)}
                        />
                        <span className={`choice-icon tone-${goal.id}`}>
                          <Icon name={goal.icon} />
                        </span>
                        <span className="choice-indicator">
                          {answers.goal === goal.id && <Check size={12} aria-hidden="true" />}
                        </span>
                        <strong>{goal.title}</strong>
                        <span className="choice-description">{goal.description}</span>
                      </label>
                    ))}
                  </fieldset>
                )}
                {step === 1 && (
                  <>
                    <fieldset className="choice-grid needs-grid">
                      <legend className="sr-only">Choose up to three priorities</legend>
                      {currentGoal?.needIds.map((id) => (
                        <label
                          key={id}
                          className={`choice-card ${answers.needs.includes(id) ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={answers.needs.includes(id)}
                            onChange={() => toggleNeed(id)}
                            name="needs"
                            value={id}
                          />
                          <span className="choice-icon">
                            <Icon name={needs[id].icon} />
                          </span>
                          <span className="choice-indicator square">
                            {answers.needs.includes(id) && <Check size={12} aria-hidden="true" />}
                          </span>
                          <strong>{needs[id].title}</strong>
                          <span className="choice-description">{needs[id].description}</span>
                        </label>
                      ))}
                    </fieldset>
                    <p className="limit-message" role="status">
                      {limitMessage}
                    </p>
                  </>
                )}
                {step === 2 && (
                  <>
                    <fieldset className="stage-list">
                      <legend className="sr-only">Your starting point</legend>
                      {stages.map((stage) => (
                        <label
                          key={stage.id}
                          className={`stage-card ${answers.stage === stage.id ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="stage"
                            value={stage.id}
                            checked={answers.stage === stage.id}
                            onChange={() => setAnswers((a) => ({ ...a, stage: stage.id }))}
                          />
                          <span className="choice-icon">
                            <Icon name={stage.icon} />
                          </span>
                          <span className="stage-copy">
                            <strong>{stage.title}</strong>
                            <span>{stage.description}</span>
                          </span>
                          <span className="choice-indicator">
                            {answers.stage === stage.id && <Check size={12} aria-hidden="true" />}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <fieldset className="timeline-field">
                      <legend>When are you thinking of getting started?</legend>
                      <p>It’s okay to be researching. There’s no commitment.</p>
                      <div className="timeline-options">
                        {timelines.map((t) => (
                          <label className={answers.timeline === t.id ? 'selected' : ''} key={t.id}>
                            <input
                              type="radio"
                              name="timeline"
                              value={t.id}
                              checked={answers.timeline === t.id}
                              onChange={() => setAnswers((a) => ({ ...a, timeline: t.id }))}
                            />
                            {t.title}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </>
                )}
                {error && (
                  <div className="error-banner" role="alert">
                    <Info size={18} aria-hidden="true" />
                    {error}
                  </div>
                )}
                <div className="panel-actions">
                  <div>
                    {step > 0 ? (
                      <button className="text-button" onClick={() => go(step - 1)} disabled={busy}>
                        <ArrowLeft size={16} aria-hidden="true" />
                        Back
                      </button>
                    ) : (
                      <span className="gentle-note">A clearer path starts here.</span>
                    )}
                  </div>
                  <button
                    className="primary-button"
                    disabled={!validStep || busy}
                    onClick={() => (step === 2 ? findSolution() : go(step + 1))}
                  >
                    {busy ? (
                      <>
                        <LoaderCircle className="spin" size={17} aria-hidden="true" />
                        Finding your fit
                      </>
                    ) : (
                      <>
                        {step === 2 ? 'Find my solution' : 'Continue'}
                        <ArrowRight size={18} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {step === 3 && result && (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">YOUR NEXT CHAPTER</p>
                    <h2 id="question-heading" tabIndex={-1} ref={heading}>
                      {result.mixed
                        ? 'Let’s shape the right direction.'
                        : 'A good fit for your goals.'}
                    </h2>
                    <p>A starting point based on what matters to you.</p>
                  </div>
                  <span className="result-spark">
                    <Icon name="sparkles" size={26} />
                  </span>
                </div>
                <div className="recommendation-card">
                  <div className="recommendation-top">
                    <span className="solution-icon">
                      <Icon name={solution.icon} size={27} />
                    </span>
                    <span className="category-label">{solution.category}</span>
                    <span className="match-badge">
                      <Check size={13} aria-hidden="true" />
                      {selected === result.primary.id ? 'Suggested for you' : 'Your selection'}
                    </span>
                  </div>
                  <h3>{solution.name}</h3>
                  <p className="solution-tagline">{solution.tagline}</p>
                  <p className="solution-description">{solution.description}</p>
                  <div className="fit-reasons">
                    <h4>Why this fits</h4>
                    {activeMatch?.reasons.map((reason) => (
                      <p key={reason}>
                        <CheckCheck size={17} aria-hidden="true" />
                        {reason}
                      </p>
                    ))}
                    {!activeMatch && (
                      <p>
                        <CheckCheck size={17} aria-hidden="true" />
                        You’d prefer to clarify your needs with a conversation first.
                      </p>
                    )}
                  </div>
                  <div className="capability-list">
                    <h4>What you can explore</h4>
                    <ul>
                      {solution.features.map((f) => (
                        <li key={f}>
                          <span />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <a
                    className="source-link"
                    href={solution.source}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Explore {solution.name} on Cynbit <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </div>
                {otherMatches.length > 0 && (
                  <div className="alternatives">
                    <h3>Also worth considering</h3>
                    {otherMatches.map((match) => (
                      <button
                        key={match.id}
                        onClick={() => setSelected(match.id)}
                        className="alternative-card"
                      >
                        <span className="small-solution-icon">
                          <Icon name={solutions[match.id].icon} size={19} />
                        </span>
                        <span>
                          <strong>{solutions[match.id].name}</strong>
                          <small>{solutions[match.id].bestFor}</small>
                        </span>
                        <ArrowRight size={17} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="context-note">
                  <Info size={17} aria-hidden="true" />
                  <p>{result.context}</p>
                </div>
                <details className="matching-details">
                  <summary>
                    How did we choose this? <ChevronDown size={15} aria-hidden="true" />
                  </summary>
                  <p>
                    We match your goal and selected priorities to Cynbit’s publicly listed
                    offerings. Each capability contributes to the match. When leading options tie,
                    we suggest a discovery conversation. Your timing and starting point shape the
                    brief, not the product ranking. This is guidance, not a quote or a guarantee of
                    availability.
                  </p>
                  <button className="inline-link" onClick={() => go(0)}>
                    Review my answers
                  </button>
                </details>
                {selected !== 'discovery' && (
                  <button className="discovery-link" onClick={() => setSelected('discovery')}>
                    Not quite right? Start with a discovery conversation{' '}
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                )}
                {supportsProjectBrief(selected) && (
                  <div className="brief-entry">
                    <h3>Turn this direction into a project brief.</h3>
                    <p>
                      Outline your problem, must-haves, and what success looks like. Review and
                      download a brief you can bring to the first conversation.
                    </p>
                    <button className="primary-button" onClick={openBrief}>
                      {activeBrief ? 'Continue my project brief' : 'Build my project brief'}{' '}
                      <ArrowRight size={18} aria-hidden="true" />
                    </button>
                  </div>
                )}
                <div className="panel-actions result-actions">
                  <button className="text-button" onClick={downloadBrief}>
                    <Download size={16} aria-hidden="true" />
                    Save solution summary
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setIncludeBrief(false);
                      go(5);
                    }}
                  >
                    {supportsProjectBrief(selected)
                      ? 'Continue with a quick inquiry'
                      : 'Prepare an inquiry'}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}

            {step === 4 && activeBrief && (
              <ProjectBriefBuilder
                answers={activeBrief.answers}
                draft={activeBrief.brief}
                section={activeBrief.step}
                onSectionChange={(section) =>
                  setBriefDraft((current) => (current ? { ...current, step: section } : null))
                }
                onChange={(brief) =>
                  setBriefDraft((current) => (current ? { ...current, brief } : null))
                }
                onBack={() => go(3)}
                onEditAnswers={() => go(0)}
                onContinue={(brief) => {
                  setBriefDraft({ ...activeBrief, brief, step: 2 });
                  setIncludeBrief(true);
                  go(5);
                }}
                onDownload={downloadBrief}
                storageAvailable={briefStorageAvailable}
                restored={!!initialBrief}
              />
            )}

            {step === 5 && (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">FROM DIRECTION TO ACTION</p>
                    <h2 id="question-heading" tabIndex={-1} ref={heading}>
                      Make your next step clear.
                    </h2>
                    <p>Your selected solution travels with your inquiry.</p>
                  </div>
                </div>
                <div className="inquiry-solution">
                  <span className="small-solution-icon">
                    <Icon name={solution.icon} />
                  </span>
                  <div>
                    <span className="eyebrow">YOUR SELECTED SOLUTION</span>
                    <strong>{solution.name}</strong>
                  </div>
                  <button className="inline-link" onClick={() => go(3)} disabled={busy}>
                    Change
                  </button>
                </div>
                <div className="demo-note">
                  <Info size={16} aria-hidden="true" />
                  <p>
                    <strong>This is a demo inquiry.</strong> Use test details. It is saved in this
                    prototype only; no message is sent to Cynbit.
                  </p>
                </div>
                {attachedBrief && (
                  <div className="brief-inquiry-card">
                    <div className="brief-section-heading">
                      <strong>Your project brief is attached</strong>
                      <button
                        type="button"
                        className="inline-link"
                        onClick={openBrief}
                        disabled={busy}
                      >
                        Edit brief
                      </button>
                    </div>
                    <p>Your project details will be saved with this inquiry.</p>
                    <details>
                      <summary>Review attached project brief</summary>
                      <BriefPreview brief={attachedBrief} />
                    </details>
                  </div>
                )}
                <form onSubmit={submitInquiry} noValidate>
                  <div className="form-grid">
                    {(['name', 'email', 'company'] as const).map((field) => (
                      <div
                        className={`form-field ${field === 'company' ? 'full-width' : ''}`}
                        key={field}
                      >
                        <label htmlFor={`contact-${field}`}>
                          {field === 'name'
                            ? 'Full name'
                            : field === 'email'
                              ? 'Email address'
                              : 'Company or organization'}{' '}
                          <span>{field === 'company' ? '(optional)' : '*'}</span>
                        </label>
                        <input
                          id={`contact-${field}`}
                          name={field}
                          type={field === 'email' ? 'email' : 'text'}
                          autoComplete={field === 'company' ? 'organization' : field}
                          required={field !== 'company'}
                          maxLength={field === 'email' ? 254 : field === 'company' ? 120 : 100}
                          value={contact[field]}
                          onChange={(e) => setContact((c) => ({ ...c, [field]: e.target.value }))}
                          placeholder={
                            field === 'name'
                              ? 'e.g. Alex Morgan'
                              : field === 'email'
                                ? 'alex@example.com'
                                : 'Your organization'
                          }
                          aria-invalid={!!fieldErrors[field]}
                          aria-describedby={fieldErrors[field] ? `error-${field}` : undefined}
                        />
                        {fieldErrors[field] && (
                          <p className="field-error" id={`error-${field}`}>
                            {fieldErrors[field]}
                          </p>
                        )}
                      </div>
                    ))}
                    <div className="form-field full-width">
                      <label htmlFor="contact-message">
                        Anything else we should know? <span>(optional)</span>
                      </label>
                      <textarea
                        id="contact-message"
                        name="message"
                        rows={4}
                        maxLength={2000}
                        placeholder="Share a little about your goal or the challenge you’re facing."
                        value={contact.message}
                        onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))}
                        aria-describedby="message-note"
                      />
                      <span className="field-hint" id="message-note">
                        A short description is plenty. {contact.message.length}/2000
                      </span>
                    </div>
                  </div>
                  <details className="brief-details">
                    <summary>
                      Your answers are included <ChevronDown size={15} aria-hidden="true" />
                    </summary>
                    <dl>
                      <dt>Goal</dt>
                      <dd>{currentGoal?.title}</dd>
                      <dt>Priorities</dt>
                      <dd>{answers.needs.map((n) => needs[n].title).join(' · ')}</dd>
                      <dt>Starting point</dt>
                      <dd>{stages.find((s) => s.id === answers.stage)?.title}</dd>
                      <dt>Timing</dt>
                      <dd>{timelines.find((t) => t.id === answers.timeline)?.title}</dd>
                    </dl>
                  </details>
                  <div className="consent-row">
                    <input
                      id="contact-consent"
                      type="checkbox"
                      required
                      checked={contact.consent}
                      onChange={(e) => setContact((c) => ({ ...c, consent: e.target.checked }))}
                      aria-invalid={!!fieldErrors.consent}
                      aria-describedby={fieldErrors.consent ? 'error-consent' : undefined}
                    />
                    <label htmlFor="contact-consent">
                      I agree to store these test details and answers in this assessment prototype.{' '}
                      <button className="inline-link" type="button" onClick={() => setAbout(true)}>
                        How this demo handles data
                      </button>
                    </label>
                  </div>
                  {fieldErrors.consent && (
                    <p className="field-error" id="error-consent">
                      {fieldErrors.consent}
                    </p>
                  )}
                  {error && (
                    <div className="error-banner" role="alert">
                      <Info size={18} aria-hidden="true" />
                      {error}
                    </div>
                  )}
                  <div className="panel-actions">
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => (attachedBrief ? openBrief() : go(3))}
                    >
                      <ArrowLeft size={16} aria-hidden="true" />
                      Back
                    </button>
                    <button className="primary-button" type="submit" disabled={busy}>
                      {busy ? (
                        <>
                          <LoaderCircle className="spin" size={17} aria-hidden="true" />
                          Saving inquiry
                        </>
                      ) : (
                        <>
                          Save demo inquiry <ArrowRight size={18} aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {step === 6 && receipt && (
              <div className="success-view">
                <div className="success-icon">
                  <Check size={36} strokeWidth={1.7} aria-hidden="true" />
                </div>
                <p className="eyebrow">A CLEARER WAY FORWARD</p>
                <h2 id="question-heading" tabIndex={-1} ref={heading}>
                  Your demo inquiry is saved.
                </h2>
                <p className="success-copy">
                  {attachedBrief
                    ? 'Your project brief, answers, and selected solution were saved together.'
                    : 'Your answers and selected solution are together in one brief.'}
                </p>
                <div className="receipt-card">
                  <span className="eyebrow">SELECTED SOLUTION</span>
                  <h3>{receipt.solution}</h3>
                  <div className="reference-row">
                    <span>{receipt.reference}</span>
                    <button
                      aria-label="Copy request reference"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(receipt.reference);
                          setCopied(true);
                        } catch {
                          setError('You can select and copy the reference shown here.');
                        }
                      }}
                    >
                      {copied ? (
                        <Check size={16} aria-hidden="true" />
                      ) : (
                        <Copy size={16} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <span className="copy-status" role="status">
                    {copied ? 'Reference copied' : 'Your demo request reference'}
                  </span>
                </div>
                <div className="demo-note">
                  <Info size={17} aria-hidden="true" />
                  <p>
                    This is an assessment prototype. Your inquiry was saved locally to its database.
                    Cynbit has not been contacted, and no appointment has been booked.
                  </p>
                </div>
                {error && <p role="alert">{error}</p>}
                <div className="success-actions">
                  <button className="primary-button" onClick={downloadBrief}>
                    <Download size={17} aria-hidden="true" />
                    Download my brief
                  </button>
                  <button className="text-button" onClick={startOver}>
                    <RotateCcw size={16} aria-hidden="true" />
                    Find another solution
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
        <footer className="page-footer">
          <span>Thoughtfully matched. Clearly explained.</span>
          <div>
            <button onClick={() => setAbout(true)}>About this prototype</button>
            {step > 0 && step < 6 && (
              <button onClick={startOver} disabled={busy}>
                <RotateCcw size={13} aria-hidden="true" />
                Start over
              </button>
            )}
          </div>
        </footer>
      </main>
      <dialog
        ref={dialog}
        onCancel={() => setAbout(false)}
        onClose={() => setAbout(false)}
        className="about-dialog"
        aria-labelledby="about-title"
      >
        <button
          className="dialog-close"
          aria-label="Close prototype information"
          onClick={() => setAbout(false)}
        >
          <X size={22} aria-hidden="true" />
        </button>
        <p className="eyebrow">BUILT FOR THE TECHNICAL ASSESSMENT</p>
        <h2 id="about-title">A small idea, made tangible.</h2>
        <p>
          This independent prototype explores how visitors could discover a suitable Cynbit product
          or service and prepare a relevant inquiry.
        </p>
        <h3>Recommendations</h3>
        <p>
          Matching uses explicit rules and public information from{' '}
          <a href="https://www.cynbit.in/products" target="_blank" rel="noreferrer">
            Cynbit’s products
          </a>
          ,{' '}
          <a href="https://www.cynbit.in/services" target="_blank" rel="noreferrer">
            services
          </a>
          , and{' '}
          <a href="https://www.cynbit.in/bitelevate" target="_blank" rel="noreferrer">
            BitElevate
          </a>
          . It does not promise pricing, availability, or outcomes.
        </p>
        <h3>Demo data</h3>
        <p>
          Your questionnaire and unfinished project brief answers are kept in this tab’s session
          storage so you can refresh and continue. Contact details are not saved in browser storage.
          If you submit a demo inquiry, the prototype saves the supplied details, answers, and
          attached project brief in its own database. Use fictional test details. Nothing is sent to
          Cynbit or an email provider.
        </p>
        <p>
          Saved demo records remain until the prototype operator deletes or resets its database. The
          prototype has no public endpoint for listing inquiries.
        </p>
        <p className="catalog-note">
          Offering reference reviewed 2 November 2026 · Catalog {catalogVersion}
        </p>
        <button className="primary-button" onClick={() => setAbout(false)}>
          Got it <Check size={17} aria-hidden="true" />
        </button>
      </dialog>
    </>
  );
}
