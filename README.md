# Cynbit Solution Finder

A standalone full-stack assessment prototype: three guided steps turn a visitor’s goals into an explained recommendation, an optional tailored project brief, and a correctly categorized demo inquiry.

## Run locally

Requires **Node.js 24 or later** (uses the built-in `node:sqlite` module).

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. The app, API, and Vite development middleware run in one process. No account, API key, or external database is needed. SQLite creates `data/inquiries.sqlite` on first run. This directory is ignored by Git.

```sh
npm test
npm run build
npm start
```

`npm start` serves the production build on the same port. Use `PORT`, `HOST`, and `DATABASE_PATH` to override defaults. For a hosted Node service, set `HOST=0.0.0.0`, select a Node 24 runtime, and point `DATABASE_PATH` to a persistent disk. The current SQLite implementation requires a persistent Node server; it is **not suitable for Vercel’s ephemeral serverless filesystem**. A PostgreSQL adapter would be appropriate for that deployment model.

## Implemented experience

- Goal selection, contextual capability selection (up to three), starting point, and timeline.
- Explicit, deterministic recommendations for TenantEase, Revio, Cynbit Studio, BitElevate, AI automation, software development, cloud infrastructure, and digital marketing.
- A discovery fallback for ambiguous or open-ended needs; ties are not presented as artificial confidence percentages.
- Explanations, alternative options, links to the original offering, and a downloadable text brief.
- Ability to edit previous answers. Changing the goal clears capabilities that would otherwise become stale.
- Questionnaire and project brief recovery using session storage. Contact form fields are never stored in browser storage.
- An accessible inquiry form carrying the selected solution and original answers into the API.
- Client and server validation, SQLite persistence, idempotent retries, and a clear demo reference.
- Responsive layouts, native form semantics, keyboard focus management, an accessible native information dialog, and reduced-motion support.

## Project Brief Builder

Choose **Build my project brief** after a software development or AI automation recommendation. The quick inquiry remains available for every solution.

1. **The problem:** describe the business challenge and intended users. Software projects ask about the current system; automation projects ask about the existing process, task frequency, and tools.
2. **Scope & success:** list must-haves, optional improvements, integrations, success criteria, and an optional budget range with currency. A blank budget appears as “Not sure yet”.
3. **Review brief:** edit either section, download a text document, or continue to the inquiry form. The selected solution, finder priorities, starting point, and timeline travel with the brief.

Unfinished project answers and progress recover after refreshing the same tab. Changing the goal, priorities, or selected solution clears the old project draft; changing only the starting point or timeline updates the context and keeps the project answers. Returning through discovery with unchanged answers preserves a selected alternative. Successful submission and “Start over” clear the tab’s saved draft. If browser storage is unavailable, the flow works in memory and explains that refresh recovery is unavailable. Contact details and consent are never saved in browser storage. Use fictional details in all free-text fields.

The inquiry screen shows the attached brief and allows another review before saving. The confirmation download includes the saved reference. A quick inquiry deliberately excludes any optional project draft.

### Database upgrade

Starting the updated server automatically adds the nullable `project_brief_json` column to an existing inquiry database. Existing records remain intact with a null brief. New briefs store their version, solution, and structured answers in that column; the original finder answers remain in `answers_json`. Restart any already-running server after updating so the migration and API changes take effect.

## Interactive Case-Study Explorer

Choose **Case studies** in the public navigation or open `/#case-studies`. Four clearly labeled demonstrations cover a service portal, connected inventory, invoice review automation, and a support knowledge assistant. Each includes an industry, business problem, proposed solution, challenge, approach, potential deliverables, and an explicit **Verified results: not available** section. The diagrams illustrate concepts; they are not screenshots of delivered client projects.

Search matches all entered words across titles, industries, service names, summaries, problems, solutions, and deliverables. Combine search with a service filter and an industry filter. Empty results offer a reset. Gallery filters remain in memory while opening details and returning; browser Back/Forward and shareable links such as `/#case-studies/invoice-review-workflow` work without adding a router dependency. Filters reset on refresh.

Software and AI recommendations show two examples from the selected service, ordered by overlap with the visitor’s priorities. Changing the selected solution updates these matches. Services without examples show an honest fallback and a link to the collection.

