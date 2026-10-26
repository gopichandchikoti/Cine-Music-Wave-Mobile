# AGENTS.md

This is the single source of truth for every coding agent that works in this repository (Codex, Claude Code, GitHub
Copilot, Cursor and others). Every other agent file (`CLAUDE.md`, `.github/copilot-instructions.md`,
`.github/agents/*.agent.md`, `.codex/agents/*.toml`, Cursor rules) only points here. Change the rules in this file,
never in a copy.

## How to use this file

- **Part 1 is the universal standard.** It is identical in every repository of the portfolio. To start a new app, create
  an empty repository, copy this file into it, keep Part 1 unchanged, replace Part 2 with the new project's facts, and
  tell the agent to follow Section 10 ("Bootstrapping a new app"). Nothing else needs to be pasted.
- **Part 2 describes this project.** It is the only part that may name files, ports, products or owners.
- Rule words: **MUST** and **MUST NOT** are mandatory, **SHOULD** needs a written reason to skip. Every rule has an ID
  (SEC-07, PERF-12) so reviews and commit messages can cite it.
- Order of authority: the owner's current instruction, then Part 2, then Part 1, then older documents. If a rule here
  conflicts with the owner's instruction, follow the instruction and say which rule was set aside.
- **An approved design is never restyled to satisfy this file** (UI-01). The standard decides how new work is built and
  how existing work is audited; it does not give an agent permission to redesign something the owner has approved.

---

# Part 1: Universal standard

## 1. Working protocol (PRC)

- PRC-01 Read before writing. Open the nearest implementation, its callers, its tests and the project documents named in
  Part 2. Current source and `package.json` scripts beat any older document.
- PRC-02 Plan first for anything larger than one file: state the goal, the files that change, the checks that prove it,
  and what is out of scope. Then work in small steps and run the narrowest check after each one.
- PRC-03 Ask only when blocked by a decision that belongs to the owner (a destructive action, an approved design, a
  credential, a cost). Otherwise choose the conventional option, say so in one line, and continue.
- PRC-04 Never claim a check passed unless it ran in this session. Report failures with their output. Name every check
  that could not run (missing credentials, missing device, missing tool) instead of implying success.
- PRC-05 Do not commit, push, reset, discard, overwrite or delete work you did not create. Never run a destructive command
  without looking at its target first. Never wipe a shared emulator, database or media folder.
- PRC-06 Do not install tools, change system settings or send source code to an outside service without the owner's
  go-ahead. Sending content to an external service publishes it.
- PRC-07 Keep a change log entry for every feature, fix, refactor, configuration or documentation change (Section 8).
- PRC-08 Finish what you start: no placeholder code, no half-wired feature, no TODO left as the deliverable.

## 2. Design standard (UI)

### 2.1 The design record

- UI-01 Every app has a written design record in `system_design.md`: audience, palette tokens with measured contrast,
  type pairing, spacing and radius scale, motion rules, icon set and voice. Build from the record, not from defaults.
  If a design is approved, it is frozen: new work follows it, audits report against it, nobody restyles it unasked.
- UI-02 All colour, radius, shadow, spacing and motion values come from tokens (CSS custom properties or a theme file).
  A hard-coded value in a component is a defect.
- UI-03 Provide a light and a dark theme from the same tokens, unless the design record says the product is one theme.

### 2.2 The thirty tells of a generated site

A page looks generated when it shows these patterns by default. For new work an agent MUST avoid each one unless the
design record chooses it on purpose and says why. For existing work an agent MUST report the ones present and MUST NOT
remove an approved one on its own (UI-01). `pnpm audit:standards` lists the ones it can detect.

