# Analysis — state of the code base before the refactor (Phase 0)

Read-only analysis of commit `1b273e2` (tagged `pre-refactor`), taken on
2026-09-19. No source file was modified. Everything below was read from the
code or measured by running a command; where something was *not* verified, it
says so.

Contents: 0.1 repository map · 0.2 backend · 0.3 frontend · 0.4 API contract ·
0.5 baseline · 0.6 gap analysis · 0.7 strategy decisions · findings that adjust
the plan · extended naming greps · Gate 0 checklist.

---

## 0.1 Repository map

```
calculadora/                      one git repository, branch main, no remote
├── .gitignore
├── README.md                     Spanish
├── backend/
│   ├── go.mod
│   ├── main.go                   169 lines: contract + arithmetic + handler + server
│   ├── calculadora_test.go       56 lines
│   └── calculadora.exe           build output, ignored by git (*.exe)
└── frontend/
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── dist/                     build output, ignored
    ├── node_modules/             ignored
    └── src/
        ├── App.tsx               138 lines
        ├── api.ts                53 lines
        ├── main.tsx              18 lines
        ├── styles.css            186 lines
        ├── useCalculadora.ts     174 lines
        └── vite-env.d.ts
```

- **One repository**, two roots: `backend/` and `frontend/`.
- **Not present:** `Makefile`, `docker-compose.yml`, any `Dockerfile`,
  `.dockerignore`, continuous-integration file, `.gitattributes`, `docs/`,
  `PROMPTS.md`, `.env` files, lint configuration, frontend test configuration.
- **Not in the repository:** `REFACTOR_PLAN.md` and the assignment text. The
  per-phase prompts say "Read REFACTOR_PLAN.md", so the plan has to be added to
  the repository root before Phase 1. Step 7.2 (walk the assignment line by
  line) needs the assignment text.
- History — 4 commits, messages in Spanish:

  | Commit | Message (translated) | Relevance |
  |---|---|---|
  | `6fb5b17` | initial version with `useState` | |
  | `fcd23f4` | `useState` → `useReducer` | complete reducer + effect implementation of the hook |
  | `b20a232` | `useReducer` → Redux Toolkit | `store/calculadoraSlice.ts`, `store/store.ts` |
  | `1b273e2` | revert to `useState`, remove `useReducer` and Redux Toolkit | **HEAD**, tagged `pre-refactor` |

  `package.json` and `package-lock.json` contain no Redux leftovers (0 matches
  for `redux|zustand|immer` in the lock file).

---

## 0.2 Backend inventory

| Question | Finding |
|---|---|
| Go version | `go 1.27` in `go.mod`; toolchain installed: `go1.27.0 windows/amd64` |
| Module path | `ejemplo/calculadora` (Spanish) |
| Dependencies | **None.** `go list -m all` prints only the module itself. The router is the standard library `http.ServeMux` with method patterns (`"POST /api/calcular"`) |
| Packages | One: `package main`. One source file, one test file |
| HTTP handlers | `manejarCalculo` (`main.go:77`), middleware `registrarPeticiones` (`main.go:163`), response helpers `escribirJSON` (`main.go:107`) and `escribirError` (`main.go:117`), static `http.FileServer` mounted on `/` (`main.go:146`) |
| Arithmetic | `calcular(a, b float64, operacion string) (float64, error)` at `main.go:54-71` — 18 lines, a four-case `switch`. Not duplicated: the frontend does no arithmetic, it only parses and formats numbers |
| Does the arithmetic package import `net/http` or `encoding/json`? | **Yes** — it is `package main`, which imports both. This is the smell Phase 1 fixes. The function body is already pure (no HTTP type reaches it), so the extraction is a move, not a rewrite |
| Operations supported | `"+"`, `"-"`, `"*"`, `"/"` only. **No** power, square root, or percentage |

### Error handling today

- One sentinel: `ErrDivisionCero = errors.New("no se puede dividir entre cero")`
  (`main.go:50`), compared with `errors.Is` in the test.
- Unknown operation: `fmt.Errorf("operación no soportada: %q", operacion)` — not
  a sentinel, so callers cannot match it.
- Non-finite result: checked **in the handler** (`main.go:94`), not in the
  domain. `calcular(1e308, 10, "*")` returns `+Inf, nil`.
- Every failure returns **400** with `{"error":"<Spanish string>"}`. There is no
  422, no 500 path, no error code, and no `recover` middleware.
- The JSON decoder error is concatenated into the response, which leaks
  internals: `json: cannot unmarshal string into Go struct field Peticion.a of
  type float64`.
- A wrong method never yields 405: the `/` catch-all for static files makes the
  mux hand `GET /api/calcular` to the file server, which answers
  `404 text/plain` (the comment at `main.go:142-145` documents this).
- Not validated: unknown JSON fields (accepted), missing fields (silently `0`),
  body size (no `http.MaxBytesReader`). Trailing data after the JSON value was
  not tested.

### Configuration and server

- Command-line flags, no environment variables: `-puerto` (default `"8080"`)
  and `-web` (default `../frontend/dist`).