**Start a similar project** opens the existing brief builder with the example’s service. **Prepare a quick inquiry** opens the existing inquiry form. Compatible Finder answers and brief drafts are preserved. Otherwise, the page explains the editable starting defaults before the button: the example’s priorities, “Exploring possibilities,” and “Just researching.” Project fields start empty; demonstration problems and outcomes are never copied into a visitor’s brief. Switching away from an active incompatible brief asks before replacing it. A completed inquiry starts a fresh brief.

An optional validated `sourceCaseStudyId` travels inside the finder answers, saved brief context, inquiry record, admin detail, and text export. This metadata never bypasses the existing recommendation validation; the source’s service must match the inquiry’s selected service. Changing goals or priorities clears stale source metadata. Refresh recovery follows the existing project-brief rules.

### Content and approval

The collection lives in `shared/caseStudies.ts`. The initial version deliberately supports demonstration content only. None of these scenarios is evidence that Cynbit delivered a client project, and no client names, testimonials, performance numbers, or approvals are invented. All measurement suggestions describe future evaluation, not achieved results.

Before publishing real case studies, obtain approval for the client identity (or agreed anonymization), project description, deliverables, and each result. Keep supporting sources, measurement periods, baselines, and limitations. Add an explicit approved-content model and evidence display at that point; do not simply remove a demonstration label or rename a metric into a result.

### Activity tracking

`POST /api/case-study-events` accepts strict JSON `{ id, caseStudyId, type, source }`. `id` is a UUID, `type` is `view`, `brief_start`, or `inquiry_start`, and `source` is `gallery` or `recommendation`. Unknown examples, fields, event types, and sources are rejected. The request limit is 2 KB, cross-origin browser writes are blocked, and a separate process-local limit allows 120 events per socket address per 15 minutes. A repeated identical ID counts once; reusing it for different data returns 409.

Startup adds an independent `case_study_events` table without modifying existing inquiries. It stores only the event ID, example ID, action, entry point, and server timestamp. It stores no IP, contact details, search terms, visitor identifier, or cookies. Socket addresses are used only by the in-memory limiter. Events remain until the operator deletes them; use an appropriate retention policy before public deployment.

Views count detail openings, including direct links and later revisits. Brief and inquiry starts are counted once per example/action during the mounted public flow, including returning from a detail to a matching recommendation; a reload or “Start over” begins a new flow. An inquiry start after completing a brief also counts. These are recorded actions, not unique visitors, completed inquiries, or a deduplicated conversion funnel. Counts can be affected by blocked requests, refreshes, and automation. Tracking is best effort and never delays navigation or submission.

Authenticated admins can open **Case-study activity** in the dashboard to see all-time views, brief starts, and inquiry starts for every example, including zeros. **Refresh activity** reloads the counts. `GET /api/admin/case-study-analytics` uses the same admin session and origin protection as the inquiry inbox, returns aggregate counts only, and is unavailable to public visitors. Restart an older running server to activate the new API routes; frontend hot reload alone does not update the Node server.

Case-study tests cover combined filters, empty results, relevance ordering, service handoff, blank brief content, draft recovery, source validation, complete inquiry persistence, idempotent events, body/origin/rate limits, authenticated metrics, and database reopening. Browser verification should cover mobile layouts and the complete gallery → detail → brief → inquiry flow, alongside a recommendation → detail → quick-inquiry flow.

## Admin Inquiry Dashboard

Open **Admin workspace** in the Solution Finder footer, or visit `/admin` directly. The dashboard reads the same saved inquiries and project briefs as the public flow. It includes an inbox, contact details, both brief types, quick inquiries without a brief, discovery context, status totals, search, filters, and internal notes.

### Create your local admin account

From the project directory, run:

```sh
npm run admin:setup
npm run dev
```

The setup command creates `admin@example.com` with a random password and displays that password once. Save it in your password manager. Only its salted scrypt hash is stored in `data/admin.json`, which is ignored by Git. To use another email, run `npm run admin:setup -- you@example.com`. Restart any running server after setup.

To recover access, run `npm run admin:setup -- you@example.com --reset` and restart the server. This generates a new password and invalidates existing sessions when the server restarts. No account or default password is embedded in the frontend. Until configured, admin APIs are unavailable and the public Solution Finder continues working.

