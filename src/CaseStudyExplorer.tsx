import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  FileText,
  Layers3,
  Search,
  Sparkles,
  Workflow,
} from 'lucide-react';
import {
  caseStudies,
  filterCaseStudies,
  findCaseStudy,
  matchingCaseStudies,
  type CaseStudy,
  type CaseStudyEvent,
} from '../shared/caseStudies.ts';
import { needs, solutions, type SolutionId } from '../shared/catalog.ts';
import { trackCaseStudy } from './caseStudyFlow.ts';
import './caseStudies.css';

export type StudySource = CaseStudyEvent['source'];
export function studyHref(study: CaseStudy, source: StudySource = 'gallery') {
  return `#case-studies/${study.id}${source === 'recommendation' ? '?from=recommendation' : ''}`;
}

function StudyVisual({ study }: { study: CaseStudy }) {
  return (
    <div className={`study-visual visual-${study.visual}`} aria-hidden="true">
      <span className="visual-caption">
        CONCEPT / {study.service === 'software' ? 'SOFTWARE' : 'AI WORKFLOW'}
      </span>
      {study.service === 'software' ? (
        <div className="concept-window">
          <div className="concept-top">
            <span />
            <span />
            <span />
            <b>{study.visual === 'portal' ? 'Request workspace' : 'Inventory workspace'}</b>
          </div>
          <div className="concept-content">
            <div className="concept-sidebar">
              <Layers3 size={19} />
              <i />
              <i />
              <i />
            </div>
            <div className="concept-board">
              <div className="concept-board-title">
                {study.visual === 'portal'
                  ? 'A shared view of the work'
                  : 'Every location, connected'}
                <span>DEMO</span>
              </div>
              <div className="concept-columns">
                {(study.visual === 'portal'
                  ? ['Received', 'In progress', 'Ready']
                  : ['Main store', 'Warehouse', 'Online']
                ).map((label, i) => (
                  <div key={label}>
                    <small>{label}</small>
                    <div className="concept-item">
                      <span />
                      <i />
                      <i />
                      {i === 1 && (
                        <b>
                          <Check size={10} /> Assigned
                        </b>
                      )}
                    </div>
                    {i !== 2 && (
                      <div className="concept-item short">
                        <span />
                        <i />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="concept-flow">
          <div className="flow-node">
            <FileText size={23} />
            <strong>{study.visual === 'documents' ? 'Invoice' : 'Question'}</strong>
            <small>Source received</small>
          </div>
          <span className="flow-connector">
            <ArrowRight size={17} />
          </span>
          <div className="flow-node flow-ai">
            <Sparkles size={25} />
            <strong>{study.visual === 'documents' ? 'Extract' : 'Find & draft'}</strong>
            <small>AI assistance</small>
          </div>
          <span className="flow-connector">
            <ArrowRight size={17} />
          </span>
          <div className="flow-node">
            <Check size={24} />
            <strong>Human review</strong>
            <small>People in control</small>
          </div>
          <div className="flow-footnote">
            <span />
            {study.visual === 'documents'
              ? 'Flag exceptions. Review before exporting.'
              : 'Show the source. Review before sending.'}
          </div>
        </div>
      )}
    </div>
  );
}

function StudyCard({ study, source = 'gallery' }: { study: CaseStudy; source?: StudySource }) {
  return (
    <article className="study-card">
      <a
        className="study-visual-link"
        href={studyHref(study, source)}
        tabIndex={-1}
        aria-hidden="true"
      >
        <StudyVisual study={study} />
      </a>
      <div className="study-card-body">
        <div className="study-meta">
          <span>{study.industry}</span>
          <span className="demo-label">Demonstration</span>
        </div>
        <h3>
          <a href={studyHref(study, source)}>
            {study.title}
            <ArrowUpRight size={21} aria-hidden="true" />
          </a>
        </h3>
        <dl>
          <div>
            <dt>Problem</dt>
            <dd>{study.problem}</dd>
          </div>
          <div>
            <dt>Solution</dt>
            <dd>{study.solution}</dd>
          </div>
        </dl>
        <span className="study-service">
          {study.service === 'software' ? <Code2 size={14} /> : <Sparkles size={14} />}
          {solutions[study.service].name}
        </span>
      </div>
    </article>
  );
}

export function RecommendedStudies({
  service,
  priorities,
}: {
  service: SolutionId;
  priorities: string[];
}) {
  const matches = matchingCaseStudies(service, priorities);
  return (
    <section className="recommended-studies" aria-labelledby="recommended-studies-title">
      <div className="study-section-heading">
        <div>
          <p className="eyebrow">EXPLORE THE POSSIBILITIES</p>
          <h3 id="recommended-studies-title">
            {matches.length ? 'See how this could work.' : 'Explore example projects.'}
          </h3>
        </div>
        <a href="#case-studies">
          View all <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </div>
      <p className="study-disclosure">
        {matches.length
          ? 'Matched to your selected service; ordered by your priorities. '
          : 'No case studies match this service yet. Browse software and AI examples. '}
        All current examples are demonstrations, with no verified client results.
      </p>
      {matches.length > 0 && (
        <div className="recommended-grid">
          {matches.map((study) => (
            <a
              className={`recommended-study recommended-${study.visual}`}
              key={study.id}
              href={studyHref(study, 'recommendation')}
            >
              <span className="demo-label">Demonstration</span>
              <small>{study.industry}</small>
              <strong>{study.title}</strong>
              <span>
                Explore approach <ArrowRight size={15} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

export default function CaseStudyExplorer({
  route,
  onStart,
  onView,
  hasRecommendation,
}: {
  route: string;
  onStart: (study: CaseStudy, destination: 'brief' | 'inquiry', source: StudySource) => void;
  onView: (study: CaseStudy, source: StudySource) => void;
  hasRecommendation: boolean;
}) {
  const active = route.startsWith('#case-studies');
  const routeId = route.split('?')[0].split('/')[1];
  const study = findCaseStudy(routeId);
  const source: StudySource = route.includes('?from=recommendation') ? 'recommendation' : 'gallery';
  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  const [industry, setIndustry] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  const viewedRoute = useRef('');
  const previousStudy = useRef<string | undefined>(undefined);
  const viewCallback = useRef(onView);
  viewCallback.current = onView;
  const matches = filterCaseStudies(query, service, industry);
  const filtered = !!(query || service || industry);
  useEffect(() => {
    document.title = active
      ? `${study?.title || (routeId ? 'Example not found' : 'Case-study explorer')} · Cynbit`
      : 'Find your next step · Cynbit Solution Finder';
  }, [active, study, routeId]);
  useEffect(() => {
    if (!active) {
      viewedRoute.current = '';
      return;
    }
    if (!routeId && previousStudy.current) {
      const card = document.querySelector<HTMLAnchorElement>(
        `.study-card h3 a[href="#case-studies/${previousStudy.current}"]`,
      );
      (card || title.current)?.focus({ preventScroll: true });
    } else {
      title.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    previousStudy.current = study?.id;
    if (study && viewedRoute.current !== route) {
      viewedRoute.current = route;
      trackCaseStudy({ caseStudyId: study.id, type: 'view', source });
      viewCallback.current(study, source);
    } else if (!study) viewedRoute.current = '';
  }, [active, route, routeId, study, source]);

  return (
    <main className="case-shell" id="case-explorer" hidden={!active}>
      {!routeId ? (
        <>
          <div className="case-hero">
            <div>
              <p className="eyebrow">
                <span className="little-line" /> CASE-STUDY EXPLORER
              </p>
              <h1 ref={title} tabIndex={-1}>
                A closer look at
                <br />
                what’s possible<span>.</span>
              </h1>
              <p>
                Find a familiar challenge. Explore an approach.
                <br className="desktop-break" /> Shape the next step for your business.
              </p>
            </div>
            <div className="case-hero-note">
              <Workflow size={30} strokeWidth={1.3} aria-hidden="true" />
              <strong>
                From a problem
                <br />
                to a possible solution.
              </strong>
              <span>Software development & AI automation</span>
            </div>
          </div>
          <div className="case-demo-notice">
            <span className="demo-label">Demonstration collection</span>
            <p>
              Four fictional scenarios to explore our proposed experience. These are not delivered
              Cynbit projects; no client results are claimed.
            </p>
          </div>
          <section className="case-gallery" aria-labelledby="gallery-title">
            <div className="study-section-heading">
              <h2 id="gallery-title">
                Explore the collection<span> / 04</span>
              </h2>
              <a href="#finder">
                {hasRecommendation ? 'Back to my solution' : 'Find my solution'}{' '}
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
            <div className="case-filter-bar">
              <label className="case-search">
                <Search size={19} aria-hidden="true" />
                <span className="sr-only">Search case studies</span>
                <input
                  type="search"
                  placeholder="Search a problem, solution, or industry…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  maxLength={150}
                />
              </label>
              <label className="case-industry">
                <span className="sr-only">Filter by industry</span>
                <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  <option value="">All industries</option>
                  {[...new Set(caseStudies.map((item) => item.industry))].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="case-filter-bottom">
              <div className="case-service-filters" aria-label="Filter by service">
                {[
                  ['', 'All services'],
                  ['software', 'Software development'],
                  ['ai-automation', 'AI automation'],
                ].map(([id, label]) => (
                  <button key={id} aria-pressed={service === id} onClick={() => setService(id)}>
                    {label}
                  </button>
                ))}
              </div>
              <span role="status">
                {matches.length} {matches.length === 1 ? 'example' : 'examples'}
                {filtered && (
                  <button
                    className="inline-link"
                    onClick={() => {
                      setQuery('');
                      setService('');
                      setIndustry('');
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </span>
            </div>
            {matches.length ? (
              <div className="case-grid">
                {matches.map((item) => (
                  <StudyCard key={item.id} study={item} />
                ))}
              </div>
            ) : (
              <div className="case-empty">
                <Search size={30} aria-hidden="true" />
                <h3>No examples match those filters.</h3>
                <p>Try a broader phrase or clear your filters to explore all four scenarios.</p>
                <button
                  className="primary-button"
                  onClick={() => {
                    setQuery('');
                    setService('');
                    setIndustry('');
                  }}
                >
                  Show all examples <ArrowRight size={17} />
                </button>
              </div>
            )}
          </section>
          <div className="case-bottom-cta">
            <div>
              <p className="eyebrow">YOUR CHALLENGE IS THE STARTING POINT</p>
              <h2>Not sure which direction fits?</h2>
              <p>Let the Solution Finder help you narrow it down.</p>
            </div>
            <a className="primary-button" href="#finder">
              {hasRecommendation ? 'Return to my solution' : 'Find my solution'}{' '}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </>
      ) : study ? (
        <>
          <div className="case-breadcrumb">
            <a href="#case-studies">
              <ArrowLeft size={15} aria-hidden="true" /> All case studies
            </a>
            {hasRecommendation && (
              <a href="#finder">
                Back to my solution <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            )}
          </div>
          <div className="case-detail-heading">
            <div className="study-meta">
              <span>{study.industry}</span>
              <span className="demo-label">Demonstration</span>
            </div>
            <h1 ref={title} tabIndex={-1}>
              {study.title}
            </h1>
            <p>{study.summary}</p>
            <span className="study-service">{solutions[study.service].name}</span>
          </div>
          <StudyVisual study={study} />
          <div className="case-detail-layout">
            <div className="case-story">
              <section>
                <p className="eyebrow">01 / THE CHALLENGE</p>
                <h2>A familiar business problem.</h2>
                <p>{study.challenge}</p>
              </section>
              <section>
                <p className="eyebrow">02 / THE APPROACH</p>
                <h2>How a team could tackle it.</h2>
                <ol className="case-approach">
                  {study.approach.map((item, index) => (
                    <li key={item.title}>
                      <span>0{index + 1}</span>
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="case-evidence">
                <p className="eyebrow">03 / RESULTS & EVIDENCE</p>
                <h2>Verified results: not available.</h2>
                <p>{study.evidence.note}</p>
                <h3>What a real pilot should measure</h3>
                <ul>
                  {study.measurements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="evidence-note">
                  These are proposed evaluation measures, not achieved outcomes. A published client
                  case study requires approved project facts and supporting evidence.
                </p>
              </section>
            </div>
            <aside className="case-start-card" aria-labelledby="case-start-title">
              <p className="eyebrow">MAKE IT YOUR OWN</p>
              <h2 id="case-start-title">Have a similar challenge?</h2>
              <p>
                Start with {solutions[study.service].name.toLowerCase()} and describe what your
                project needs.
              </p>
              <button className="primary-button" onClick={() => onStart(study, 'brief', source)}>
                Start a similar project <ArrowRight size={17} aria-hidden="true" />
              </button>
              <button className="text-button" onClick={() => onStart(study, 'inquiry', source)}>
                Or prepare a quick inquiry <ArrowUpRight size={14} aria-hidden="true" />
              </button>
              <p className="case-start-note">
                Matching finder answers are kept. Otherwise, we use editable example priorities (
                {study.needs.map((id) => needs[id].title.toLowerCase()).join('; ')}), “Exploring
                possibilities,” and “Just researching.” New brief fields start blank; a matching
                saved brief is resumed.
              </p>
              <h3>Potential deliverables</h3>
              <ul>
                {study.deliverables.map((item) => (
                  <li key={item}>
                    <Check size={14} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </>
      ) : (
        <div className="case-empty">
          <h1 ref={title} tabIndex={-1}>
            Example not found.
          </h1>
          <p>This case-study link is unavailable. Explore the current collection.</p>
          <a className="primary-button" href="#case-studies">
            View all case studies <ArrowRight size={17} />
          </a>
        </div>
      )}
      <footer className="page-footer">
        <span>Find a solution → Explore examples → Build a brief → Inquire</span>
        <a href="/admin">Admin workspace</a>
      </footer>
    </main>
  );
}
