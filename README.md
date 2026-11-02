# Cynbit Solution Finder

A standalone full-stack assessment prototype: three guided steps turn a visitor’s goals into an explained recommendation and a correctly categorized demo inquiry.

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
- Questionnaire recovery using session storage. Names and email addresses are never stored in browser storage.
- An accessible inquiry form carrying the selected solution and original answers into the API.
- Client and server validation, SQLite persistence, idempotent retries, and a clear demo reference.
- Responsive layouts, native form semantics, keyboard focus management, an accessible native information dialog, and reduced-motion support.

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

The same key with the same validated data returns the original receipt. Reusing a key with different data returns 409. Invalid data returns 400, unsupported content types 415, oversized requests 413, cross-origin browser writes 403, and too many new inquiries from the same socket address 429. There is no public endpoint to list stored inquiries. Database writes use parameterized statements.

## Tests

`npm test` checks all offering routes, ambiguous needs, priority constraints, stale data, product tampering, consent/email validation, API persistence, duplicate prevention, cross-origin writes, request limits, and persistence across database reopening. Tests use fictional data and an in-memory or temporary database.

## Scope and integration

No Cynbit source code or private APIs were used. This app runs independently. It does not contact Cynbit, send email, reserve appointments, or claim to modify the live website. The prototype is explicitly labeled, and its inquiry form requests fictional test details.

For integration, add a “Find your solution” entry point to the public site, embed or mount the frontend, and adapt the submission repository to the existing lead-management system. Preserve the selected solution identifier, user-approved answers, consent timestamp, and catalog version end to end.

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