### Review and follow up

1. Sign in at `/admin`. Existing inquiries appear as **New**, including records created before this dashboard was added.
2. Search by name, company, email, or reference. Combine solution, status, and received-date filters, then choose **Apply filters**. Date ranges include both selected dates in UTC; displayed timestamps use your browser’s local timezone.
3. Open an inquiry to read the contact details, message, finder context, and attached software or automation brief.
4. Choose **New**, **Reviewing**, **Contacted**, or **Closed**, add internal notes, and choose **Save changes**. These fields are stored separately from the original submission. Notes are limited to 5,000 characters.
5. Use **Refresh inbox** to load new submissions. The four status totals cover all submissions, even when the list is filtered; each total also filters the inbox. Results use 20-item pages, newest first.

The viewer warns before discarding unsaved edits. If another tab has saved a newer version, it rejects the stale update and offers to load the latest version. Save failures keep the current edits available for retry. Session expiry returns to sign-in and clears private dashboard data; unsaved edits are not persisted. Status changes and notes never send email or contact Cynbit.

### Sessions and hosting

Admin APIs use random, server-side sessions in an HttpOnly, SameSite=Strict cookie, an exact-origin check, and a session-bound CSRF token for changes and logout. Sessions expire after eight hours, are invalidated on logout or server restart, and are limited to 25 per process. Login accepts ten attempts per socket address in 15 minutes. Passwords and inquiry contents are not written to application logs or browser storage.

The app reads an optional `.env` file at startup. For hosting, set `ADMIN_CONFIG_PATH` to a private persistent config file, or set both `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` in your host’s environment (the environment takes precedence). The generated `data/admin.json` contains the hash in the required format. Never place these values in `VITE_*` variables or commit your admin config.

Production mode defaults to Secure cookies and requires HTTPS for admin login. Behind an HTTPS reverse proxy, set `ADMIN_ORIGIN` to the exact browser-facing origin, such as `https://your-app.example.com`, without a trailing slash. For a local production preview over HTTP only, set `ADMIN_SECURE_COOKIES=false`. The app deliberately does not trust forwarded headers. This prototype supports one admin account and one Node process; multiple instances require shared session and rate-limit storage.

### Admin API

- `GET /api/admin/session`: whether admin access is configured; authenticated sessions also receive the admin email, CSRF token, and expiry.
- `POST /api/admin/session`: JSON `{ email, password }`; requires a matching `Origin` header and sets the session cookie.
- `DELETE /api/admin/session`: requires the session cookie, matching `Origin`, and `X-CSRF-Token`; revokes the session.
- `GET /api/admin/inquiries`: authenticated inbox; optional `q`, `status`, `solution`, `from`, `to`, and `page` query parameters. Returns items, filtered total, current page, page size, and unfiltered status counts.
- `GET /api/admin/inquiries/:reference`: authenticated inquiry details, including notes and the current edit version.
- `PATCH /api/admin/inquiries/:reference`: JSON `{ status, notes, version }`; requires the cookie, matching `Origin`, and `X-CSRF-Token`. Returns the updated detail. A stale version returns 409 without changing anything.

Startup creates the `inquiry_management` table and list indexes without modifying original inquiry fields. Existing records retain their briefs, references, contact details, and idempotency behavior.

## Matching model

The catalog is in `shared/catalog.ts`; matching and validation are in `shared/recommend.ts`.

1. The chosen goal contributes a small base score where it names a clear use case.
2. Each selected capability contributes explicit weights to relevant offerings.
3. The highest-scoring offering is suggested. Equally strong leading options produce a discovery recommendation and retain both alternatives.
4. Stage and timeline travel in the inquiry brief but do not change product ranking.
5. The server recomputes the recommendation and validates the selected offering against the offered primary/alternatives. A general discovery conversation is always allowed.

Examples: rental payment tracking → TenantEase; review monitoring → Revio; self-directed coding practice → Studio; mentor-guided projects → BitElevate; an equal need for acquisition and reviews → discovery with marketing and Revio alternatives.

This is an illustrative matching model, not a claim about Cynbit’s internal qualification process. Product descriptions were based on public pages reviewed on 2 November 2026:

