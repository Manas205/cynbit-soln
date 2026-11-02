import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { goals, needs, solutions, stages, timelines } from '../shared/catalog.ts';
import {
  inquiryStatuses,
  statusLabels,
  type AdminSession,
  type InquiryDetail,
  type InquiryList,
  type InquiryStatus,
} from '../shared/admin.ts';
import { BriefPreview } from './ProjectBriefBuilder.tsx';
import './admin.css';
import './caseStudies.css';
import { findCaseStudy, type CaseStudyMetrics } from '../shared/caseStudies.ts';

class AdminError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/admin${path}`, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(12_000)])
        : AbortSignal.timeout(12_000),
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new AdminError('We couldn’t reach the server. Check your connection and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new AdminError(data.error || 'Something went wrong. Please try again.', response.status);
  return data as T;
}
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const dateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};
function Brand() {
  return (
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
  );
}
function Status({ value }: { value: InquiryStatus }) {
  return (
    <span className={`admin-status status-${value}`}>
      <span />
      {statusLabels[value]}
    </span>
  );
}

export default function AdminDashboard() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    document.title = 'Inquiry dashboard · Cynbit';
    const controller = new AbortController();
    request<AdminSession>('/session', { signal: controller.signal })
      .then(setSession)
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorText(error));
      });
    return () => controller.abort();
  }, [revision]);
  const expired = useCallback(() => {
    setSession({ configured: true, authenticated: false });
    setError('Your session has ended. Sign in again to continue. Unsaved changes were not saved.');
  }, []);
  useEffect(() => {
    if (!session?.authenticated || !session.expiresAt) return;
    const timer = window.setTimeout(
      expired,
      Math.max(0, Date.parse(session.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [session, expired]);
  return (
    <div className="admin-app">
      {session?.authenticated ? (
        <InboxDashboard
          session={session}
          onExpired={expired}
          onLogout={() => {
            setSession({ configured: true, authenticated: false });
            setError('');
          }}
        />
      ) : (
        <div className="admin-auth-layout">
          <div className="admin-auth-story">
            <Brand />
            <div>
              <p className="eyebrow">FROM FIRST HELLO TO NEXT STEPS</p>
              <h1>
                Good projects start
                <br />
                with a conversation<span>.</span>
              </h1>
              <p>
                Bring every inquiry, project brief, and follow-up into one thoughtful workspace.
              </p>
              <div className="admin-auth-journey">
                <span>Discover</span>
                <ArrowRight size={16} />
                <span>Define</span>
                <ArrowRight size={16} />
                <strong>Connect</strong>
              </div>
            </div>
            <span className="admin-prototype">Independent assessment prototype</span>
          </div>
          <main className="admin-auth-main">
            <a className="admin-back-link" href="/">
              <ArrowLeft size={15} aria-hidden="true" /> Back to Solution Finder
            </a>
            {!session ? (
              <div className="admin-login-card">
                <LockKeyhole className="admin-lock" size={28} />
                <h2>Opening your workspace</h2>
                {error ? (
                  <>
                    <p role="alert" className="admin-error">
                      {error}
                    </p>
                    <button
                      className="primary-button"
                      onClick={() => {
                        setError('');
                        setRevision((v) => v + 1);
                      }}
                    >
                      Try again
                    </button>
                  </>
                ) : (
                  <p role="status">Checking admin access…</p>
                )}
              </div>
            ) : (
              <Login
                configured={session.configured}
                message={error}
                onLogin={(value) => {
                  setSession(value);
                  setError('');
                }}
              />
            )}
            <p className="admin-auth-footnote">
              <ShieldCheck size={15} aria-hidden="true" /> A private workspace for reviewing demo
              inquiries.
            </p>
          </main>
        </div>
      )}
    </div>
  );
}

function Login({
  configured,
  message,
  onLogin,
}: {
  configured: boolean;
  message: string;
  onLogin: (session: AdminSession) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await request<AdminSession>('/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setPassword('');
      onLogin(session);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-login-card" aria-labelledby="admin-login-title">
      <span className="admin-lock">
        <LockKeyhole size={25} aria-hidden="true" />
      </span>
      <p className="eyebrow">CYNBIT WORKSPACE</p>
      <h2 id="admin-login-title">Welcome back.</h2>
      <p>Sign in to review inquiries and move the next conversation forward.</p>
      {!configured ? (
        <div className="admin-notice" role="status">
          Admin access hasn’t been configured yet. Ask the project owner to set up the admin account
          using the project’s setup instructions.
        </div>
      ) : (
        <form onSubmit={submit}>
          <label className="admin-field">
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={busy}
            />
          </label>
          <label className="admin-field">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={busy}
            />
          </label>
          {(error || message) && (
            <p className="admin-error" role="alert">
              {error || message}
            </p>
          )}
          <button className="primary-button admin-login-button" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle size={17} className="admin-spin" /> Signing in…
              </>
            ) : (
              <>
                Sign in to workspace <ArrowRight size={17} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      )}
    </section>
  );
}

type Filters = { q: string; status: string; solution: string; from: string; to: string };
const emptyFilters: Filters = { q: '', status: '', solution: '', from: '', to: '' };
function CaseStudyAnalytics({ revision, onExpired }: { revision: number; onExpired: () => void }) {
  const [items, setItems] = useState<CaseStudyMetrics[] | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setItems(null);
    request<{ items: CaseStudyMetrics[] }>('/case-study-analytics', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setItems(data.items);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          if (error instanceof AdminError && error.status === 401) onExpired();
          else setError(errorText(error));
        }
      });
    return () => controller.abort();
  }, [revision, refresh, onExpired]);
  return (
    <section
      className="case-analytics"
      id="case-study-analytics"
      aria-labelledby="case-analytics-title"
    >
      <div className="study-section-heading">
        <h2 id="case-analytics-title">Case-study activity</h2>
        <button className="admin-button" onClick={() => setRefresh((value) => value + 1)}>
          Refresh activity
        </button>
      </div>
      <p>
        All-time recorded actions for demonstration content. Views count detail openings; starts
        count transitions into a brief or inquiry after viewing an example. These are not unique
        visitors or submitted inquiries. Blocked or offline analytics are not counted.
      </p>
      {error ? (
        <p role="alert" className="admin-error">
          {error}
        </p>
      ) : !items ? (
        <p role="status">Loading case-study activity…</p>
      ) : (
        <div className="case-analytics-scroll">
          <table>
            <caption className="sr-only">Case-study views and continuation actions</caption>
            <thead>
              <tr>
                <th scope="col">Example</th>
                <th scope="col">Views</th>
                <th scope="col">Brief starts</th>
                <th scope="col">Inquiry starts</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.caseStudyId}>
                  <th scope="row">
                    <a href={`/#case-studies/${item.caseStudyId}`}>
                      {findCaseStudy(item.caseStudyId)?.title || item.caseStudyId}
                    </a>
                    <small>Demonstration</small>
                  </th>
                  <td>{item.views}</td>
                  <td>{item.briefStarts}</td>
                  <td>{item.inquiryStarts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function InboxDashboard({
  session,
  onExpired,
  onLogout,
}: {
  session: AdminSession;
  onExpired: () => void;
  onLogout: () => void;
}) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<InquiryList | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(applied)) if (value) params.set(key, value);
    setBusy(true);
    setError('');
    request<InquiryList>(`/inquiries?${params}`, { signal: controller.signal })
      .then(setList)
      .catch((error) => {
        if (!controller.signal.aborted) {
          if (error instanceof AdminError && error.status === 401) onExpired();
          else setError(errorText(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [applied, page, revision, onExpired]);
  async function logout() {
    setLoggingOut(true);
    setError('');
    try {
      await request('/session', {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': session.csrfToken! },
      });
      onLogout();
    } catch (error) {
      if (error instanceof AdminError && error.status === 401) onLogout();
      else setError(errorText(error));
    } finally {
      setLoggingOut(false);
    }
  }
  function apply(event: FormEvent) {
    event.preventDefault();
    if (filters.from && filters.to && filters.from > filters.to) {
      setFilterError('The end date must be on or after the start date.');
      return;
    }
    setFilterError('');
    setApplied({ ...filters });
    setPage(1);
  }
  function reset() {
    setFilters(emptyFilters);
    setApplied(emptyFilters);
    setPage(1);
    setFilterError('');
  }
  const totalAll = list ? Object.values(list.counts).reduce((a, b) => a + b, 0) : 0;
  const filtered = Object.values(applied).some(Boolean);
  return (
    <>
      <a className="skip-link" href="#admin-content">
        Skip to inquiry inbox
      </a>
      <header className="admin-header">
        <Brand />
        <span className="header-divider" />
        <span className="product-name">Inquiry workspace</span>
        <div className="admin-header-right">
          <span className="prototype-badge">
            <span />
            Assessment prototype
          </span>
          <span className="admin-account">
            <ShieldCheck size={15} aria-hidden="true" />
            {session.email}
          </span>
          <button className="admin-button" onClick={logout} disabled={loggingOut}>
            <LogOut size={16} aria-hidden="true" />
            <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
          </button>
        </div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <p className="eyebrow">WORKSPACE</p>
          <nav aria-label="Admin navigation">
            <a href="/admin" className="admin-nav-active" aria-current="page">
              <Inbox size={18} aria-hidden="true" />
              Inquiry inbox <span>{list ? totalAll : '—'}</span>
            </a>
            <a href="/">
              <ArrowUpRight size={18} aria-hidden="true" />
              Solution Finder
            </a>
            <a href="#case-study-analytics">
              <ArrowUpRight size={18} aria-hidden="true" />
              Case-study activity
            </a>
          </nav>
          <div className="admin-sidebar-note">
            <MessageSquareText size={25} aria-hidden="true" />
            <h2>
              Make the next
              <br />
              conversation count.
            </h2>
            <p>
              Review the brief.
              <br />
              Understand the need.
              <br />
              Take the next step.
            </p>
          </div>
          <div className="admin-private">
            <LockKeyhole size={13} aria-hidden="true" />
            Admin access only
          </div>
        </aside>
        <main className="admin-content" id="admin-content">
          <div className="admin-page-heading">
            <div>
              <p className="eyebrow">
                <span className="little-line" /> EVERY INQUIRY. A NEW POSSIBILITY.
              </p>
              <h1>
                Inquiry inbox<span>.</span>
              </h1>
              <p>Your project conversations, all in one place.</p>
            </div>
            <button
              className="admin-button"
              onClick={() => setRevision((v) => v + 1)}
              disabled={busy}
            >
              <RefreshCw size={15} className={busy ? 'admin-spin' : ''} aria-hidden="true" />
              Refresh inbox
            </button>
          </div>
          <div className="admin-metrics" aria-label="Inquiry totals across all submissions">
            {inquiryStatuses.map((status, index) => (
              <button
                key={status}
                className={`admin-metric metric-${status} ${applied.status === status ? 'metric-active' : ''}`}
                aria-pressed={applied.status === status}
                onClick={() => {
                  const next = { ...applied, status: applied.status === status ? '' : status };
                  setApplied(next);
                  setFilters(next);
                  setPage(1);
                  setFilterError('');
                }}
              >
                <span className="admin-metric-label">
                  <span className={`admin-metric-dot dot-${status}`} />
                  {statusLabels[status]}
                  <span className="admin-metric-number">0{index + 1}</span>
                </span>
                <strong>{list ? list.counts[status] : '—'}</strong>
                <small>
                  {
                    [
                      'Ready for a first look',
                      'Understanding the scope',
                      'Conversation started',
                      'Review complete',
                    ][index]
                  }
                </small>
              </button>
            ))}
          </div>
          <section className="admin-inbox-panel" aria-labelledby="inquiry-list-title">
            <div className="admin-panel-heading">
              <div>
                <h2 id="inquiry-list-title">
                  All inquiries <span>{list ? list.total : '—'}</span>
                </h2>
                <p>Project briefs and quick inquiries · Newest first</p>
              </div>
              <span className="admin-table-note">
                <Clock3 size={13} aria-hidden="true" />
                Dates shown in your local time
              </span>
            </div>
            <form className="admin-filters" onSubmit={apply}>
              <div className="admin-filter-primary">
                <label className="admin-search">
                  <span className="sr-only">Search inquiries</span>
                  <Search size={17} aria-hidden="true" />
                  <input
                    type="search"
                    maxLength={120}
                    placeholder="Search name, company, email or reference…"
                    value={filters.q}
                    onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span className="sr-only">Filter by solution</span>
                  <select
                    value={filters.solution}
                    onChange={(e) => setFilters({ ...filters, solution: e.target.value })}
                  >
                    <option value="">All solutions</option>
                    {Object.entries(solutions).map(([id, solution]) => (
                      <option key={id} value={id}>
                        {solution.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span className="sr-only">Filter by status</span>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  >
                    <option value="">All statuses</option>
                    {inquiryStatuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-filter-secondary">
                <span>
                  Received date <small>(UTC)</small>
                </span>
                <label className="admin-date">
                  From
                  <input
                    type="date"
                    aria-label="Received from date"
                    value={filters.from}
                    onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                  />
                </label>
                <label className="admin-date">
                  To
                  <input
                    type="date"
                    aria-label="Received to date"
                    value={filters.to}
                    onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                  />
                </label>
                <button className="admin-button admin-apply" type="submit">
                  Apply filters
                </button>
                {(filtered || Object.values(filters).some(Boolean)) && (
                  <button className="text-button" type="button" onClick={reset}>
                    Clear filters
                  </button>
                )}
              </div>
              {filterError && (
                <p className="admin-error" role="alert">
                  {filterError}
                </p>
              )}
            </form>
            {error ? (
              <div className="admin-empty">
                <p className="admin-error" role="alert">
                  {error}
                </p>
                <button className="admin-button" onClick={() => setRevision((v) => v + 1)}>
                  Try again
                </button>
              </div>
            ) : busy ? (
              <div className="admin-empty" role="status">
                <LoaderCircle className="admin-spin" size={25} />
                <p>Loading inquiries…</p>
              </div>
            ) : !list?.items.length ? (
              <div className="admin-empty">
                <span className="admin-empty-icon">
                  <Inbox size={28} aria-hidden="true" />
                </span>
                <h3>
                  {filtered
                    ? 'No inquiries match these filters.'
                    : 'Your next conversation starts here.'}
                </h3>
                <p>
                  {filtered
                    ? 'Try a different search or clear your filters to see every inquiry.'
                    : 'Submitted inquiries and project briefs will appear here, ready for review.'}
                </p>
                {filtered ? (
                  <button className="admin-button" onClick={reset}>
                    Clear filters
                  </button>
                ) : (
                  <a className="primary-button" href="/">
                    Open Solution Finder <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                )}
              </div>
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <caption className="sr-only">
                      Saved inquiries, newest first. Open an inquiry to review its details.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Contact / company</th>
                        <th scope="col">Solution</th>
                        <th scope="col">Received</th>
                        <th scope="col">Status</th>
                        <th scope="col">
                          <span className="sr-only">Open inquiry</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="admin-contact-cell">
                              <span className="admin-avatar" aria-hidden="true">
                                {item.name
                                  .split(/\s+/)
                                  .slice(0, 2)
                                  .map((part) => part[0])
                                  .join('')
                                  .toUpperCase()}
                              </span>
                              <div>
                                <button
                                  className="admin-inquiry-link"
                                  onClick={() => setSelected(item.id)}
                                  aria-label={`Open inquiry from ${item.name}, ${item.id}`}
                                >
                                  {item.name}
                                </button>
                                <span>{item.company || item.email}</span>
                              </div>
                            </div>
                          </td>
                          <td data-label="Solution">
                            <strong className="admin-solution-name">
                              {solutions[item.selectedSolution]?.name || item.selectedSolution}
                            </strong>
                            <span className="admin-brief-label">
                              {item.hasBrief ? (
                                <>
                                  <FileText size={12} aria-hidden="true" />
                                  Project brief attached
                                </>
                              ) : (
                                'Quick inquiry'
                              )}
                            </span>
                          </td>
                          <td data-label="Received">
                            <time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time>
                            <span className="admin-reference">{item.id}</span>
                          </td>
                          <td data-label="Status">
                            <Status value={item.status} />
                          </td>
                          <td className="admin-open-cell">
                            <button
                              className="admin-icon-button"
                              aria-label={`Review ${item.id}`}
                              onClick={() => setSelected(item.id)}
                            >
                              <ArrowUpRight size={18} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="admin-pagination">
                  <span>
                    Showing {(list.page - 1) * list.pageSize + 1}–
                    {Math.min(list.page * list.pageSize, list.total)} of {list.total} inquiries
                  </span>
                  <div>
                    <button
                      className="admin-icon-button"
                      aria-label="Previous page"
                      disabled={list.page <= 1}
                      onClick={() => setPage(list.page - 1)}
                    >
                      <ChevronLeft size={17} aria-hidden="true" />
                    </button>
                    <span>
                      Page {list.page} of {Math.max(1, Math.ceil(list.total / list.pageSize))}
                    </span>
                    <button
                      className="admin-icon-button"
                      aria-label="Next page"
                      disabled={list.page * list.pageSize >= list.total}
                      onClick={() => setPage(list.page + 1)}
                    >
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
          <footer className="admin-footer">
            <span>Thoughtfully received. Clearly followed up.</span>
            <span>Demo submissions stay in this prototype.</span>
          </footer>
          <CaseStudyAnalytics revision={revision} onExpired={onExpired} />
        </main>
      </div>
      {selected && (
        <InquiryViewer
          id={selected}
          csrfToken={session.csrfToken!}
          onClose={() => setSelected(null)}
          onSaved={() => setRevision((v) => v + 1)}
          onExpired={onExpired}
        />
      )}
    </>
  );
}

function InquiryViewer({
  id,
  csrfToken,
  onClose,
  onSaved,
  onExpired,
}: {
  id: string;
  csrfToken: string;
  onClose: () => void;
  onSaved: () => void;
  onExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [item, setItem] = useState<InquiryDetail | null>(null);
  const [status, setStatus] = useState<InquiryStatus>('new');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [revision, setRevision] = useState(0);
  const dirty = Boolean(item && (status !== item.status || notes !== item.notes));
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setConflict(false);
    setSaved(false);
    request<InquiryDetail>(`/inquiries/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((value) => {
        setItem(value);
        setStatus(value.status);
        setNotes(value.notes);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          if (error instanceof AdminError && error.status === 401) onExpired();
          else setError(errorText(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, revision, onExpired]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  function close() {
    if (saving) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!item) return;
    setSaving(true);
    setError('');
    setSaved(false);
    setConflict(false);
    try {
      const value = await request<InquiryDetail>(`/inquiries/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ status, notes, version: item.version }),
      });
      setItem(value);
      setStatus(value.status);
      setNotes(value.notes);
      setSaved(true);
      onSaved();
    } catch (error) {
      if (error instanceof AdminError && error.status === 401) onExpired();
      else {
        setError(errorText(error));
        setConflict(error instanceof AdminError && error.status === 409);
      }
    } finally {
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="admin-detail-dialog"
      aria-labelledby="inquiry-detail-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="admin-detail-heading">
        <div>
          <p className="eyebrow">INQUIRY DETAILS</p>
          <h2 id="inquiry-detail-title">{item?.company || item?.name || 'Review inquiry'}</h2>
          <span className="admin-reference">{id}</span>
        </div>
        <button
          className="admin-icon-button"
          autoFocus
          aria-label="Close inquiry"
          disabled={saving}
          onClick={close}
        >
          <X size={21} aria-hidden="true" />
        </button>
      </div>
      {discard && (
        <div className="admin-discard" role="alert">
          <p>You have unsaved changes. Discard them and close this inquiry?</p>
          <div>
            <button className="admin-button" onClick={() => setDiscard(false)}>
              Keep editing
            </button>
            <button className="admin-button admin-discard-button" onClick={onClose}>
              Discard changes
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <div className="admin-empty" role="status">
          <LoaderCircle className="admin-spin" size={25} />
          Loading inquiry…
        </div>
      ) : !item ? (
        <div className="admin-empty">
          <p className="admin-error" role="alert">
            {error}
          </p>
          <button className="admin-button" onClick={() => setRevision((v) => v + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="admin-detail-body">
            <div className="admin-detail-summary">
              <Status value={item.status} />
              <span>
                <Clock3 size={13} aria-hidden="true" />
                Received {dateTime(item.createdAt)}
              </span>
            </div>
            <section className="admin-detail-section">
              <h3>The conversation</h3>
              <dl className="admin-detail-grid">
                <div>
                  <dt>Contact</dt>
                  <dd>
                    {item.name}
                    <span>{item.email}</span>
                  </dd>
                </div>
                <div>
                  <dt>Company</dt>
                  <dd>{item.company || 'Not provided'}</dd>
                </div>
                <div>
                  <dt>Selected solution</dt>
                  <dd>{solutions[item.selectedSolution]?.name || item.selectedSolution}</dd>
                </div>
                <div>
                  <dt>Recommended solution</dt>
                  <dd>{solutions[item.recommendedSolution]?.name || item.recommendedSolution}</dd>
                </div>
              </dl>
              <div className="admin-message">
                <h4>Visitor’s message</h4>
                <p>{item.message || 'No additional message provided.'}</p>
              </div>
            </section>
            <section className="admin-detail-section">
              <h3>Discovery context</h3>
              {item.answers.sourceCaseStudyId && (
                <p className="case-origin-note">
                  Starting example (demonstration):{' '}
                  {findCaseStudy(item.answers.sourceCaseStudyId)?.title ||
                    item.answers.sourceCaseStudyId}
                  . The example supplies editable starting context; it is not a delivered client
                  project.
                </p>
              )}
              <dl className="admin-detail-grid">
                <div>
                  <dt>Business goal</dt>
                  <dd>
                    {goals.find((goal) => goal.id === item.answers.goal)?.title || 'Not provided'}
                  </dd>
                </div>
                <div>
                  <dt>Timeline</dt>
                  <dd>
                    {timelines.find((timeline) => timeline.id === item.answers.timeline)?.title ||
                      'Not provided'}
                  </dd>
                </div>
                <div>
                  <dt>Priorities</dt>
                  <dd>
                    {item.answers.needs?.map((id) => needs[id]?.title || id).join(', ') ||
                      'Not provided'}
                  </dd>
                </div>
                <div>
                  <dt>Starting point</dt>
                  <dd>
                    {stages.find((stage) => stage.id === item.answers.stage)?.title ||
                      'Not provided'}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="admin-detail-section">
              <div className="admin-section-title">
                <FileText size={18} aria-hidden="true" />
                <h3>Project brief</h3>
              </div>
              {item.projectBrief ? (
                <BriefPreview brief={item.projectBrief} />
              ) : (
                <div className="admin-notice">
                  This is a quick inquiry. No project brief was attached; use the discovery context
                  and visitor’s message to guide the conversation.
                </div>
              )}
            </section>
            <form id="admin-review-form" onSubmit={save} className="admin-review-form">
              <div className="admin-section-title">
                <MessageSquareText size={18} aria-hidden="true" />
                <h3>Your follow-up</h3>
                <span>Internal only</span>
              </div>
              <label className="admin-field">
                Inquiry status
                <select
                  value={status}
                  disabled={saving}
                  onChange={(e) => {
                    setStatus(e.target.value as InquiryStatus);
                    setSaved(false);
                  }}
                  aria-describedby="admin-status-help"
                >
                  {inquiryStatuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="admin-help" id="admin-status-help">
                Track your progress. Status changes do not send a message to the visitor.
              </p>
              <label className="admin-field">
                Internal notes
                <textarea
                  rows={5}
                  maxLength={5000}
                  value={notes}
                  disabled={saving}
                  placeholder="Add discovery questions, follow-up details, or next steps…"
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setSaved(false);
                  }}
                  aria-describedby="admin-notes-help"
                />
              </label>
              <div className="admin-notes-help" id="admin-notes-help">
                <span>Visible only in this admin workspace.</span>
                <span>{notes.length.toLocaleString()} / 5,000</span>
              </div>
              {item.updatedAt && (
                <p className="admin-help">Last updated {dateTime(item.updatedAt)}</p>
              )}
              {error && (
                <p className="admin-error" role="alert">
                  {error}
                </p>
              )}
              {conflict && (
                <button
                  type="button"
                  className="admin-button"
                  onClick={() => setRevision((v) => v + 1)}
                >
                  Discard edits &amp; load latest version
                </button>
              )}
            </form>
          </div>
          <div className="admin-detail-footer">
            <span role="status">
              {saved ? (
                <>
                  <Check size={16} aria-hidden="true" /> Changes saved
                </>
              ) : dirty ? (
                'Unsaved changes'
              ) : (
                'All changes saved'
              )}
            </span>
            <button
              type="submit"
              form="admin-review-form"
              className="primary-button"
              disabled={!dirty || saving || conflict}
            >
              {saving ? (
                <>
                  <LoaderCircle className="admin-spin" size={16} />
                  Saving…
                </>
              ) : (
                <>
                  Save changes
                  <Check size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