- `main` calls `log.Fatalf` when `<web>/index.html` does not exist
  (`main.go:130-133`): the backend **refuses to start without a built
  frontend**. This has to go before Docker (Phase 5), where the backend
  container holds no frontend files.
- `http.Server` sets only `ReadHeaderTimeout: 5s`. No read, write, or idle
  timeout, no graceful shutdown, no signal handling.
- No CORS handling (not needed today: same origin in production mode, Vite
  proxy in development mode).

### Tests

File `backend/calculadora_test.go`, `package main`: `TestCalcular` (table-driven,
6 subtests), `TestCalcularDivisionEntreCero`, `TestCalcularOperacionInvalida`.
No handler tests. All pass.

`go test ./... -cover`, verbatim:

```
ok  	ejemplo/calculadora	0.318s	coverage: 10.1% of statements
```

`go tool cover -func`, verbatim:

```
ejemplo/calculadora/main.go:54:		calcular		100.0%
ejemplo/calculadora/main.go:77:		manejarCalculo		0.0%
ejemplo/calculadora/main.go:107:	escribirJSON		0.0%
ejemplo/calculadora/main.go:117:	escribirError		0.0%
ejemplo/calculadora/main.go:125:	main			0.0%
ejemplo/calculadora/main.go:163:	registrarPeticiones	0.0%
total:					(statements)		10.1%
```

### Static checks

- `go vet ./...` — no output, exit 0.
- `gofmt -l .` — prints **`main.go`**. Cause: the comment at `main.go:34`
  contains a doubled backtick, which `gofmt` rewrites into a typographic quote:

  ```
  -// con `Resultado float64 \`json:"resultado,omitempty"\`` la respuesta de 2-2
  +// con `Resultado float64 \`json:"resultado,omitempty"\“ la respuesta de 2-2
  ```

  Do not run `gofmt -w` on it as is — it would corrupt the comment. The comment
  is rewritten in English in Phase 2; word it without nested backticks.

### Backend rename table

Files, module, configuration:

| Current | Target |
|---|---|
| module `ejemplo/calculadora` | `example/calculator` (use the real repository URL instead if one exists by then) |
| `backend/main.go` | split: `cmd/server/main.go`, `internal/calculator/calculator.go`, `internal/calculator/errors.go`, `internal/httpapi/` |
| `backend/calculadora_test.go` | `internal/calculator/calculator_test.go` |
| flag `-puerto` | environment variable `PORT` |
| flag `-web` | removed together with static file serving (see 0.7) |
| — | new environment variable `ALLOWED_ORIGIN` |

Types, fields, JSON tags:

| Current | Target |
|---|---|
| `Peticion` | `CalculateRequest` |
| `Peticion.A`, `Peticion.B` / `json:"a"`, `json:"b"` | `Operands []float64` / `json:"operands"` |
| `Peticion.Operacion` / `json:"operacion"` | `Operation string` / `json:"operation"` |
| `RespuestaOK` | `CalculateResponse` |
| `RespuestaOK.Resultado` / `json:"resultado"` | `Result float64` / `json:"result"` |
| `RespuestaError` | `ErrorResponse` |
| `RespuestaError.Error string` / `json:"error"` (a string) | `Error ErrorDetail` / `json:"error"` (an object); new `ErrorDetail{Code, Message}` / `json:"code"`, `json:"message"` |

Functions, variables, parameters:

| Current | Target |
|---|---|
| `ErrDivisionCero` | `ErrDivisionByZero` |
| `calcular(a, b, operacion)` | `Compute(operation string, operands []float64)` |
| parameters `a`, `b` | `operands` (slice); inside an operation `operands[0]`, `operands[1]` |
| `operacion` | `operation` |
| `resultado` | `result` |
| `manejarCalculo` | `handleCalculate` |
| `escribirJSON` | `writeJSON` |
| `escribirError` | `writeError` |
| `registrarPeticiones` | `logRequests` |
| `w` (`http.ResponseWriter`) | `writer` |
| `r` (`*http.Request`) | `request` |
| `p` (`var p Peticion`) | `calculateRequest` (`request` is taken by the handler parameter) |
| `codigo` | `statusCode` |
| `cuerpo` | `body` |
| `mensaje` | `message` |
| `puerto` | `port` |
| `web` | removed |
| `mux` | `router` |
| `direccion` | `address` |
| `servidor` | `server` |
| `siguiente` | `next` |
| `inicio` | `startTime` |
| operation values `"+"`, `"-"`, `"*"`, `"/"` | `"add"`, `"subtract"`, `"multiply"`, `"divide"` |

Tests:

| Current | Target |
|---|---|
| `TestCalcular` | `TestCompute` |
| `TestCalcularDivisionEntreCero` | a row in the `TestComputeErrors` table |
| `TestCalcularOperacionInvalida` | a row in the `TestComputeErrors` table |
| `casos` | `testCases` |
| `c` (loop variable) | `testCase` |
| `nombre` | `name` |
| `esperado` | `want` |
| `obtenido` | `got` |
| subtests `suma`, `resta`, `producto`, `division`, `negativos`, `resultado cero` | `addition`, `subtraction`, `multiplication`, `division`, `negative operands`, `zero result` |
| `t` (`*testing.T`) | **keep** — see finding F9 |

Spanish strings in the backend (responses and logs):

| Current | Target |
|---|---|
| `no se puede dividir entre cero` | `cannot divide by zero` |
| `operación no soportada: %q` | `unknown operation` (sentinel text) |
| `JSON inválido: ` + decoder error | `request body is not valid JSON` (the decoder error is logged, not returned) |
| `el resultado excede el rango representable` | `result is not a finite number` |
| `error escribiendo la respuesta: %v` | `failed to write response: %v` |
| `calculadora escuchando en http://localhost%s` | `calculator listening on http://localhost%s` |
| `el servidor se detuvo: %v` | `server stopped: %v` |
| flag help texts and `no encuentro el frontend compilado…` | removed with the flags |
| test failure messages (`no esperaba error, llegó: %v`, `esperaba ErrDivisionCero…`) | English equivalents |