- https://www.cynbit.in/products
- https://www.cynbit.in/services
- https://www.cynbit.in/bitelevate

## API

`POST /api/recommend`: JSON `{ goal, needs, stage, timeline }` → primary recommendation, reasons, alternatives, context, and catalog version.

`POST /api/inquiries`: JSON `{ answers, selectedSolution, name, email, company, message, consent }`, with an `Idempotency-Key` UUID header → `{ reference, solution, receivedAt, prototype: true }`.

This endpoint also accepts an optional `projectBrief`. Shared validation in `shared/projectBrief.ts` enforces the fields below, trims submitted text, and bounds field lengths. The brief’s `solution` must match `selectedSolution`, and that solution must be offered for the finder answers.

```json
{
  "version": 1,
  "solution": "software",
  "problem": "Customer requests get lost in spreadsheets.",
  "audience": "Our support team and managers",
  "currentSystem": "Shared spreadsheets and email",
  "mustHaves": "Create requests\nAssign owners\nTrack status",
  "niceToHaves": "Weekly reports",
  "integrations": "Zoho CRM",
  "success": "Reduce manual tracking to under 15 minutes a day.",
  "budget": ""
}
```

For `solution: "ai-automation"`, replace `currentSystem` with `currentProcess`, `frequency`, and `tools`. Frequency is one of `daily`, `weekly`, `monthly`, `variable`, or `unsure`. Unknown fields and fields from the other service are rejected. Optional text values can be empty strings. The request body limit is 48,000 bytes to accommodate a complete brief with Unicode text.

The same key with the same validated data returns the original receipt. Reusing a key with different data returns 409. Invalid data returns 400, unsupported content types 415, oversized requests 413, cross-origin browser writes 403, and too many new inquiries from the same socket address 429. There is no public endpoint to list stored inquiries. Database writes use parameterized statements.

## Tests

`npm test` checks all offering routes, ambiguous needs, priority constraints, stale data, product tampering, consent/email validation, API persistence, duplicate prevention, cross-origin writes, request limits, and persistence across database reopening. Brief tests cover both service schemas, missing and oversized fields, mismatched solutions, draft recovery, context changes, exports, Unicode requests, retries after editing a brief, quick inquiries, and migration of an existing database. Tests use fictional data and an in-memory or temporary database.

Admin tests cover unauthenticated access, disabled setup, password rejection, origin and CSRF checks, cookie flags, login throttling, session rotation/logout/expiry, full brief retrieval, validated updates, stale-edit conflicts, combined filters, pagination, and persistent notes. For manual verification, sign in, review both brief types and a quick inquiry, save a status and note, reopen it, exercise filters and empty results, check unsaved-edit warnings, and sign out. Repeat at a mobile viewport with keyboard navigation.

For a manual check, complete one software and one automation brief; refresh partway through scope entry; edit a review section; change timing and confirm project answers remain; change solutions and confirm old questions clear; download the brief; submit fictional contact details; and check the confirmation. Repeat at a 390 px mobile viewport and use Tab/Shift+Tab to check focus and field errors.

## Scope and integration

No Cynbit source code or private APIs were used. This app runs independently. It does not contact Cynbit, send email, reserve appointments, or claim to modify the live website. The prototype is explicitly labeled, and its inquiry form requests fictional test details.

For integration, add a “Find your solution” entry point to the public site, embed or mount the frontend, and adapt the submission repository to the existing lead-management system. Preserve the selected solution identifier, user-approved answers, optional versioned project brief, consent timestamp, and catalog version end to end.

Before accepting real public inquiries, configure production data retention and access controls, use an appropriate managed database or persistent disk, add shared rate limiting and abuse protection, and obtain business approval for qualification rules and data-processing copy. The included rate limiter is process-local and uses the socket address; behind a proxy, all visitors may share that address. Do not trust forwarded IP headers without a trusted-proxy configuration.

## Project layout

```text
src/           React interface and styles
shared/        Offering catalog, rule engine, Zod schemas
server/        HTTP API, SQLite storage, development/production server
tests/         Recommendation and API integrity tests
public/        Original prototype favicon
```

The frontend uses React, TypeScript, Vite, and Lucide icons. The backend uses Node HTTP and SQLite. No paid services or generative AI APIs are required.