| # | Tell | Instead |
|---|------|---------|
| 1 | Harsh or multi-stop decorative gradients | Flat surfaces; a gradient only to keep text legible over an image |
| 2 | Lucide icons as the unconsidered default | One icon family chosen in the design record, imported from one module |
| 3 | Pure white page background | A tinted neutral from the tokens |
| 4 | Rainbow colouring | One primary, one accent, neutrals; status colours only for status |
| 5 | Soft drop shadows on every card | Borders and spacing; shadow only on floating layers |
| 6 | Three feature cards in a row | A list, a table, or the real product on screen |
| 7 | Emoji as icons or bullets | Real icons or none |
| 8 | Liquid-glass panels as decoration | Glass only where the design record specifies it |
| 9 | Em dashes in copy | Commas, colons, full stops |
| 10 | Inter, Geist or Space Grotesk by default | A deliberate pairing, self-hosted |
| 11 | A coloured stripe on one edge of a card | A full border or a background tint |
| 12 | Invented testimonials, logos or statistics | Real data or nothing |
| 13 | Bento grids | A layout that follows the content |
| 14 | A fake terminal window as decoration | The real output, or nothing |
| 15 | "It's not X, it's Y" copy | State what the thing does |
| 16 | Check-mark bullets for every list | Plain list markers |
| 17 | Three pricing tiers by reflex | Only if the product sells tiers |
| 18 | No real product demo | Show the actual app, with real states |
| 19 | One very large corner radius everywhere | A small radius scale (control, panel, dialog) |
| 20 | Purple on black as the identity | A palette drawn from the product's subject |
| 21 | No skeleton or loading structure | A placeholder shaped like the content, plus an announced status |
| 22 | Radial glowing orbs | Nothing, or a real image |
| 23 | Dot or line grids behind everything | A plain background |
| 24 | Sparkle icons for anything "smart" | A plain icon that names the action |
| 25 | Animated arrows on every button | Text, with motion only for state change |
| 26 | No terms of use | A real page, linked from sign-in and the footer |
| 27 | No privacy policy | A real page that matches what the code stores |
| 28 | Hover lift and tilt on everything | Colour or border change on hover; spring motion for layout change (2.4) |
| 29 | Neon accent colours | Accents that pass contrast on both themes |
| 30 | Generic pastel palettes | Tokens chosen for the subject and checked for contrast |

### 2.3 Honesty and content

- UI-10 Show the real product: real data, real empty states, real errors. No lorem ipsum, no invented figures, no
  placeholder logos. Demo content is labelled as demo content.
- UI-11 Copy states what a control does or what a page holds. It uses sentence case, active verbs and no slogans.
  Every user-visible string lives in the content model (`src/content.model.json` or equivalent), not in components.
- UI-12 Every app that has accounts, uploads, analytics or third-party calls ships a Privacy page and a Terms page that
  are accurate to the code (what is stored, where, for how long, who receives it). They are public routes, linked from the
  sign-in screen and from a footer. Adding links to an approved screen MUST NOT change its layout (put them inline in an
  existing line). A lawyer should review the text before a public launch.
- UI-13 Loading, empty, error, offline, unauthorised and success states exist for every data view. A loading state has
  structure (skeleton or outline) and one polite status announcement.

### 2.4 Motion: Apple-style springs

Motion explains a change of state. It is never decoration. Layout changes (a tab indicator moving, a sheet opening, a
panel minimising, a menu appearing, a dialog closing) use springs, not fixed-duration curves.

- UI-20 Model: a damped spring with mass 1. Parameters follow Apple's: `response` (seconds, the perceived duration) and
  `dampingFraction` (1 is critically damped with no overshoot, below 1 overshoots). Physical values are
  `stiffness = (2π / response)²` and `damping = 4π × dampingFraction / response`. SwiftUI's `duration` and `bounce` map
  to `response = duration` and `dampingFraction = 1 - bounce`.
- UI-21 Three named springs cover everything. Do not invent a fourth without a design-record entry.

  | Name | response | dampingFraction | Use |
  |------|----------|-----------------|-----|
  | snappy | 0.32 s | 0.86 | Tab indicators, toggles, small state changes |
  | smooth | 0.50 s | 1.00 | Sheets, page and mode changes, minimise and expand (no overshoot) |
  | bouncy | 0.45 s | 0.70 | Menus, popovers and dialogs appearing |

- UI-22 Web: generate the curve from the spring equation and write it as a CSS `linear()` easing in `themes/motion.css`,
  with the settling time as the duration. Animate `transform` and `opacity` only. Provide a `cubic-bezier` fallback with
  `@supports not`. Native: use the platform spring (`withSpring` in Reanimated with `mass: 1` and the damping and
  stiffness above, SwiftUI `.spring`, Compose `spring`).
- UI-23 Closing and minimising are animated too: keep the element mounted until its exit finishes (a presence hook), and
  start the exit from the current state so an interrupted open reverses smoothly. A gesture that drags an element hands
  its release velocity to the spring.