Every comment in both files is Spanish and is rewritten in English. Many are Go
tutorial notes (what `any` is, why header order matters) and can simply be
dropped.

---

## 0.3 Frontend inventory

| Question | Finding |
|---|---|
| Language | TypeScript. `strict: true`, plus `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax` |
| Build tool | Vite 8.3.0 with `@vitejs/plugin-react` 6.1.1 |
| Versions installed | React 19.3.0, React DOM 19.3.0, TypeScript 7.0.2, Node v22.16.0, npm 11.8.0 |
| Scripts | `dev`, `build` (`tsc --noEmit && vite build`), `preview`. No `test`, `lint`, or `coverage` script |
| State management | Three `useState` calls inside one custom hook. No `useReducer`, Context, Redux, or Zustand in the tree |
| Files holding calculator state | **One:** `src/useCalculadora.ts` — `estado` (object: `entrada`, `acumulador`, `operacion`, `reiniciar`), `error`, `cargando` |
| `fetch` calls | **One:** `src/api.ts:33`, relative URL `"/api/calcular"` |
| Files that know the backend URL | `src/api.ts` (path), `vite.config.ts:12` (proxy target `http://localhost:8080`), `src/App.tsx:91` (footer text only). No `import.meta.env` use, no `.env` file |
| Tests | **None.** No runner, no Testing Library, no MSW, no coverage tooling installed |
| Lint | **None.** No ESLint, Prettier, or Biome configuration. `tsc --noEmit` passes with no output |
| Styling | One global plain CSS file, `src/styles.css`. Spanish class names and Spanish CSS custom properties. Dark theme only |

### Components (all three live in `src/App.tsx`)

| Component | Renders | State it owns |
|---|---|---|
| `App` | Everything: header badges, display (expression line + value), status line, 4-column keypad, footer. Also registers the `keydown` listener on `window` | None — consumes `useCalculadora()` |
| `Fila` | One keypad row: three digit keys plus the row's operator key. Receives the whole hook object as the prop `calc` | None |
| `Tecla` | A `<button type="button">` with `etiqueta`, `clase`, `desactivada` | None |

`formatear` (number formatting) and `simbolo` (operation → display symbol) are
exported from the hook file rather than from their own modules.

### Behaviour of the current state machine, against the Phase 3.3 transition table

Derived by reading `useCalculadora.ts`; not click-tested in a browser.

| Target transition | Today |
|---|---|
| `DIGIT` after a result → overwrite | ✅ same (`reiniciar` flag) |
| second `.` in the same number → ignored | ✅ same |
| leading zeros blocked | ✅ same |
| `OPERATION` twice → replaces the pending operation | ✅ same, with no request sent |
| `OPERATION` with a pending operation and a second operand → evaluate, then set the new one | ✅ same |
| `EVALUATE` with nothing pending → no-op | ✅ same |
| `EVALUATE` repeatedly → no-op | ✅ same (`=` clears `operacion`) |
| `FAILURE` → show message, keep display, **clear the pending operation** | ⚠️ message shown and display kept, but `acumulador` and `operacion` are **not** cleared |
| `CLEAR` → initial state | ✅ same |
| display cap | 15 digits, sign and point excluded (`MAX_DIGITOS`); the plan suggests 16 characters |

Existing features **not** listed in the plan's transition table, to be kept as
reducer actions: backspace (`borrar`, key `Backspace`) and sign toggle
(`cambiarSigno`, key `±`). Keyboard mapping already exists: `0-9`, `.` and `,`,
`+ - * /`, `Enter` and `=`, `Backspace`, `Escape`.

Defects found while reading:

1. **Input is not blocked while a request is in flight.** Only the operator and
   `=` buttons get `disabled`; digit keys, `C`, `±`, `⌫` stay enabled, and the
   physical-keyboard handler is never guarded. The handlers close over
   `estado`, and the response handler replaces the whole state, so digits typed
   during a request are lost and two fast operator presses can overlap
   requests. The `useReducer` version in `fcd23f4` solved this with one guard at
   the top of the reducer.
2. `cargando` flips to `true` and back even when no request is sent (first
   operator press, where `resolver` returns the typed number directly).
