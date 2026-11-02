import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, FileText, Pencil } from 'lucide-react';
import { goals, needs, solutions, stages, timelines } from '../shared/catalog.ts';
import type { Answers } from '../shared/recommend.ts';
import {
  briefSections,
  frequencies,
  projectBriefSchema,
  type ProjectBrief,
  type ProjectBriefDraft,
} from '../shared/projectBrief.ts';
import './projectBrief.css';

export function BriefPreview({
  brief,
  onEdit,
}: {
  brief: ProjectBrief;
  onEdit?: (step: number) => void;
}) {
  return (
    <div className="brief-preview">
      {briefSections(brief).map((section) => (
        <section className="brief-section" key={section.title}>
          <div className="brief-section-heading">
            <h3>{section.title}</h3>
            {onEdit && (
              <button
                type="button"
                className="inline-link"
                onClick={() => onEdit(section.step)}
                aria-label={`Edit ${section.title.toLowerCase()}`}
              >
                <Pencil size={13} aria-hidden="true" /> Edit
              </button>
            )}
          </div>
          <dl>
            {section.entries.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

type Props = {
  answers: Answers;
  draft: ProjectBriefDraft;
  section: number;
  onSectionChange: (step: number) => void;
  onChange: (draft: ProjectBriefDraft) => void;
  onBack: () => void;
  onEditAnswers: () => void;
  onContinue: (brief: ProjectBrief) => void;
  onDownload: () => void;
  storageAvailable: boolean;
  restored: boolean;
};
type TextField =
  | 'problem'
  | 'audience'
  | 'currentSystem'
  | 'currentProcess'
  | 'tools'
  | 'mustHaves'
  | 'niceToHaves'
  | 'integrations'
  | 'success'
  | 'budget';
const problemFields = [
  'problem',
  'audience',
  'currentSystem',
  'currentProcess',
  'frequency',
  'tools',
];

export default function ProjectBriefBuilder({
  answers,
  draft,
  section,
  onSectionChange,
  onChange,
  onBack,
  onEditAnswers,
  onContinue,
  onDownload,
  storageAvailable,
  restored,
}: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const parsed = projectBriefSchema.safeParse(draft);
  const software = draft.solution === 'software';
  const labels = ['The problem', 'Scope & success', 'Review brief'];

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [section]);

  function navigate(next: number) {
    setErrors({});
    onSectionChange(next);
  }
  function advance(event: FormEvent) {
    event.preventDefault();
    const result = projectBriefSchema.safeParse(draft);
    const issues = result.success
      ? []
      : result.error.issues.filter(
          (issue) => section !== 0 || problemFields.includes(String(issue.path[0])),
        );
    if (issues.length) {
      setErrors(Object.fromEntries(issues.map((issue) => [issue.path[0], issue.message])));
      const first = String(issues[0].path[0]);
      document.getElementById(`brief-${first}`)?.focus();
      return;
    }
    if (result.success) onChange(result.data);
    navigate(section + 1);
  }
  function textField(
    name: TextField,
    label: string,
    value: string,
    options: {
      hint: string;
      placeholder: string;
      max: number;
      optional?: boolean;
      singleLine?: boolean;
    },
  ) {
    const id = `brief-${name}`;
    const props = {
      id,
      name,
      value,
      required: !options.optional,
      maxLength: options.max,
      placeholder: options.placeholder,
      'aria-invalid': !!errors[name],
      'aria-describedby': `${id}-hint${errors[name] ? ` ${id}-error` : ''}`,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange({ ...draft, [name]: event.target.value });
        setErrors((current) => ({ ...current, [name]: '' }));
      },
    };
    return (
      <div className="form-field brief-field" key={name}>
        <label htmlFor={id}>
          {label} <span>{options.optional ? '(optional)' : '*'}</span>
        </label>
        <p className="brief-field-hint" id={`${id}-hint`}>
          {options.hint}
        </p>
        {options.singleLine ? <input {...props} type="text" /> : <textarea {...props} rows={3} />}
        {errors[name] && (
          <p className="field-error" id={`${id}-error`}>
            {errors[name]}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="project-builder">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">PROJECT BRIEF · STEP {section + 1} OF 3</p>
          <h2 id="question-heading" ref={heading} tabIndex={-1}>
            {section === 0
              ? 'Give your idea some context.'
              : section === 1
                ? 'Make the essentials clear.'
                : 'Your project, clearly outlined.'}
          </h2>
          <p>
            {section === 0
              ? 'A few details today make the first conversation more useful.'
              : section === 1
                ? 'Describe what matters for a useful first version.'
                : 'Review each section. You can edit or download before continuing.'}
          </p>
        </div>
        <span className="result-spark">
          <FileText size={24} aria-hidden="true" />
        </span>
      </div>
      <nav aria-label="Project brief progress" className="brief-progress">
        {labels.map((label, index) => (
          <button
            key={label}
            type="button"
            className={section === index ? 'active' : ''}
            aria-current={section === index ? 'step' : undefined}
            disabled={index >= section}
            onClick={() => navigate(index)}
          >
            <span>
              {index < section ? <Check size={13} aria-hidden="true" /> : `0${index + 1}`}
            </span>
            {label}
          </button>
        ))}
      </nav>
      <div className="brief-context">
        <div className="brief-section-heading">
          <span className="eyebrow">FROM YOUR SOLUTION FINDER</span>
          <button type="button" className="inline-link" onClick={onEditAnswers}>
            Edit answers
          </button>
        </div>
        <strong>{solutions[draft.solution].name}</strong>
        <p>{goals.find((goal) => goal.id === answers.goal)!.title}</p>
        <div className="brief-tags">
          {answers.needs.map((id) => (
            <span key={id}>{needs[id].title}</span>
          ))}
        </div>
        <div className="brief-context-meta">
          <span>
            <b>Starting point</b>
            {stages.find((stage) => stage.id === answers.stage)!.title}
          </span>
          <span>
            <b>Timeline</b>
            {timelines.find((timeline) => timeline.id === answers.timeline)!.title}
          </span>
        </div>
      </div>
      <p className="brief-save-note" role="status">
        {storageAvailable
          ? `${restored ? 'Draft restored. ' : ''}Project answers are saved in this tab as you type. Use fictional test details.`
          : 'Browser storage is unavailable. Keep this tab open; you can still complete and download your brief.'}
      </p>

      {section < 2 && (
        <form onSubmit={advance} noValidate>
          <div className="brief-fields">
            {section === 0 && (
              <>
                {textField(
                  'problem',
                  software
                    ? 'What problem should the software solve?'
                    : 'Which repetitive task would you like to improve?',
                  draft.problem,
                  {
                    hint: 'Describe the challenge and why it matters to your business.',
                    placeholder: software
                      ? 'Our team tracks customer requests in spreadsheets, and follow-ups get missed.'
                      : 'We manually copy website leads into our CRM and assign them to salespeople.',
                    max: 1200,
                  },
                )}
                {textField(
                  'audience',
                  software ? 'Who will use the application?' : 'Who handles this task today?',
                  draft.audience,
                  {
                    hint: software
                      ? 'Include the main user groups and approximate team size, if known.'
                      : 'Describe the team or roles involved.',
                    placeholder: software
                      ? 'Our 12-person support team and two managers.'
                      : 'Three sales coordinators.',
                    max: 400,
                  },
                )}
                {draft.solution === 'software' ? (
                  textField('currentSystem', 'What do you use today?', draft.currentSystem, {
                    hint: 'Describe anything to replace or improve, or write “Starting fresh”.',
                    placeholder:
                      'Spreadsheets and shared email. We want to replace the spreadsheets.',
                    max: 800,
                  })
                ) : (
                  <>
                    {textField(
                      'currentProcess',
                      'How does the task work today?',
                      draft.currentProcess,
                      {
                        hint: 'Walk through the main steps, from the trigger to the finished result.',
                        placeholder:
                          'A lead arrives by email. We copy it into the CRM, check for duplicates, and assign an owner.',
                        max: 1200,
                      },
                    )}
                    <fieldset className="brief-frequency">
                      <legend>
                        How often does it happen? <span>*</span>
                      </legend>
                      <div className="timeline-options">
                        {frequencies.map((frequency, index) => (
                          <label
                            key={frequency.id}
                            className={draft.frequency === frequency.id ? 'selected' : ''}
                          >
                            <input
                              type="radio"
                              id={index === 0 ? 'brief-frequency' : undefined}
                              name="frequency"
                              value={frequency.id}
                              checked={draft.frequency === frequency.id}
                              required
                              aria-invalid={!!errors.frequency}
                              aria-describedby={
                                errors.frequency ? 'brief-frequency-error' : undefined
                              }
                              onChange={() => {
                                onChange({ ...draft, frequency: frequency.id });
                                setErrors((current) => ({ ...current, frequency: '' }));
                              }}
                            />
                            {frequency.label}
                          </label>
                        ))}
                      </div>
                      {errors.frequency && (
                        <p className="field-error" id="brief-frequency-error">
                          {errors.frequency}
                        </p>
                      )}
                    </fieldset>
                    {textField('tools', 'Which tools are used today?', draft.tools, {
                      hint: 'List the tools involved, or write “None yet”.',
                      placeholder: 'Website forms, Gmail, and Zoho CRM.',
                      max: 600,
                    })}
                  </>
                )}
              </>
            )}
            {section === 1 && (
              <>
                {textField('mustHaves', 'What must the first version do?', draft.mustHaves, {
                  hint: 'List the essentials, one per line. Focus on the work people need to get done.',
                  placeholder: software
                    ? 'Create and assign requests\nTrack request status\nNotify the assigned team member'
                    : 'Capture new leads\nCheck for duplicates\nAssign an owner in our CRM',
                  max: 1200,
                })}
                {textField('niceToHaves', 'What could come later?', draft.niceToHaves, {
                  hint: 'Separate useful extras from the essentials.',
                  placeholder: 'A weekly performance dashboard.',
                  max: 800,
                  optional: true,
                })}
                {textField('integrations', 'What should it connect to?', draft.integrations, {
                  hint: 'Name any services or systems that need to exchange information.',
                  placeholder: 'Zoho CRM and our website forms.',
                  max: 600,
                  optional: true,
                })}
                {textField('success', 'What would success look like?', draft.success, {
                  hint: 'Describe an observable improvement. A number helps if you know one.',
                  placeholder: 'Reduce manual data entry from two hours a day to under 15 minutes.',
                  max: 800,
                })}
                {textField('budget', 'Do you have a budget range?', draft.budget, {
                  hint: 'Include the currency. Leave blank if you’re not sure yet; this is not a quote.',
                  placeholder: 'Not sure yet, or e.g. ₹2–5 lakh / US$5,000–10,000',
                  max: 120,
                  optional: true,
                  singleLine: true,
                })}
              </>
            )}
          </div>
          {Object.values(errors).some(Boolean) && (
            <p className="error-banner" role="alert">
              Please check the highlighted project details.
            </p>
          )}
          <div className="panel-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => (section === 0 ? onBack() : navigate(0))}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              {section === 0 ? 'Back to recommendation' : 'Back'}
            </button>
            <button type="submit" className="primary-button">
              {section === 0 ? 'Define the scope' : 'Review my brief'}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </form>
      )}
      {section === 2 && parsed.success && (
        <>
          <BriefPreview brief={parsed.data} onEdit={navigate} />
          <p className="brief-save-note">
            This brief describes your needs. It is not a quote or a confirmed agreement.
          </p>
          <div className="panel-actions brief-review-actions">
            <button type="button" className="text-button" onClick={onDownload}>
              <Download size={16} aria-hidden="true" />
              Download project brief
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => onContinue(parsed.data)}
            >
              Continue to inquiry
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