- UI-24 `prefers-reduced-motion: reduce` removes spring travel and scale; opacity may still change within 120 ms.
  Animation never blocks input, never delays content, and never runs on a hidden tab.

### 2.5 Accessibility and responsive behaviour

- UI-30 Meet WCAG 2.2 AA: text contrast 4.5:1 (3:1 for large text and UI parts), visible focus on every control, no
  information carried by colour alone, labels for every input and icon button, a skip link, one `main` landmark.
- UI-31 Full keyboard operation with logical focus order; dialogs trap and restore focus; Escape closes layers.
- UI-32 Touch targets are at least 40 px (44 px on mobile). The layout works from 320 px wide to 2560 px wide, in
  portrait and landscape, with zoom to 200% and with browser text size increased.
- UI-33 Respect `prefers-color-scheme`, `prefers-reduced-motion` and `prefers-contrast`. Use logical CSS properties so
  right-to-left languages need no rewrite.
- UI-34 Images and media declare dimensions (no layout shift), have text alternatives, and use modern formats.

## 3. Security standard (SEC)

Treat the network, the filesystem, uploads, Markdown, provider responses and every request field as untrusted. These are
the minimum checks for every app. Each row names how it is proved.

| ID | Requirement | Proof |
|----|-------------|-------|
| SEC-01 | No API keys, tokens, passwords or private keys in source, bundles, URLs, logs, screenshots or docs. Client code holds none. | Secret scan of tracked files; bundle grep |
| SEC-02 | Environment variables are parsed once, validated at start-up, and fail fast with a clear error. `.env` is ignored; `.env.example` lists every name with no value. | Config test; `git ls-files` shows no `.env` |
| SEC-03 | Admin and owner routes check the role on the server for every request. | Test with a normal user token |
| SEC-04 | Authentication: passwords hashed with scrypt, argon2id or bcrypt and a per-user salt; constant-time comparison; sessions are random, stored only as hashes, HttpOnly, Secure in production, SameSite set deliberately, idle and absolute expiry, revocable. | Auth tests; cookie header test |
| SEC-05 | Access control is object-level: every read or write of a record checks that the caller owns it or may see it (no IDOR). Hidden buttons are not access control. | Cross-account tests |
| SEC-06 | All input is validated at the boundary with a schema (type, length, range, format, allow-list). Unknown fields are rejected or ignored on purpose. | Validator tests with hostile input |
| SEC-07 | Output is encoded for its context. Never render untrusted HTML. Markdown goes through a sanitiser. No `dangerouslySetInnerHTML`, `eval`, `new Function`, or string-built SQL, shell or regex. | Lint rule; audit script |
| SEC-08 | Rate limits on every route, tighter on sign-in, sign-up, reset, upload and any expensive scan or export. Limits answer 429 with `Retry-After`. Memory use of the limiter is bounded. | Limiter tests |
| SEC-09 | Public API routes list their allowed methods, require the right content type, cap body size, and return the stable error body in 5.4. | Route tests |
| SEC-10 | CORS is closed by default (same origin). When a separate API origin is needed, allow one explicit origin, never `*` with credentials, and add `Vary: Origin`. | Header test |
| SEC-11 | Every response carries: `Content-Security-Policy` (no `unsafe-eval`, no wildcard sources in production), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, framing control, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`. Production adds HSTS (one year) and redirects or refuses plain HTTP. | Header test against the running server |
| SEC-12 | Debug mode is off in production: no stack traces, SQL, paths or provider errors in responses; source maps are not served; verbose logging is off. | Error-handler test; `NODE_ENV` test |
| SEC-13 | Dependencies are current and audited: `pnpm audit --prod` shows no high or critical finding; a patched version is installed or an override is added with the advisory ID. Lockfiles are committed. | `pnpm deps:audit` |
| SEC-14 | Unused packages are removed. A package is added only when the platform does not already provide the feature. | Audit script (unused dependencies) |
| SEC-15 | Nothing private is exposed by the web root: only the build output is served; dotfiles, `.git`, `node_modules`, data folders, logs and backups are never reachable; temp and scratch files are not committed. | Static-server test; `git ls-files` review |
| SEC-16 | Databases use parameterised queries, least-privilege accounts, constraints and migrations. Service-role keys stay on the server. Large binaries live in object storage, not in rows. | Code review; schema check |
| SEC-17 | Paths from users are resolved and confined to their root after following links; absolute paths, `..`, encoded traversal, NUL bytes and hidden folders are refused. Archive entries cannot escape their folder. | Traversal tests |
| SEC-18 | Uploads are staged, size-limited, extension- and type-checked, stored under random names outside the web root, and committed only after the owner approves. Active documents (SVG, HTML, XML) are served sandboxed. | Upload tests |
| SEC-19 | Secrets are scanned in the working tree and in git history before every release. Anything found is rotated, not just deleted. | Secret-scan output in the validation doc |
| SEC-20 | Outbound requests use an allow-list, a timeout and a size cap (no open proxy, no SSRF). Webhooks and callbacks verify a signature or a state value. | Tests with internal addresses |
| SEC-21 | Account deletion and data export exist when accounts exist. Audit events record what happened, never the secret. | Account tests |
| SEC-22 | A security review is run on every release: the full audit (Section 7), the attack tests, and an optional autonomous pentest (7.4). Findings are fixed or written down with an owner and a date. | `VALIDATION.md` entry |

## 4. Performance standard (PERF)

### 4.1 Budgets

- PERF-01 Core Web Vitals at the 75th percentile: LCP 2.5 s or less, INP 200 ms or less, CLS 0.1 or less. Measure in a
  real browser on a throttled profile (4x CPU slowdown, fast 3G) and record the numbers.
- PERF-02 Initial JavaScript on the first route is 250 KB or less (before compression); every other route is loaded on
  demand. Each chunk is 250 KB or less. A test fails the build when a budget is passed.
- PERF-03 No request chain longer than three on the first screen; no render-blocking third-party resource.

### 4.2 Techniques (all of them, not a menu)

| ID | Technique | Rule |
|----|-----------|------|
| PERF-10 | Code splitting | Split by route and by heavy feature (editor, player, charts). Lazy-load below the fold. |
| PERF-11 | Lazy loading | `loading="lazy"` and `decoding="async"` on images and iframes that start off screen; the largest visible image gets `fetchpriority="high"`. |
| PERF-12 | Image handling | Compress at build time, ship AVIF or WebP with fallbacks, serve responsive sizes with `srcset`, always set width and height. |
| PERF-13 | Virtualised lists | Lists that can pass about 200 rows are virtualised or use `content-visibility: auto`; never render thousands of live nodes. |
| PERF-14 | Browser APIs | `IntersectionObserver` for reveal and prefetch, `ResizeObserver` for layout, passive listeners, `requestIdleCallback` for non-urgent work. |
| PERF-15 | Priority hints | `preload` the first font and the first route chunk, `preconnect` to the one API origin, `prefetch` the likely next route. Nothing else. |
| PERF-16 | Cache busting | Content-hashed file names; hashed assets are `immutable` for one year; the HTML shell is `no-cache` so a deploy is seen at once. |
| PERF-17 | Compression | Brotli and gzip for text; precompress at build time and serve the twin; compress API JSON on the fly with a size threshold. Never compress range responses. |
| PERF-18 | Conditional requests | ETag on cacheable API responses and static files; the server answers 304. The ETag covers what the reader sees, not a timestamp. |
| PERF-19 | Connection reuse | Keep-alive and HTTP/2 or HTTP/3 at the edge; one origin for assets; no domain sharding. |
| PERF-20 | Scripts | `defer` every script; no inline blocking script; third-party scripts load after interaction or not at all. |
| PERF-21 | Styles | Component-based CSS next to each component; global tokens and base in a `themes` folder; responsive rules in their own file (`Name.responsive.css`) or a clearly marked block at the end. Extracted CSS files in production, not injected by script. Critical background colour set before first paint. |
| PERF-22 | Dead code | Tree-shake, remove unused exports, files, CSS and dependencies; the audit script reports them. |
| PERF-23 | Client data cache | Server data is cached on the client with request de-duplication and stale-while-revalidate (TanStack Query, or the shared helper in the project). Mutations invalidate the cache. A last-known copy shows at once while a fresh one loads. |
| PERF-24 | State | Keep state where it is used; lift only when two siblings need it. Use a store library only for state shared across distant parts. Memoise by measurement, not by habit. |
| PERF-25 | Fonts | Self-host variable WOFF2 subsets, `font-display: swap`, preload the first-screen faces, size-adjusted fallback to avoid layout shift. |
| PERF-26 | CDN and service worker | Put static assets behind a CDN when there is a public deployment. Add a service worker only with a written caching strategy, a versioned cache, an update prompt and a kill switch; never by default. |
| PERF-27 | Server | Stream large files with ranges, bound memory, avoid synchronous filesystem calls on request paths, share in-flight identical scans, shut down gracefully. |
| PERF-28 | Build first, tune later | Ship a correct, measured baseline first. Optimise what a measurement shows. Record before and after numbers in the change log. |

## 5. Architecture and structure (ARCH)

### 5.1 Frontend layout (React, any bundler)

```
frontend/
  src/
    @types/        ambient declarations and shared domain types
    api/           client, one module per backend area, index re-export
    assets/        fonts and images that are imported
    components/    shared presentational components (each with its own CSS)
    features/      one folder per product area; owns its components, hooks, state and CSS
    hooks/         shared hooks
    pages/         route-level screens
    routes/        route table, navigation, guards
    templates/     layout shells shared by pages
    themes/        tokens, base, motion, prose
    utils/         pure helpers (no React, no I/O)
    validators/    input rules shared by forms
    App.tsx  main.tsx  content.model.json
  index.html  package.json  biome.json  tsconfig*.json  README.md  .env.example  .gitignore