3. The `keydown` listener is removed and re-added on every render, because the
   hook returns a new object each time and the effect depends on `[calc]`.

### Responsive, loading, error, accessibility

- Layout: `.calculadora { width: 100%; max-width: 340px }`, body padding
  `24px 16px`, keypad already `display: grid; grid-template-columns:
  repeat(4, 1fr)`. **No media query.**
- Touch targets, computed from the CSS and not measured in a browser: at a
  360 px viewport each key is about 66 px wide and about 55 px tall
  (`padding: 16px 0`, `font-size: 19px`), above the 44 px target. Verify in
  Phase 3.
- Loading interface: yes — `calculando en el servidor…` in a `role="status"`
  line; operator and `=` keys disabled.
- Error interface: yes — same status line, red (`.hay-error`), cleared by the
  next key press. A network failure (`TypeError` from `fetch`) maps to
  `sin conexión con el servidor Go`.
- Accessibility: `aria-live="polite"` on the display, `:focus-visible` outline
  on keys. **No `aria-label`**: `⌫`, `±`, `÷`, `×`, `−` are announced as raw
  symbols.

### Frontend rename table

Files and project metadata:

| Current | Target |
|---|---|
| `src/api.ts` | `src/api/client.ts` + `src/api/types.ts` |
| `src/useCalculadora.ts` | `src/hooks/useCalculator.ts` + `src/utilities/formatNumber.ts` |
| `src/App.tsx` (three components) | `src/App.tsx` + `src/components/Display.tsx`, `Keypad.tsx`, `Button.tsx` |
| — | new `src/messages.ts` |
| `package.json` name `calculadora-frontend`, Spanish `description` | `calculator-frontend`, English description |
| `index.html` `lang="es"` | `lang="en"` |

`src/api.ts`:

| Current | Target |
|---|---|
| `Operacion` | `Operation` |
| `"+" \| "-" \| "*" \| "/"` | `"add" \| "subtract" \| "multiply" \| "divide"` (plus `"power" \| "squareRoot" \| "percentage"` once the backend has them) |
| `PeticionCalculo` | `CalculateRequest` |
| fields `a`, `b` | `operands: number[]` |
| field `operacion` | `operation` |
| `RespuestaOK` / field `resultado` | `CalculateResponse` / `result` |
| `RespuestaError` (`error: string`) | `ErrorResponse` (`error: ApiError`), with `ApiError = { code; message }` |
| `RespuestaCalculo` | removed — the HTTP status decides, not the body shape |
| `esError` | `isErrorResponse` |
| `r` | `body` |
| `calcular` | `calculate` (method of `CalculatorClient`) |
| `peticion` | `request` |
| `respuesta` | `response` |
| `cuerpo` | `body` |

`src/useCalculadora.ts`:

| Current | Target |
|---|---|
| `useCalculadora` | `useCalculator` |
| `Estado` | `State` |
| `entrada` | `input` |
| `acumulador` | `accumulator` |
| `operacion` (state field) | `pendingOperation` |
| `reiniciar` | `overwrite` |
| `INICIAL` | `initialState` |
| `MAX_DIGITOS` | `MAXIMUM_DIGITS` |
| `formatear` / parameter `n` | `formatNumber` / `value` |
| `mensajeDeError` / parameter `err` | `toErrorMessage` / `error` |
| `estado`, `setEstado` | `state`, `dispatch` |
| `error`, `setError` | `state.error` |
| `cargando`, `setCargando` | `state.status` (`'idle' \| 'loading' \| 'error'`) |
| `resolver` / parameter `e` | removed — becomes the side effect inside the hook |
| `e` (state updater parameter) | `state` |
| `actual` | `currentValue` |
| `valor` | `value` |
| `pulsarDigito` / `digito` | `pressDigit` / `digit` → action `DIGIT` |
| `pulsarOperacion` | `pressOperation` → action `OPERATION` |
| `pulsarIgual` | `evaluate` → action `EVALUATE` |
| `limpiar` | `clear` → action `CLEAR` |
| `borrar` | `deleteDigit` → action `DELETE` (`delete` alone is a reserved word in JavaScript) |
| `cambiarSigno` | `toggleSign` → action `TOGGLE_SIGN` |
| `expresion` | `expression` |
| `pantalla` | `display` |
| `operacionActiva` | `activeOperation` |
| `simbolo` | `operationSymbol`, moved to `messages.ts` |

`src/App.tsx` and `src/main.tsx`:

| Current | Target |
|---|---|
| `OPERACIONES` | `OPERATIONS` |
| `calc` | `calculator` |
| `alPulsarTecla` | `handleKeyDown` |
| `evento` | `event` |
| `fila`, `indice` | `row`, `rowIndex` |
| `Fila` / prop `digitos` | removed (`Keypad` renders one flat grid); if kept: `KeypadRow` / `digits` |
| `d` | `digit` |
| `Tecla`, `PropsTecla` | `Button`, `ButtonProps` |
| `etiqueta` | `label` |
| `clase` | `variant` |
| `desactivada` | `disabled` |
| `contenedor` (`main.tsx`) | `container` |

`src/styles.css`:

