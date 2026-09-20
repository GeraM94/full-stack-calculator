# Refactor Plan — Calculator (Go backend + React/TypeScript frontend)

Goal: take the existing calculator application and bring it to the architecture we
agreed on: one well-defended boundary between pure logic and transport, on both
layers, with table-driven tests, a single documented API, Docker, and a README that
explains the decisions. Nothing more.

## How to use this plan

- Work **phase by phase, in order**. Phase 0 is mandatory and read-only — do not
  change code until it is done.
- Every phase ends with a **Gate**. If the gate fails, stay in the phase.
- **Commit after each phase** with a message that names the phase.
- Every time an AI tool is used, paste the prompt into `PROMPTS.md` immediately
  (assignment deliverable #5). Do not reconstruct it later.
- If executing with Claude Code or another agent: run **one phase per session**,
  review the diff, then start the next. Appendix C has the prompt.
- Scope guard: if a step is tempting you to add something the assignment did not
  ask for, write it in the README under "What I'd do with more time" instead.

Time budget for an existing application, about 3 to 4 hours total:
Phase 0 about 30 minutes · Phases 1–2 about 60 minutes · Phases 3–4 about
70 minutes · Phase 5 about 20 minutes · Phases 6–7 about 40 minutes.

## Naming convention — applies to every identifier written or touched during this refactor

**Rule 1 — English only.** The current code base uses Spanish identifiers. Every
variable, parameter, function, method, type, struct field, JSON field, file, folder,
CSS class, test name, and code comment is translated to English. Reviewers at the
company read English; a mixed code base reads as unfinished.

| Spanish (current) | English (target) |
|---|---|
| `sumar`, `restar`, `multiplicar`, `dividir` | `add`, `subtract`, `multiply`, `divide` |
| `raizCuadrada`, `potencia`, `porcentaje` | `squareRoot`, `power`, `percentage` |
| `operacion`, `operaciones` | `operation`, `operations` |
| `operando`, `operandos` | `operand`, `operands` |
| `resultado` | `result` |
| `valor`, `numero` | `value`, `number` |
| `pantalla` | `display` |
| `boton`, `teclado` | `button`, `keypad` |
| `calculadora` | `calculator` |
| `manejador`, `controlador` | `handler` |
| `solicitud`, `respuesta` | `request`, `response` |
| `mensaje`, `codigo` | `message`, `code` |
| `cargando`, `estado` | `loading`, `state` / `status` |
| `limpiar`, `borrar` | `clear`, `delete` |
| `calcular`, `evaluar` | `calculate`, `evaluate` |
| `configuracion`, `puerto`, `entorno` | `configuration`, `port`, `environment` |
| `prueba`, `pruebas` | `test`, `tests` |

Phase 0 produces the complete table for this code base; the rows above are only
the likely ones.

Scope of the translation, decide once and record it in the README:

- **Always translated:** identifiers, JSON field names, file and folder names,
  comments, commit messages, README, test descriptions.
- **Translated too, unless the assignment says otherwise:** user-visible interface
  text (button labels, error messages). The evaluators are English speakers.
- **JSON field names are part of the API contract.** Translating `resultado` →
  `result` is a breaking change; it happens in Phase 2 and the frontend moves with
  it in Phase 3, in the same pull request.

**Rule 2 — Full words, always.** No abbreviations in variables, parameters,
functions, types, files, folders, or JSON fields.

| Write | Never |
|---|---|
| `operation`, `operations` | `op`, `ops` |
| `error` | `e` |
| `request`, `response` | `req`, `res`, `resp` |
| `configuration` | `cfg`, `config`, `conf` |
| `calculator`, `calculation` | `calc` |
| `parameters`, `arguments` | `params`, `args` |
| `value`, `values` | `val`, `vals` |
| `message` | `msg` |
| `button` | `btn` |
| `index` | `idx`, `i` (outside a tiny loop) |
| `number` | `num` |
| `previous`, `current`, `next` | `prev`, `curr`, `nxt` |
| `writer`, `request` (handler signature) | `w`, `r` |
| `environment` | `env` (in prose and names you control) |
| `utilities` | `utils`, `lib`, `helpers` |
| `documentation` (in prose) | `docs` (except the folder, see below) |

**Allowed: universally known acronyms**, in their standard casing —
`HTTP`, `JSON`, `API`, `URL`, `CORS`, `CSS`, `HTML`, `SQL`. In Go: `httpapi`,
`baseURL`. In TypeScript: `ApiError`, `baseUrl`.

**Allowed: established Go idioms** a Go reviewer expects — changing them would look
wrong, not clean:

- the `cmd/` directory (Go project convention)
- the `err` variable for a returned error
- the `Err` prefix on sentinel errors (`ErrDivisionByZero`)
- `ctx` for a `context.Context` (the full word collides with the package name)
- `t` for a `*testing.T` in test functions (added after Phase 0, finding F9)

**Allowed: ecosystem paths and names you do not control** — `src/`, `docs/`,
`dist/`, `go.mod`, `import.meta.env`, `node_modules/`.

**Gate checks before every commit** (every grep in this section must print
nothing; ignore `node_modules/` and third-party code). Wherever a gate below
says "both naming greps", it means all four:

Abbreviations:

```
grep -rnE '\b(op|ops|req|res|resp|cfg|calc|params|args|val|msg|btn|idx|num|prev|curr|utils)\b' \
  --include='*.go' --include='*.ts' --include='*.tsx' backend/ frontend/src/
```

Spanish identifiers — accented characters, `ñ`, and the words from the Phase 0
rename table (extend the list with what 0.2 and 0.3 find). Keep the
`LC_ALL=C.UTF-8` prefix: without a UTF-8 locale `grep` compares bytes, and
`±`, `×`, and `÷` — legitimate keypad symbols — share bytes with the accented
vowels and are reported as false positives (found in Phase 1). `restar` has its
own alternative so that the English `restart` does not match (found in
Phase 7, in `docker-compose.yml`):

```
LC_ALL=C.UTF-8 grep -rnEi '[áéíóúñ]|\b(sumar|multiplicar|dividir|operacion|operando|resultado|valor|numero|pantalla|boton|teclado|calculadora|manejador|solicitud|respuesta|mensaje|codigo|cargando|estado|limpiar|calcular|evaluar|configuracion|puerto|prueba)\w*|\brestar([a-su-z]\w*)?\b' \
  --include='*.go' --include='*.ts' --include='*.tsx' --include='*.css' backend/ frontend/src/
```

Spanish identifiers, extended — the words Phase 0 found in this code base that
the list above misses (`docs/ANALYSIS.md`, finding F8). `pie`, `borde`, and
`indice` match as whole words only: with `\w*` they would also match the
English `piece`, `border`, and `indices` (found in Phase 3):

```
grep -rnEi '\b(peticion|entrada|acumulador|reiniciar|pulsar|digito|simbolo|formatear|tecla|fila|clase|etiqueta|desactivad|cabecera|flecha|fondo|texto|tenue|borrar|cambiar|signo|casos|nombre|esperado|obtenido|siguiente|inicio|inicial|servidor|direccion|escribir|registrar|cuerpo|contenedor|evento|expresion|activo|funcion|operador|cero|igual|ejemplo)\w*|\b(pie|borde|indice)\b|hay-error' \
  --include='*.go' --include='*.ts' --include='*.tsx' --include='*.css' --include='go.mod' backend/ frontend/src/
```

Single-letter identifiers — invisible to the abbreviation grep (finding F9;
`t *testing.T` is an allowed idiom and is not matched):

```
grep -nE '\b[a-z] (http\.ResponseWriter|\*http\.Request)|\bvar [a-z] |for _, [a-z] :=|\b[a-z], [a-z] +float64' $(find backend -name '*.go')
grep -rnE '\(\(?[a-z]\)? *=>|\(\(?[a-z]: |\b[a-z]: (number|string)' --include='*.ts' --include='*.tsx' frontend/src/
```

---

## Phase 0 — Analyze the current code (read-only)

Output: `docs/ANALYSIS.md` containing everything below. No code changes in this phase.

### 0.1 Map the repository

- [x] Print the tree (depth 3, ignoring `node_modules`, `.git`, `dist`, `vendor`).
- [x] Identify the backend root and the frontend root. Note whether they are one
      repository or two, and whether there is any existing `Makefile`,
      `docker-compose.yml`, or continuous-integration file.

### 0.2 Backend inventory

- [x] Go version from `go.mod`; list of dependencies (router? framework? none?).
- [x] Where do HTTP handlers live? File and function names.
- [x] Where does the arithmetic live? Inside handlers, in a separate package, or
      duplicated?
- [x] Does any package that does arithmetic import `net/http` or `encoding/json`?
      (This is the main smell we are fixing.)
- [x] How are errors handled today? Strings? `fmt.Errorf`? Sentinel errors? Which
      status codes are returned, and for which cases?
- [x] How is the port and other configuration read? Hardcoded, flag, environment
      variable?
- [x] Existing tests: which files, what they cover, whether they pass. Record
      `go test ./... -cover` output verbatim.
- [x] `go vet ./...` and `gofmt -l .` output.
- [x] Build the **rename table** for the backend: every Spanish or abbreviated
      identifier (variables, functions, types, struct fields, JSON tags, file
      names) with its English full-word replacement. Save it in `ANALYSIS.md`;
      Phases 1–2 apply it and the gate grep is extended with it.

### 0.3 Frontend inventory

- [x] TypeScript or JavaScript? Is `strict` on in `tsconfig.json`?
- [x] Build tool (Vite / Create React App / Next / other) and React version.
- [x] State management currently used: `useState` scattered, `useReducer`, Context,
      Redux, Zustand, other. List every file that holds calculator state.
- [x] Where are `fetch` / `axios` calls? How many files know the backend URL?
- [x] Component list with one line each: what it renders, what state it owns.
- [x] Existing tests: runner (Vitest / Jest), files, whether they pass, coverage output.
- [x] Styling approach (CSS modules, Tailwind, plain CSS, styled-components).
- [x] Any responsive handling today? Any loading or error interface?
- [x] Build the **rename table** for the frontend: every Spanish or abbreviated
      identifier (components, props, state fields, hooks, functions, CSS
      classes, file names) with its English full-word replacement. Also list
      user-visible Spanish strings (labels, error messages) separately — they
      are translated in Phase 3 unless you decide otherwise in 0.7.

### 0.4 Current API contract

- [x] List every endpoint: method, path, request body, success response, error
      response.
- [x] Capture one real `curl` per endpoint and paste the output.
- [x] Note inconsistencies (different error shapes, mixed status codes, unary
      operations squeezed into binary shapes, and so on).
- [x] List every Spanish JSON field name (for example `resultado`, `operacion`,
      `operandos`). These change in Phase 2 and the frontend types change with
      them in Phase 3.

### 0.5 Baseline

- [x] Both applications build and run locally. Record the exact commands that worked.
- [x] Record baseline numbers: backend coverage %, frontend coverage %, number of
      tests.
- [x] `git tag pre-refactor` so the starting point is recoverable.

### 0.6 Gap analysis

Fill this table. It becomes the checklist for the rest of the plan and later feeds
the README "Design decisions" section.

| Target | Current state | Action | Phase |
|---|---|---|---|
| Arithmetic in a package with no HTTP or JSON imports | | | 1 |
| Sentinel errors, mapped to status codes in the transport layer only | | | 1–2 |
| Operations table (`map[string]Operation`) instead of a growing `switch` | | | 1 |
| Table-driven tests for the domain, about 100% on that package | | | 1 |
| Single `POST /api/v1/calculate` endpoint with a stable error envelope | | | 2 |
| Input validation: unknown operation, operand count, non-finite numbers, malformed JSON | | | 2 |
| `main.go` does wiring only; configuration from environment variables | | | 2 |
| Handler tests with `httptest` | | | 2 |
| Frontend: one API client module, injected into the hook | | | 3 |
| Frontend: `useReducer` state machine in `useCalculator` | | | 3 |
| Frontend: loading and error states visible; keys disabled while loading | | | 3 |
| Responsive keypad, touch targets of at least 44 px | | | 3 |
| Reducer tests (table-driven) + hook test with a fake client + 1–2 interface integration tests | | | 4 |
| Coverage report for both layers | | | 4 |
| Dockerfiles + `docker-compose.yml` | | | 5 |
| README: setup, run, API examples, design decisions, assumptions | | | 6 |
| `PROMPTS.md` | | | 6 |
| All identifiers in English, full words (Naming convention) | | | 1–3 |
| All JSON field names in English | | | 2–3 |
| Comments, test names, interface text in English | | | 1–3 |

### 0.7 Refactor strategy decision

- [x] **Extract, don't rewrite.** If the arithmetic is small (under about 100 lines)
      and tangled with HTTP, move it out. Do not rebuild the backend from zero.
- [x] If the frontend uses Redux (or similar) for a single screen: plan its removal
      in Phase 3 and record the reason in the README. If it uses scattered
      `useState`, plan the consolidation into one reducer.
- [x] Decide whether existing endpoints must survive during the migration. Default:
      no — the frontend is in the same repository and moves in the same change.
- [x] Decide the scope of the Spanish → English translation: identifiers and JSON
      fields are always translated; confirm whether user-visible interface text
      is translated too (default: yes). Record the decision for the README.
- [x] Translation technique: rename with the editor's rename-symbol tool
      (`gopls` / TypeScript language server), one identifier at a time, running
      tests after each batch. Do not use global find-and-replace on plain text —
      `valor` also matches inside `evaluar`.

**Gate 0:** `docs/ANALYSIS.md` written · baseline numbers recorded · `pre-refactor`
tag exists · gap table filled · rename tables (backend and frontend) complete ·
translation scope decided.

---

## Phase 1 — Backend: extract the domain

Target layout (create what is missing, move what exists):

```
backend/
├── cmd/server/main.go
├── internal/
│   ├── calculator/
│   │   ├── calculator.go
│   │   ├── errors.go
│   │   └── calculator_test.go
│   └── httpapi/            (Phase 2)
├── go.mod
└── Dockerfile              (Phase 5)
```

### Steps

- [x] 1.1 Create `internal/calculator/`. Move every pure arithmetic function into it.
- [x] 1.2 Define sentinel errors in `errors.go`:
      `ErrUnknownOperation`, `ErrDivisionByZero`, `ErrNegativeSquareRoot`,
      `ErrInvalidOperandCount`, `ErrNonFiniteResult`.
- [x] 1.3 Replace any `switch operation` with an operations table:
      `map[string]Operation`, where `Operation` carries `Arity` and `Apply`.
      Public entry point:
      `Compute(operation string, operands []float64) (float64, error)`.
- [x] 1.4 Validate inside the domain: known operation, operand count matches
      arity, result is finite (`math.IsNaN`, `math.IsInf`) — return
      `ErrNonFiniteResult` instead of letting a `NaN` reach JSON, where
      `encoding/json` fails on it.
- 1.5 **Deferred — do not build.** `Operations() []string` lost its only
      consumer when `GET /api/v1/operations` was deferred (Appendix D).
- [x] 1.6 Write table-driven tests: every operation's happy path, division by
      zero, square root of a negative number, wrong operand count, unknown
      operation, overflow (`1e308 * 10`), documented float-precision cases
      (`0.1 + 0.2`), percentage semantics.
- [x] 1.7 Delete the old arithmetic code from wherever it lived. Do not leave two
      copies.
- [x] 1.8 Apply the backend rename table to this package: every Spanish or
      abbreviated identifier becomes its English full-word name, including
      comments and test names. Use rename-symbol, not text replace.

**Gate 1:**
- `go test ./internal/calculator/ -cover` green, coverage at least 95%.
- `go list -deps ./internal/calculator/ | grep -E 'net/http|encoding/json'` returns
  nothing.
- `gofmt -l .` empty · `go vet ./...` clean · both naming greps empty for this
  package.
- Commit: `refactor(backend): extract calculator domain package`.

---

## Phase 2 — Backend: transport layer

### Steps

- [x] 2.1 Create `internal/httpapi/`. Declare the interface **here**, in the
      consuming package:
      ```go
      type Calculator interface {
          Compute(operation string, operands []float64) (float64, error)
      }
      ```
- [x] 2.2 Implement `POST /api/v1/calculate`.
      Request: `{"operation":"divide","operands":[10,2]}`.
      Success: `{"result":5}`.
      Error: `{"error":{"code":"DIVISION_BY_ZERO","message":"cannot divide by zero"}}`.
      Add `GET /health` (used by the Docker health check in 5.3).
      `GET /api/v1/operations` is deferred (Appendix D).
- [x] 2.3 If `ANALYSIS.md` found per-operation endpoints: remove them and migrate
      the frontend in Phase 3. Record the decision (and the rejected alternative)
      for the README.
- [x] 2.4 Validation in the handler: malformed JSON → 400 `INVALID_JSON`; wrong
      method → 405; empty or oversized body handled; unknown fields rejected
      (`DisallowUnknownFields`).
- [x] 2.5 Error mapping in one function: `errors.Is(err, calculator.ErrX)` →
      `(status, code)`. Domain errors → 400 or 422. Anything else → 500 with a
      generic message; the real error is logged, never leaked.
- [x] 2.6 Middleware: recover, request logging. No CORS middleware — deferred
      (Appendix D): the browser never calls the API cross-origin, because Vite
      proxies `/api` in development and nginx proxies it in Docker. Use the
      standard library `net/http` (`ServeMux` with method patterns) or keep the
      router the application already has. Do not add a framework if there
      isn't one.
- [x] 2.7 `cmd/server/main.go`: read `PORT` from an environment variable with a
      default, construct the calculator, build the router, `http.Server` with
      timeouts, graceful shutdown on interrupt and terminate signals. Nothing
      else.
      One addition for Docker (step 5.1), in its own file
      `cmd/server/healthcheck.go` so `main.go` stays wiring: when the first
      argument is `healthcheck`, `runHealthCheck(port)` requests
      `http://127.0.0.1:<port>/health` with a short timeout and the process
      exits 0 or 1. The distroless image has no shell and no `wget`, so the
      binary checks itself.
- [x] 2.8 Tests with `httptest`: one happy path per operation, each error code,
      malformed JSON, unknown field, wrong method, health.
      Use a fake `Calculator` in at least one test to prove the interface seam.
      `runHealthCheck`: returns 0 against a healthy `httptest` server, 1 against
      a failing one and against a closed port.
- [x] 2.9 Handler signatures use `writer http.ResponseWriter, request *http.Request`.
      Request and response structs are named `CalculateRequest`,
      `CalculateResponse`, `ErrorResponse`.
- [x] 2.10 Apply the backend rename table to the rest of the backend, including
      JSON tags (`json:"resultado"` → `json:"result"`), log messages, and
      `main.go`. From this commit on, the API speaks English only.

**Gate 2:**
- `go test ./... -coverprofile=coverage.out && go tool cover -func=coverage.out`
  green.
- The `curl` examples that will go in the README all work against the running
  server.
- Both naming greps empty for `backend/`.
- Commit: `refactor(backend): thin http layer over calculator domain`.

---

## Phase 3 — Frontend: API boundary and state machine

Target layout:

```
frontend/src/
├── api/
│   ├── client.ts        # the only file that knows the URL and calls fetch
│   └── types.ts         # mirrors the Go request and response structs exactly
├── components/
│   ├── Display.tsx
│   ├── Keypad.tsx
│   └── Button.tsx
├── hooks/
│   └── useCalculator.ts # reducer + side effect; client injected
├── utilities/
│   └── formatNumber.ts
└── App.tsx
```

### Steps

- [x] 3.1 `api/types.ts`: `Operation` union, `CalculateRequest`,
      `CalculateResponse`, `ApiError`. Keep names identical to the Go JSON tags.
- [x] 3.2 `api/client.ts`: export a `CalculatorClient` interface and
      `createHttpClient(baseUrl)`. Base URL from `import.meta.env.VITE_API_URL`
      (or the project's equivalent). Map non-2xx into a typed `ApiError`.
      Grep the codebase afterward: no other file may contain `fetch(` or the URL.
- [x] 3.3 `hooks/useCalculator.ts`: `useReducer` with explicit `State` and
      `Action` types. Client passed as a parameter. Document the transition
      table in a comment at the top of the file:
      - `DIGIT` after a result → starts a new number (overwrite)
      - second `.` in the same number → ignored
      - `OPERATION` pressed twice → replaces the pending operation
      - `OPERATION` when an operation is already pending and a second operand
        exists → evaluate first, then set the new operation (chaining)
      - `EVALUATE` with nothing pending → no-op
      - `EVALUATE` repeatedly → no-op (do not re-apply the last operation)
      - `FAILURE` → show the message, keep the display, clear the pending operation
      - `CLEAR` → initial state
      Inside the hook: `catch (error)` → `dispatch({ type: 'FAILURE', message: toErrorMessage(error) })`.
- [x] 3.4 Migrate existing components to consume the hook. Remove scattered
      `useState` and `fetch`. If Redux, Zustand, or Context exists for this
      state, remove it and note why in the README.
- [x] 3.5 Components: `Display` (value, error, loading), `Keypad` (grid of
      `Button`s), `Button` (accessible, `aria-label`, keyboard focus).
      Disable keys while `status === 'loading'`.
- [x] 3.6 Client-side input validation: block a second decimal point, block
      leading zeros, cap display length (for example, 16 characters), map
      keyboard keys to actions. The server remains the source of truth for
      correctness.
- [x] 3.7 Responsive: CSS grid keypad, targets of at least 44 px, one breakpoint,
      works at 360 px wide. No new interface library.
- [x] 3.8 Advanced operations (if the backend exposes them): `x^y`, `√`, `%` as
      keys, with `√` treated as unary (evaluates immediately on the current
      display).
- [x] 3.9 Apply the frontend rename table: components, props, state fields,
      hooks, handler names, CSS classes, and file names become English full
      words. Update `api/types.ts` to the English JSON field names from 2.10 at
      the same time — the compiler will point at every use site.
- [x] 3.10 Translate user-visible text (button labels, error messages, page
      title) to English, per the decision in 0.7. Keep the strings in one place
      (a `messages.ts` object) so the translation is reviewable in a single file.

**Gate 3:**
- `tsc --noEmit` clean · lint clean · both naming greps empty for
  `frontend/src/`.
- Application works end to end against the Phase 2 backend, including an error
  case (÷ 0) and a network failure (backend stopped → visible error, interface
  recovers).
- Commit: `refactor(frontend): reducer state machine and single api client`.

---

## Phase 4 — Frontend tests

- [x] 4.1 Reducer tests: table-driven `(before, action, after)` for every
      transition in the 3.3 list, plus the tricky sequences
      (`5 + × 3 =`, `2 + 3 = = =`, digit after result, error then digit).
- [x] 4.2 Hook test with a fake `CalculatorClient`: the success path sets the
      result, a rejection sets the error, `loading` toggles correctly.
- [x] 4.3 Integration tests with Testing Library + MSW: "2 + 3 = 5",
      "10 ÷ 0 shows error", "keys disabled while loading".
- [x] 4.4 Coverage: `vitest run --coverage` (or the project's runner). Save the
      summary for the README.

**Gate 4:** green · coverage report generated · commit
`test(frontend): reducer, hook and integration tests`.

---

## Phase 5 — Docker

- [x] 5.1 `backend/Dockerfile`: multi-stage — `golang:<version>` build with
      `CGO_ENABLED=0`, final stage `gcr.io/distroless/static`, `nonroot`
      variant (confirm the exact tag when writing the file), `EXPOSE` the port,
      `ENTRYPOINT ["/server"]`. No shell, no package manager, non-root user
      built in.
- [x] 5.2 `frontend/Dockerfile`: multi-stage — `node` build, final `nginx:alpine`
      serving `dist/`, `nginx.conf.template` proxying `/api/` to the backend service so
      the browser talks to one origin (no CORS in Docker). Not distroless:
      static files need a web server, and there is no official distroless
      nginx image.
- [x] 5.3 `docker-compose.yml`: two services, one network, environment variable
      for the port. Health checks: backend `["CMD", "/server", "healthcheck"]`
      (step 2.7); frontend `wget` against nginx, which `nginx:alpine` includes.
- [x] 5.4 `.dockerignore` in both.

**Gate 5:** from a **fresh clone**, `docker compose up --build` works and the
calculator runs in the browser. Commit `chore: dockerize frontend and backend`.

---

## Phase 6 — Documentation

- [x] 6.1 `README.md` sections, in this order:
      1. What it is (2 lines) + screenshot or GIF
      2. Architecture — ASCII diagram of the two boundaries
         (`interface → hook → client → HTTP → handler → domain`)
      3. Prerequisites
      4. Run locally — backend, frontend (exact commands, ports)
      5. Run with Docker
      6. API reference — each endpoint with a `curl` and its JSON, plus the error
         envelope and the full error-code table
      7. Testing — commands for both layers + coverage numbers table
      8. Design decisions — use the template in Appendix A; include the rejected
         alternatives (per-operation endpoints, Redux, framework, hexagonal
         layering)
      9. Assumptions (float64 semantics, percentage definition, precision)
      10. What I'd do with more time — start from Appendix D
- [x] 6.2 `PROMPTS.md`: chronological, unedited, grouped by phase.
- [x] 6.3 Coverage report (deliverable #3): add a `make coverage` (or npm / Go
      script) target that regenerates both reports, commit the summary table to
      the README, and commit the HTML reports under `docs/coverage/` or link to
      continuous integration.
- [x] 6.4 Delete `docs/ANALYSIS.md` or keep it as `docs/BEFORE.md` — either is
      fine; if kept, mention it in the design-decisions section as evidence.

**Gate 6:** a stranger can clone and run from the README alone. Test this
literally: fresh clone into a temporary directory, follow only the README.

---

## Phase 7 — Final review

- [x] 7.1 Read the whole diff `pre-refactor..HEAD` as a reviewer: dead code,
      `console.log`, commented-out blocks, TODOs, unused dependencies, leftover
      files, any abbreviation or Spanish word that slipped through (run both
      naming greps over the whole repository one last time, including `*.md`,
      `*.yml`, `*.json`, and `*.css`).
- [x] 7.2 Walk the assignment line by line (functional, non-functional,
      constraints, deliverables, instructions) and tick each one against the
      repository.
- [x] 7.3 Confirm `PROMPTS.md` is complete.
- [ ] 7.4 Tag `v1.0`, push, share the link.
      Tagged locally at the end of Phase 7. **Still open: push and share.** The
      repository has no remote; creating one and publishing is the owner's
      step — `git remote add origin <url>`, then
      `git push -u origin refactor/architecture --tags`.

---

## Appendix A — Design decisions template

| Decision | Chosen | Alternative considered | Why |
|---|---|---|---|
| API shape | Single `POST /calculate` | Endpoint per operation | Uniform for unary and binary operations; the operation set is data, not routing |
| Domain isolation | `internal/calculator` with no HTTP or JSON imports | Logic inside handlers | Testable with plain `go test`; transport can change independently |
| Error handling | Sentinel errors, mapped to HTTP in the transport layer | Error strings or status codes in the domain | The domain never knows what 400 means |
| Extensibility | Operations table | `switch` | Adding an operation touches one line |
| Router | Standard library `net/http` | Gin / Echo / Fiber | No need justified by the problem size |
| Frontend state | `useReducer` in one hook | Redux / Zustand / scattered `useState` | A calculator is a state machine; single screen, no shared state |
| API access | One injected client | `fetch` in components | One seam to mock; mirrors dependency inversion on the backend |
| Layering depth | Two layers per side | Hexagonal / clean-architecture folders | Proportional to a 4-hour calculator |
| Backend image | `distroless/static`, non-root; the binary performs its own health check | `alpine` with `wget` | The Go binary is static and needs nothing from the system; no shell or package manager in the image. Cost: a 12-line `healthcheck` subcommand |
| Frontend image | `nginx:alpine` | A distroless image | Static files need a web server; there is no official distroless nginx, and a hand-written Go file server plus reverse proxy would duplicate nginx |
| Container layout | Two containers under `docker compose`: nginx (static files and the `/api/` proxy) and the Go API | One image where the Go binary also serves `dist/`; one container running both processes under a supervisor | A container is a process, not a virtual machine, so the overhead of a second one is negligible. The backend stays a pure API microservice, one process per container, and one command still runs both |
| Naming | English, full words in every identifier and JSON field | Keep the original Spanish names; conventional abbreviations | Reviewers read English; a mixed code base reads as unfinished; full words remove guesswork |

## Appendix B — Error code table (source of truth for both layers)

| Code | HTTP | When |
|---|---|---|
| `INVALID_JSON` | 400 | Body cannot be parsed or has unknown fields |
| `UNKNOWN_OPERATION` | 400 | `operation` not in the table |
| `INVALID_OPERAND_COUNT` | 400 | Arity mismatch |
| `DIVISION_BY_ZERO` | 422 | `divide` with divisor 0 |
| `NEGATIVE_SQUARE_ROOT` | 422 | `squareRoot` of a negative number |
| `NON_FINITE_RESULT` | 422 | Result is NaN or ±Inf (overflow) |
| `REQUEST_TOO_LARGE` | 413 | Body over 4096 bytes (added in Phase 2) |
| `METHOD_NOT_ALLOWED` | 405 | Known path, wrong method; the `Allow` header names the right one (added in Phase 2) |
| `NOT_FOUND` | 404 | Unknown path (added in Phase 2) |
| `INTERNAL_ERROR` | 500 | Anything unexpected; details logged, not returned |

The last three additions exist so that every response of the API, not only
those of the calculate handler, uses the same error envelope.

## Appendix C — Prompt for running this plan with an agent

```
Read REFACTOR_PLAN.md in full, including the Naming convention section. The
code base currently uses Spanish identifiers; they will all be translated to
English full words. Execute ONLY Phase 0. Do not modify any source file. Write
your findings to docs/ANALYSIS.md following the structure in the plan, including
the filled gap-analysis table, the backend and frontend rename tables (Spanish or
abbreviated identifier → English full-word name), the list of Spanish JSON field
names, and the strategy decision in 0.7. When Gate 0 is satisfied, stop and
summarize what you found in five lines.
```

Then, per phase:

```
Read REFACTOR_PLAN.md and docs/ANALYSIS.md. Execute Phase N only. Apply the
Naming convention and the rename tables to every identifier you write or touch:
English, full words, no abbreviations. Use rename-symbol, never plain text
replace. Respect the scope guard. When Gate N passes (including both naming
greps), commit with the message given in the plan, show me the diff summary,
and stop.
```

## Appendix D — Scope, checked against the assignment (2026-09-19)

Rule applied: what the assignment lists is built, including what it marks
optional. What the assignment never mentions and the current application does
not have is deferred, and goes into the README under "What I'd do with more
time" — with one exception, graceful shutdown, kept by decision.

| Item | In the assignment? | Decision |
|---|---|---|
| Exponentiation, square root, percentage | Yes — optional | **Build** (Phase 1, step 3.8) |
| Dockerfile for full-stack deployment | Yes — optional | **Build** (Phase 5) |
| `GET /health` | No | **Build** — the Docker health check uses it |
| `healthcheck` subcommand in the server binary | No | **Build** (step 2.7) — the distroless backend image has no `wget` to call `/health` with |
| Operation chaining, keyboard mapping | No ("intuitive UI") | **Keep** — the application already has them; removing them would be a regression |
| `GET /api/v1/operations` and `Operations()` | No | **Deferred** — no consumer; the frontend's `Operation` union is fixed in TypeScript |
| CORS middleware, `ALLOWED_ORIGIN`, preflight test | No | **Deferred** — never exercised: Vite proxies `/api` in development, nginx in Docker |
| Graceful shutdown on interrupt and terminate signals | No | **Build** (step 2.7) — about 15 lines, idiomatic for a Go server, and `docker compose down` stops the container with a terminate signal |