```

- ARCH-01 Dependencies point inward: `pages` use `features` and `components`; `features` use `components`, `hooks`, `api`,
  `utils`; `utils` use nothing. A feature never imports another feature's internals; share through `components` or `api`.
- ARCH-02 Server state lives behind `api/` modules and a cache; components never call `fetch` directly.
- ARCH-03 Each address is a route (`/study`, `/privacy`). Navigation uses the History API; refresh, Back and shared links
  work. Unknown addresses show a not-found page.
- ARCH-04 A file has one reason to change. Split a component or hook when it passes about 250 lines, a function when it
  passes about 50, or when its control flow is hard to follow. Do not split to satisfy a number.

### 5.2 Backend layout (Node, Express or similar)

```
backend/
  src/
    @types/        shared types
    config/        environment parsing and constants
    controllers/   HTTP in, HTTP out: parse, call a service, shape the response
    helpers/       small pure functions
    middlewares/   security headers, rate limit, request id, compression, errors
    models/        data access (repositories) and row types
    routes/        route tables that wire controllers and middleware
    services/      business rules; no HTTP types
    validators/    request schemas
    server.ts      builds the app; index.ts starts it
  package.json  biome.json  tsconfig.json  README.md  .env.example  .gitignore
```

- ARCH-10 Controllers do not hold business rules; services do not know about requests; models do not know about HTTP.
  Configuration is read once in `config/` and passed in; `process.env` is not read anywhere else.
- ARCH-11 `createApp(config)` returns the application without listening, so tests can start it on a random port. A
  `close()` releases databases. The entry point listens and handles `SIGINT` and `SIGTERM`.
- ARCH-12 A bounded product area with its own data (auth, media, learning) may be a feature module with the same inner
  layers (`routes`, `service`, `repository`, `validation`) instead of being spread across the top-level folders.

### 5.3 Mobile layout (React Native with Expo)

`src/core` (portable rules, no native imports), `src/data` (SQLite, repositories), `src/platform` (native adapters),
`src/design` (tokens and controls), `src/features` (screens), `modules/` and `plugins/` for custom native code. Generated
`android/` and `ios/` folders are never edited by hand. Permissions are declared once, requested when needed, and the
app works with every denied permission.

### 5.4 API contract

- ARCH-20 REST with JSON. Plural nouns, stable paths, correct verbs and status codes. A contract change updates the client
  adapter, every implementation, the docs and the tests in the same change.
- ARCH-21 One error body everywhere: `{ code, message, requestId }`. `400` invalid input, `401` unauthenticated, `403`
  forbidden, `404` missing, `409` conflict, `413` too large, `415` unsupported type, `429` rate limited, `503`
  dependency down, `500` anything else with a generic message. The `X-Request-Id` header repeats the id.
- ARCH-22 Lists are paginated or bounded. Writes are idempotent or protected by a token. Long jobs are queued, not run in
  a request.

## 6. Code quality (CODE)

- CODE-01 TypeScript with `strict`. No `any`, no unchecked casts, no `@ts-ignore`, no lint suppression to hide a finding.
  A narrow suppression needs a comment with the reason and a change-log entry.
- CODE-02 One formatter (Biome) and one linter (oxlint or Biome) configured in the repository, both run in `pnpm check`.
  Warnings are defects. Format every file you create or touch.
- CODE-03 Names say what a thing is. Functions are small and return early. No nested ternaries, no more than three levels
  of nesting, no unexplained magic numbers (name them), no commented-out code, no debug logging, no empty `catch`.
- CODE-04 Comments explain why, not what. Public functions and non-obvious modules carry a short doc comment.
- CODE-05 Errors are typed, handled once at a boundary, and never swallowed. User-facing messages are plain language.
- CODE-06 Add a dependency only when needed; read its licence and maintenance state; pin exact versions for native or
  security-sensitive packages; record the licence notice. Remove what stops being used.
- CODE-07 Data is migrated by versioned, reversible migrations. Never edit a deployed migration.
- CODE-08 Time, randomness and the network are injected so tests can control them.
- CODE-09 Accessibility and security fixes are not optional refactors: make them when you touch the code.

## 7. Testing and verification (TEST)

### 7.1 What must exist

- TEST-01 Unit tests for pure logic; component tests for forms and states; API tests that start the real app and call it
  over HTTP; build tests for budgets and output; end-to-end checks for the main journeys.
- TEST-02 Every bug fix adds a test that fails without the fix.
- TEST-03 Security tests (7.3) run in the normal test command, not only before a release.

### 7.2 Commands every repository defines

`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (or the named `test:*` scripts), `pnpm build`,
`pnpm deps:audit`, `pnpm audit:standards`. A README lists them. If a command does not exist yet, create it; do not invent
a result.