| Current | Target |
|---|---|
| `.calculadora` | `.calculator` |
| `.cabecera` | `.header` |
| `.etiqueta` | `.badge` |
| `.flecha` | `.arrow` |
| `.pantalla` | `.display` |
| `.expresion` | `.expression` |
| `.resultado` | `.result` |
| `.estado`, `.hay-error` | `.status`, `.has-error` |
| `.teclado` | `.keypad` |
| `.tecla` | `.button` |
| `.funcion`, `.operador`, `.activo`, `.cero`, `.igual` | `.function`, `.operator`, `.active`, `.zero`, `.equals` |
| `.pie` | `.footer` |
| `--fondo`, `--borde` | `--background`, `--border` |
| `--tecla`, `--tecla-hover` | `--button`, `--button-hover` |
| `--operador`, `--operador-hover` | `--operator`, `--operator-hover` |
| `--texto`, `--texto-tenue` | `--text`, `--text-muted` |
| `--panel`, `--go`, `--go-hover`, `--error` | unchanged |

User-visible Spanish strings (move to `messages.ts` in step 3.10):

| Where | Current | Target |
|---|---|---|
| `index.html` title | `Calculadora Go + React` | `Calculator — Go + React` |
| `useCalculadora.ts:36` | `sin conexión con el servidor Go` | `Cannot reach the server` |
| `useCalculadora.ts:37` | `error desconocido` | `Unknown error` |
| `api.ts:46` | `respuesta ilegible del servidor (HTTP N)` | `Unreadable server response (HTTP N)` |
| `App.tsx:51` | `calculando en el servidor…` | `Calculating…` |
| `App.tsx:91` | `cada operación viaja a POST /api/calcular` | `Every operation is sent to POST /api/v1/calculate` |
| `App.tsx:42` | `React + TS` | `React + TypeScript` |
| `main.tsx:11` | `no existe el elemento #root en index.html` (developer-facing) | `element #root not found in index.html` |
| from the server | the three backend error strings in 0.2 | their English targets |

Spanish outside the paths the per-phase gate greps cover (`backend/`,
`frontend/src/`) — only the Phase 7 repository-wide grep catches these:
`README.md`, comments in `.gitignore`, `frontend/vite.config.ts`,
`frontend/tsconfig.json`, and `frontend/index.html`; `package.json` name and
description; the repository folder name `calculadora` (name the remote
`calculator`).

---

## 0.4 Current API contract

One endpoint. Everything else falls through to the static file server.

| | |
|---|---|
| Method and path | `POST /api/calcular` |
| Request body | `{"a": number, "b": number, "operacion": "+" \| "-" \| "*" \| "/"}` |
| Success | `200` `{"resultado": number}` |
| Error | `400` `{"error": "<Spanish message>"}` — for every failure |
| Health endpoint | none (`GET /health` → 404) |
| Operations listing | none |
| CORS | none (`OPTIONS` → 404, no `Access-Control-*` headers) |

### Captured responses (server on `:8080`, headers trimmed to the status line)

```
$ curl -s -i -X POST http://localhost:8080/api/calcular -H 'Content-Type: application/json' -d '{"a":10,"b":4,"operacion":"/"}'
HTTP/1.1 200 OK
{"resultado":2.5}

$ curl ... -d '{"a":10,"b":0,"operacion":"/"}'
HTTP/1.1 400 Bad Request
{"error":"no se puede dividir entre cero"}

$ curl ... -d '{"a":1,"b":2,"operacion":"%"}'
HTTP/1.1 400 Bad Request
{"error":"operación no soportada: \"%\""}

$ curl ... -d '{not json'
HTTP/1.1 400 Bad Request
{"error":"JSON inválido: invalid character 'n' looking for beginning of object key string"}

$ curl ... -d '{"a":1e308,"b":10,"operacion":"*"}'
HTTP/1.1 400 Bad Request
{"error":"el resultado excede el rango representable"}

$ curl ... -d '{"a":"5","b":2,"operacion":"+"}'
HTTP/1.1 400 Bad Request
{"error":"JSON inválido: json: cannot unmarshal string into Go struct field Peticion.a of type float64"}

$ curl ... -d ''
HTTP/1.1 400 Bad Request
{"error":"JSON inválido: EOF"}

$ curl ... -d '{"a":1,"b":2,"operacion":"+","extra":true}'      # unknown field accepted
HTTP/1.1 200 OK
{"resultado":3}

$ curl ... -d '{"operacion":"+"}'                                # missing operands become 0
HTTP/1.1 200 OK
{"resultado":0}

$ curl -s -i http://localhost:8080/api/calcular                  # wrong method: 404, not 405
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
404 page not found

$ curl -s -i http://localhost:8080/health
HTTP/1.1 404 Not Found

$ curl -s -i -X OPTIONS http://localhost:8080/api/calcular -H 'Origin: http://localhost:5173' -H 'Access-Control-Request-Method: POST'
HTTP/1.1 404 Not Found

$ curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:8080/
200 text/html; charset=utf-8
```

### Inconsistencies

1. One status code (400) for client mistakes and for valid-but-uncomputable
   input alike; the target separates 400 from 422.