### 7.3 Attack tests

Run these against a started app with throw-away data: unauthenticated access to every protected route; one account reading
or changing another account's records; path traversal and encoded traversal on every path parameter; oversized and
malformed bodies; wrong content types; repeated sign-in failures; CSRF without the token; hostile Markdown and filenames;
missing security headers; verbose errors; directory listing; source maps; rate-limit exhaustion; and a forged session.

### 7.4 Autonomous penetration testing

The open-source agent **Strix** (`usestrix/strix`) attacks a running app in a Docker sandbox and reports proven findings.
Use it on your own apps only, with the owner's written go-ahead, because it needs Docker and an LLM API key and sends
target content to that provider.

1. Start the app locally with throw-away data and a throw-away account.
2. `curl -sSL https://strix.ai/install | bash` (read the script first), then
   `export STRIX_LLM="<provider/model>"` and `export LLM_API_KEY="<key>"`.
3. `strix --target ./<app-folder>` for a white-box run, or `strix --target http://localhost:<port>` for a black-box run.
4. Read `strix_runs/<run>`; fix confirmed findings; add an attack test for each; rerun. Keep `strix_runs/` out of git.

If Docker or a key is missing, say so, run 7.3 instead, and record that Strix did not run.

### 7.5 Browser and device proof

- TEST-10 UI work is verified in a real browser at 320, 390, 768, 1024 and 1440 px, in light and dark, with the keyboard,
  and with reduced motion on. Save screenshots. When a design is approved, compare against the approved screenshots and
  report the pixel difference; an unexplained difference is a regression.
- TEST-11 Media features are proved by playing real media and reading the playback state, not by a clean build.
- TEST-12 Mobile features run on an emulator or device from a release build with the development server stopped.
- TEST-13 Do not run two browser test scripts at once on the same debugging port. Delete the accounts a test created.

## 8. Documentation (DOC)

Every repository keeps, current: `README.md` (what it is, commands, ports), `system_design.md` (architecture, decisions,
design record), `FEATURE_LOG.md` (one dated entry per change: what changed, why, files, checks run), `OPERATIONS.md`
(deploy, backup, monitoring), `VALIDATION.md` (evidence and known limits), `.env.example`, and licence notices for
bundled third-party assets. Docs never promise what the code does not do. Do not paste secrets or private paths.

## 9. Git and secrets hygiene (GIT)

- GIT-01 `.gitignore` covers `.env*` (except the example), build output, logs, databases, keystores, caches, local
  tooling and media. Scratch and audit files go in a scratch folder outside the repository or under an ignored path.
- GIT-02 Never commit a secret, a database, private media or personal data. If one is committed, rotate it.
- GIT-03 Commits are small and describe the change in the imperative. Do not commit unless asked. End commit messages
  with the attribution line the environment requires.
- GIT-04 Never rewrite shared history or force-push without an explicit request.