2. Errors carry free text only — no machine-readable code; the frontend can do
   nothing but display the string.
3. Two error shapes: JSON `{"error": …}` from the handler, `text/plain` from the
   file server for wrong method and unknown path.
4. Wrong method gives 404 instead of 405.
5. Internal decoder messages, including the Go struct and field name, reach the
   client.
6. Unknown fields accepted; missing operands default to `0` without an error.
7. The binary-only shape `{a, b}` cannot express a unary operation (square
   root) without a dummy operand.
8. Operations are symbols (`"/"`), which need escaping or mapping everywhere
   and cannot name `power` or `squareRoot` naturally.
9. No versioning in the path.

### Spanish JSON field names and values

| Current | Target | Where |
|---|---|---|
| `operacion` | `operation` | request |
| `resultado` | `result` | success response |
| `a`, `b` (not Spanish; single letters, positional) | `operands` (array) | request |
| `error` (string) | `error` (object `{code, message}`) | error response — same key, **different type** |
| path `/api/calcular` | `/api/v1/calculate` | route |
| error message texts | English, see 0.2 | error response |
| values `"+"`, `"-"`, `"*"`, `"/"` | `"add"`, `"subtract"`, `"multiply"`, `"divide"` | request |

Frontend types that move with them in Phase 3: `PeticionCalculo`,
`RespuestaOK`, `RespuestaError`, `RespuestaCalculo`, `Operacion` (all in
`src/api.ts`), plus the `simbolo` switch and the `OPERACIONES` array, which are
keyed by the symbol values.

---

## 0.5 Baseline

Commands that worked on this machine (Windows 11, Git Bash), exactly as run.
`npm install` was **not** re-run — `node_modules/` was already present and
`npm ls --depth=0` reported every dependency installed with no errors.

Production mode, one process:

```
cd frontend && npm run build        # tsc --noEmit && vite build → dist/ (18 modules, 224.41 kB JS, 2.49 kB CSS)
cd ../backend && go run .           # http://localhost:8080 serves the API and dist/
```

Development mode, two processes:

```
cd backend  && go run .             # :8080
cd frontend && npm run dev          # http://localhost:5173, proxies /api → :8080
```

Verified with `curl`: `GET :8080/` → 200 `text/html`; `GET :5173/` → 200;
`POST :5173/api/calcular {"a":2,"b":3,"operacion":"+"}` → `{"resultado":5}`
through the Vite proxy. **The interface was not click-tested in a browser
during this phase.** Both processes were stopped afterwards.

| Metric | Backend | Frontend |
|---|---|---|
| Test functions | 3 (`TestCalcular` with 6 subtests, plus 2) — 8 cases, all pass | 0 |
| Statement coverage | **10.1%** (`calcular` 100%, all HTTP code 0%) | **none** — no runner installed |
| `go vet` / `tsc --noEmit` | clean | clean |
| `gofmt -l .` / lint | `main.go` listed (comment issue, 0.2) | no linter |
| Build | `go run .` works | `npm run build` works |
| Plan's abbreviation grep | 0 hits | 29 hits, all `calc` in `App.tsx` |
| Plan's Spanish grep (matching lines) | `main.go` 46, `calculadora_test.go` 14 | `useCalculadora.ts` 51, `App.tsx` 32, `api.ts` 21, `styles.css` 6, `vite-env.d.ts` 2, `main.tsx` 0 |

Tag: `git tag pre-refactor` → `1b273e2` (same commit as `HEAD`).

---

## 0.6 Gap analysis

| Target | Current state | Action | Phase |
|---|---|---|---|
| Arithmetic in a package with no HTTP or JSON imports | `calcular` lives in `package main` next to the handler; the package imports `net/http` and `encoding/json`. The function body is pure | Move to `internal/calculator`; delete from `main.go` | 1 |
| Sentinel errors, mapped to status codes in the transport layer only | One sentinel (`ErrDivisionCero`); unknown operation is an unmatchable `fmt.Errorf`; the non-finite check sits in the handler; everything maps to 400 | Define the five sentinels in `errors.go`; move the non-finite check into the domain; one mapping function in `httpapi` | 1–2 |
| Operations table (`map[string]Operation`) instead of a growing `switch` | Four-case `switch` on symbol strings | Table with `Arity` and `Apply`, keyed by English names | 1 |
| Table-driven tests for the domain, about 100% on that package | Table-driven happy path with 6 cases, plus 2 separate error tests; `calcular` at 100%. No overflow, precision, or operand-count cases | Move and extend: all operations, every sentinel, `1e308 * 10`, `0.1 + 0.2`, percentage semantics | 1 |
| Single `POST /api/v1/calculate` endpoint with a stable error envelope | Already a single endpoint, but `POST /api/calcular`, body `{a, b, operacion}`, error is a bare string | New path, new request shape, `{"error":{"code","message"}}` envelope; add `GET /api/v1/operations` and `GET /health` | 2 |
| Input validation: unknown operation, operand count, non-finite numbers, malformed JSON | Unknown operation and malformed JSON → 400. Operand count not applicable (fixed `a`, `b`). Unknown fields accepted, missing fields → 0, no body limit, decoder error leaked | `DisallowUnknownFields`, `MaxBytesReader`, empty-body handling, arity check in the domain, generic message for decode errors | 2 |
| `main.go` does wiring only; configuration from environment variables | `main.go` holds everything. Flags `-puerto` and `-web`. Refuses to start without `frontend/dist`. Only `ReadHeaderTimeout`; no graceful shutdown | `cmd/server/main.go`: `PORT`, `ALLOWED_ORIGIN`, timeouts, signal-driven shutdown. Remove static file serving | 2 |
| Handler tests with `httptest` | None — all HTTP code at 0% coverage | Add per 2.8, including one test with a fake `Calculator` | 2 |
| Frontend: one API client module, injected into the hook | One module with the only `fetch` (`api.ts`), but the hook imports it directly — nothing is injected | `CalculatorClient` interface + `createHttpClient(baseUrl)`; pass the client to `useCalculator` | 3 |
| Frontend: `useReducer` state machine in `useCalculator` | Three `useState` calls in one hook; transitions spread over six callbacks. A full `useReducer` version exists in history (`fcd23f4`) | Restore the reducer from `fcd23f4` as the starting point, translate it, align it with the 3.3 table | 3 |
| Frontend: loading and error states visible; keys disabled while loading | Both visible. Only operator and `=` keys are disabled; digits, `C`, `±`, `⌫`, and the physical keyboard are not guarded | Disable every key while `status === 'loading'`; guard inside the reducer so the keyboard cannot bypass it | 3 |
| Responsive keypad, touch targets of at least 44 px | CSS grid keypad, fluid width capped at 340 px, keys about 66 × 55 px at 360 px (computed). No breakpoint | Add one breakpoint; verify 360 px in the browser; add `aria-label`s | 3 |
| Reducer tests (table-driven) + hook test with a fake client + 1–2 interface integration tests | No tests, no runner | Install Vitest, coverage provider, Testing Library, jsdom, MSW; write the three layers of tests | 4 |
| Coverage report for both layers | Backend 10.1%, no script. Frontend none | `go tool cover` + `vitest run --coverage`; one command that regenerates both | 4 |
| Dockerfiles + `docker-compose.yml` | None | Add per Phase 5; use the `golang` image matching `go 1.27` | 5 |
| README: setup, run, API examples, design decisions, assumptions | README exists in Spanish: structure, requirements, two run modes, API, tests, keyboard shortcuts. No design decisions, no assumptions, no coverage | Rewrite in English with the Phase 6 section order | 6 |
| `PROMPTS.md` | Does not exist | Create and keep current from now on (the Phase 0 prompt is the first entry) | 6 |
| All identifiers in English, full words (Naming convention) | Practically every identifier is Spanish in both layers; single-letter names `w`, `r`, `p`, `c`, `e`, `d`, `n`; `calc` in `App.tsx` | Apply the rename tables in 0.2 and 0.3 | 1–3 |
| All JSON field names in English | `operacion`, `resultado` Spanish; `a`, `b` single letters | `operation`, `operands`, `result`, `error.code`, `error.message` | 2–3 |
| Comments, test names, interface text in English | All Spanish, including error messages returned by the API | Translate; interface strings collected in `messages.ts` | 1–3 |

---

## 0.7 Refactor strategy decisions

| Decision | Chosen | Reason |
|---|---|---|
| Extract or rewrite the backend | **Extract.** | The arithmetic is 18 lines and already pure; `main.go` is 169 lines in total. The logging middleware, the JSON helpers, and the sentinel pattern are kept and moved |
| Frontend state | **Consolidate the three `useState` calls into one `useReducer`**, starting from the implementation in commit `fcd23f4`. | No Redux to remove — it was tried in `b20a232` and reverted in `1b273e2`. That history is the evidence for the README's "Redux rejected" row |
| Must the old endpoint survive the migration? | **No.** | Same repository, only one consumer, frontend moves in the same change. `POST /api/calcular` is deleted in Phase 2 |
| Static file serving from the Go binary | **Remove.** Rejected alternative: keep the single-binary production mode. | The target `main.go` is wiring only and Docker serves `dist/` from nginx. Removing the `/` catch-all also restores 405 for wrong methods, and removes the start-up failure when `dist/` is missing. Recorded for the README |
| Translation scope | **Everything:** identifiers, JSON fields and values, routes, file and folder names, CSS classes and custom properties, comments, test names, log messages, API error messages, user-visible interface text, README, commit messages from now on. | Default of the plan; reviewers read English. Existing commit messages stay Spanish — history is not rewritten, the `pre-refactor` tag depends on it |
| Features missing today (`power`, `squareRoot`, `percentage`, `GET /api/v1/operations`, `GET /health`, CORS) | **Build them.** | Confirmed in scope on 2026-09-19. They are new functionality, so each one arrives with its tests in the phase that adds it |
| Operation names on the wire | `add`, `subtract`, `multiply`, `divide`, `power`, `squareRoot`, `percentage` | Follows the plan's rename table. Appendix B writes `sqrt`; read it as `squareRoot` (Rule 2) |
| Translation technique | Rename-symbol (`gopls`, TypeScript language server), one identifier at a time, tests after each batch. No plain-text replace. | Confirmed necessary here: `operacion` is at once a JSON tag, a struct field, a parameter, a state field, and a CSS-adjacent word; `estado` is inside `estado.operacion` and `.estado` |
| Lint gate for the frontend (Gate 3 says "lint clean") | `tsc --noEmit` with the existing strict flags is the lint gate. | There is no linter today; adding ESLint is not asked for. Goes under "What I'd do with more time" |