## 10. Bootstrapping a new app (NEW)

1. Create the repository and copy this file in. Replace Part 2 with: purpose, users, the first three journeys, the data
   it stores, the ports it uses, and whether it needs accounts.
2. Write the design record in `system_design.md` (UI-01) before any component. Choose tokens, fonts, icons, radius scale,
   motion springs and voice. Measure contrast.
3. Scaffold the structure in Section 5, `package.json` with the commands in 7.2, `tsconfig`, `biome.json`, `.oxlintrc.json`,
   `.gitignore`, `.env.example`, `README.md`.
4. Build the backend skeleton first: `config`, `createApp`, security headers, request id, rate limit, compression, error
   handler, health route, static serving with cache policy, graceful shutdown. Add its attack tests.
5. Build the frontend shell: routes, theme tokens, motion tokens, self-hosted fonts, the API client with cache, the
   privacy and terms pages, the not-found page, loading and error states, the skip link.
6. Build features one journey at a time. After each: typecheck, lint, tests, a browser check, a change-log entry.
7. Run the full gate: all commands in 7.2, the attack tests, a production build, the budgets, screenshots, and the secret
   scan. Fill `VALIDATION.md`. Offer the Strix run (7.4).
8. Report what was built, what was verified, what could not be verified, and what needs the owner's decision.

## 11. Agent files

- The root `AGENTS.md` is the only place rules are written. Other agent files (GitHub Copilot instructions, Codex agent
  definitions, `CLAUDE.md`, Cursor rules) are one-paragraph pointers that name this file and add nothing.
- A project-specific agent definition may restrict tools or set a role, but it must not restate or relax a rule.
- When a rule changes, change it here once and update the portfolio's other repositories to the same Part 1.

## 12. Definition of done

A change is done when: it does what was asked and nothing else; the approved design is unchanged unless the owner asked;
typecheck, lint, format, tests and build pass (or the exception is stated); the security rows that the change touches are
proved; the budgets hold; a browser or device check was run for UI changes; the change log, design record and any
affected docs are updated; and the final report lists what was and was not verified.

---

---

# Part 2: Cine Music Wave Mobile (this repository)

## Project at a glance

Cine Music Wave Mobile is a standalone React Native (Expo SDK 58 custom development build, React Native 0.88) Android and iOS app.
The installed app is named **Cine Music Wave**; the repository and folder are **Cine Music Wave Mobile**. It is offline only: no
WebView wrapper, no Study, Markdown or Learning routes, no network. The sibling web app (`Cine Music Wave Web`) is the visual and
behavioural reference.

**The rule that defines this app: it must look and behave like the web app.** Same colours, fonts (DM Sans, DM Mono, Fraunces),
spacing, liquid-glass panes, layouts and breakpoints. The owner approved the design (UI-01), so do not restyle for "native feel".
When changing UI, port the web CSS value for value (`Cine Music Wave Web/src/themes/*.css`, `Entertainment.css`, the feature CSS)
and compare an emulator screenshot with the web at the same width. The deliberate deviations are listed in `SOURCE_REFERENCE.md`.
New motion follows 2.4: `src/design/spring.ts` carries the same three named springs as the web, and `Presence`, `SlidingTabs`
and `useReducedMotion` apply them.

- `src/core`: portable rules vendored from the web with matching tests; no React Native imports.
- `src/data`: SQLite, catalog, session. `src/platform`: native adapters (scanner, permissions, audio engine, artwork).
- `src/design`: tokens, glass, controls, springs. `src/features`: screens (`auth`, `music`, `shell`, `watch`).
- `modules/wave-media` (Kotlin and Swift) and `plugins/` hold custom native work. `android/` and `ios/` are **generated** by
  `expo prebuild` and git-ignored; never hand-edit them.
- `docs/` holds the hand-off documents; `docs/legacy/` holds the retired agent prompts.