---

## Findings that adjust the plan

- **F1 — Two breaking changes more than the plan lists.** Beyond the field
  names, the request *shape* changes (`a`, `b` → `operands[]`) and the operation
  *values* change (`"/"` → `"divide"`). The frontend's `simbolo` switch and
  `OPERACIONES` array are keyed by those values.
- **F2 — Power, square root, and percentage do not exist today** in either
  layer. Steps 1.2, 1.6, and 3.8 assume them, so Phase 1 adds functionality, not
  only structure. **Confirmed in scope (2026-09-19):** whatever the target
  needs and the current application lacks gets built, these three operations
  included — domain in Phase 1, keys in step 3.8. Percentage semantics remain
  an assumption: binary, `percentage(value, percent) = value × percent ÷ 100`.
  Check it against the assignment text, which is not in the repository, and
  record it under "Assumptions" in the README.
- **F3 — The backend cannot start without a built frontend** (`log.Fatalf` at
  `main.go:130`). Blocks Phase 5 if it survives Phase 2.
- **F4 — A finished `useReducer` hook is in history** (`fcd23f4`), including the
  in-flight guard that the current code lacks. Use
  `git show fcd23f4:frontend/src/useCalculadora.ts` instead of writing the
  reducer from zero.
- **F5 — The `FAILURE` transition differs from the target**: the pending
  operation is not cleared today. This is a behaviour change, to be covered by
  a reducer test.
- **F6 — Phase 4 starts from nothing**: no runner, no Testing Library, no jsdom,
  no MSW. Check at install time that the chosen versions support Vite 8,
  React 19.3, and TypeScript 7.
- **F7 — `gofmt -l` is not clean at baseline** (one comment). Fix by rewording,
  not with `gofmt -w`.
- **F8 — The plan's Spanish gate grep misses most of this code base's
  vocabulary.** It reports 0 for `main.tsx`, which contains `contenedor`. Use
  the extended grep below.
- **F9 — Single-letter identifiers are invisible to the abbreviation grep.**
  `w`, `r`, `p`, `c`, `e`, `d`, `n` are in the rename tables. Recommendation:
  add `t *testing.T` to the plan's list of allowed Go idioms — renaming it would
  look wrong to a Go reviewer, which is the plan's own criterion.
- **F10 — `REFACTOR_PLAN.md`, the assignment text, and `PROMPTS.md` are not in
  the repository.** The first two are inputs to later phases.
- **F11 — `go 1.27` in `go.mod`** requires a `golang:1.27` build image in
  Phase 5; confirm the tag exists then.

---

## Extended naming greps for this code base

Both were run against `pre-refactor` to confirm they match. Add them to the two
gate greps in the plan; all four must print nothing.

Spanish words the plan's list does not cover:

```
grep -rnEi '\b(peticion|entrada|acumulador|reiniciar|pulsar|digito|simbolo|formatear|tecla|fila|clase|etiqueta|desactivad|cabecera|flecha|fondo|texto|tenue|borde|borrar|cambiar|signo|casos|nombre|esperado|obtenido|siguiente|inicio|inicial|servidor|direccion|escribir|registrar|cuerpo|contenedor|evento|indice|expresion|activo|funcion|operador|cero|igual|ejemplo)\w*|\bpie\b|hay-error' \
  --include='*.go' --include='*.ts' --include='*.tsx' --include='*.css' --include='go.mod' backend/ frontend/src/
```

Matching lines at baseline: `useCalculadora.ts` 56, `App.tsx` 60, `styles.css`
49, `main.go` 32, `calculadora_test.go` 12, `api.ts` 10, `main.tsx` 3,
`go.mod` 1.

Single-letter identifiers (8 Go lines and 10 TypeScript lines at baseline;
`t *testing.T` is deliberately not matched — decision F9):

```
grep -nE '\b[a-z] (http\.ResponseWriter|\*http\.Request)|\bvar [a-z] |for _, [a-z] :=|\b[a-z], [a-z] +float64' $(find backend -name '*.go')
grep -rnE '\(\(?[a-z]\)? *=>|\(\(?[a-z]: |\b[a-z]: (number|string)' --include='*.ts' --include='*.tsx' frontend/src/
```

---

## Gate 0 checklist

- [x] `docs/ANALYSIS.md` written
- [x] Baseline numbers recorded (0.5)
- [x] `pre-refactor` tag exists → `1b273e2`
- [x] Gap table filled (0.6)
- [x] Rename tables complete — backend (0.2), frontend (0.3), JSON (0.4)
- [x] Translation scope decided (0.7)
- [x] No source file modified — `git status` shows only `docs/` as untracked