Read `docs/MOBILE_REPLICATION_GUIDE.md`, `SOURCE_REFERENCE.md`, `FEATURE_PARITY.md`, `system_design.md` and `FEATURE_LOG.md` before
substantial work. Use `ANDROID_SETUP.md`, `IOS_SETUP.md` and `OPERATIONS.md` for toolchains and procedures.

## Rules specific to this project

- Login: the bottom **Skip Login** button reads "Continue offline as Chendu". One tap selects the device-local profile
  `local-test-chendu` and opens Watch or Music with no credentials, no network request and no server record. This is profile
  selection, not authentication: never set an authenticated flag or fake a session. "Chendu" is only the test profile name;
  branding stays Cine Music Wave. Sign in, providers and Create an account stay disabled with an explanation.
- Skip Login never skips Android or iOS permissions. The app lists only what the OS shows it (MediaStore on Android; picked files
  and folders on iOS) plus files the owner picks by hand. No demo catalog, no remote PC library, no fetch, upload or analytics. The
  release APK carries no INTERNET permission (`plugins/withOffline.js`).
- Return to login stops playback and clears the active profile; it never deletes media or saved collections. Signing in again
  restores the same profile.
- Online accounts, hosting and sync are deferred (`docs/FUTURE_ONLINE_BACKEND_PLAN.md`). Do not invent OAuth, email, token or sync
  contracts. Keep the web app's authentication unchanged.
- SQL is parameterised (`src/data/repository.ts`). Native, picker and parsing input is validated and bounded.
- Keep loading, empty, denied, partial, unavailable, error and success states, safe areas, touch targets, accessibility labels and
  reduced motion. Support landscape and tablets: Music switches layout at 860 dp, Watch at 640 and 1000 dp, as on the web.
- No private media, artwork, paths, hashes or signing keys in Git, screenshots or cloud builds. `fixtures-private/`,
  `validation/` and `artifacts/` are ignored. Do not install Android Studio. Never wipe an AVD.
- Android and iOS status are reported separately. iOS cannot be built or signed on this Windows machine; say so, never imply it.
- Git has deliberately not been initialised here; do not run `git init` or add a remote.

## Commands

Requirements: Node.js 22.13+ and pnpm 11. Do not run install commands in this folder unless dependencies must change. If `pnpm`
offers to remove `node_modules`, answer no and call the tool binaries in `node_modules/.bin` directly.

| Command | Purpose |
|---------|---------|
| `pnpm typecheck`, `pnpm lint`, `pnpm test` | TypeScript, oxlint, and the portable-rules and spring tests |
| `pnpm start` | Metro for the debug build (`adb reverse tcp:8081 tcp:8081`) |
| `pnpm build:android` | Release APK with bundled JavaScript, built in the staging folder `E:\cmwm`; add `-- -Variant debug` for the Metro-loading debug APK |
| `pnpm install:android` | `adb install -r` and launch on `emulator-5554` |
| `node scripts/audit-standards.mjs` | The standards audit (7.2). It is run directly, not as a `package.json` script, because any change to `package.json` makes `build:android` reinstall and regenerate the native project |

The audit's UI-12 warning (no privacy or terms page) does not apply: the app is offline, has no accounts and makes no network
request. Add the pages if a store listing or an online feature ever needs them. There is no formatter (Biome would be a new
dependency, which needs the owner's go-ahead), coverage, Sonar or CodeQL gate; never say one ran. If the project folder is renamed,
update the path stored in `E:\cmwm\.cmw-mobile-stage`, or `build:android` refuses the staging folder. The emulator is `CineMusicWave_TestPhone`
(`emulator -avd CineMusicWave_TestPhone`). It is shared and holds other apps' media; after display-size tests run
`wm size reset` and `wm density reset`, and turn airplane mode back off. From Git Bash set `MSYS_NO_PATHCONV=1` before `adb`.

## Validation and documentation

Run the focused checks and record commands and exit codes in `VALIDATION.md`. Permission, scanning, playback, background and
lifecycle behaviour needs the emulator or a device; web test totals are not mobile evidence. Never label an unexecuted test as
passed. Keep `FEATURE_PARITY.md` current so no web capability silently disappears.

## Project agents

There are none beyond this file. `CLAUDE.md` and any other agent file only point here (Section 11). The earlier hand-off prompts
(`MOBILE_AGENTS_TEMPLATE.md`, `MOBILE_AGENT_PROMPT.md`) are kept for history in `docs/legacy/`.
