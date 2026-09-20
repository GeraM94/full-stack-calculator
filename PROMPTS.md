# Prompts used in this project

This file documents how AI tooling was used to build and refactor the calculator,
as required by the assignment ("Share any prompts that you used in your work").

**Tools used:**

- **Claude Code** (VS Code extension) — built the first version, executed the
  refactor plan, verified the result, and published the repository
  (sections 1, 3, 4, and 5).
- **Claude** (Cowork chat session) — architecture discussion and the refactor
  plan, `REFACTOR_PLAN.md` (section 2).

**How I used them:** The assistant wrote the code. I set the direction, asked for
the alternatives, and made the scope and design decisions; the ones where I
overrode or pushed back on the assistant are listed under
[Decisions that were mine](#decisions-that-were-mine). The refactor ran phase by
phase against the gates written in the plan, one commit per phase.

Prompts are listed in chronological order, with spelling and punctuation corrected
and the substance unchanged. Prompts I wrote in Spanish are given in the original,
followed by an English translation. The "Outcome" line says what I did with the
answer — accepted, modified, or rejected — because that is the part that shows
judgment, not the prompt itself. Messages that only moved a session along
("continue", "okay, so what is next?", "the files are in that path now") are left
out.

---

## 1. Original build

The first version was built with Claude Code on 17 September, in the session in
which I was setting up Go. Prompts recovered from the session history.

### 1.1 Starting point

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> ¿Principalmente se usa Go para crear backend? ¿Cuáles son sus aplicaciones?
> Hagamos una calculadora paso por paso.
>
> *Is Go mainly used to build backends? What are its applications? Let's build a
> calculator step by step.*

**Outcome:** An overview of where Go is used, and the first step of a
command-line calculator meant as a syntax exercise. I changed course in 1.2 and
asked for the full application instead.

### 1.2 The application

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Créame una calculadora con TypeScript y Go.
>
> *Build me a calculator with TypeScript and Go.*

**Outcome:** The assistant asked two questions before writing code. I chose a
full-stack layout (Go API plus a TypeScript web frontend) over a command-line
tool, and a finished, working application over a guided build. It wrote the Go
backend — standard library only, `POST /api/calcular`, tests — and started a
plain TypeScript frontend, which I interrupted with 1.3.

### 1.3 React for the frontend

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Use React and TypeScript for the frontend.

**Outcome:** Accepted. React 19, Vite, strict TypeScript; a `useCalculadora` hook
built on `useState`; the Go binary also served the built frontend. Verified by
the assistant with `go vet`, 8 Go tests, `tsc --noEmit`, and requests against the
running server. This is commit `6fb5b17`. Identifiers, JSON fields, and messages
were in Spanish, which section 2 later changes.

### 1.4 React Query?

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> `useCalculadora.ts` es un hook, ¿verdad?, que usamos para manejar el estado.
> ¿Conviene usar React Query para ello?
>
> *`useCalculadora.ts` is a hook, right, the one we use to manage state? Would
> React Query be a good fit for that?*

**Outcome:** No: React Query caches server state, and almost all of this hook is
client state, so it would replace about 15 lines out of 150. The answer also
pointed out a real defect: two requests could overlap, because the handlers read
state from a stale closure and the keyboard bypassed the disabled buttons. The
fix it proposed was `useReducer`, with no new dependency.

### 1.5 Understanding `useReducer`

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Primero explícame qué hace el `useReducer` y cómo lo implementaríamos.
>
> *First explain what `useReducer` does and how we would implement it.*

**Outcome:** An explanation and a design: a pure reducer, one effect that owns
the request, and a one-line guard against overlapping requests.

### 1.6 The same with Redux

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> ¿Cómo lo implementaríamos con Redux?
>
> *How would we implement it with Redux?*

**Outcome:** A Redux Toolkit design (`createSlice`, `createAsyncThunk`,
`configureStore`). The assistant still recommended `useReducer` as proportional
to the project.

### 1.7 Both versions, one commit each

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Genérame dos ejemplos sencillos, uno con Redux Toolkit y otro con reducer, para
> evaluar cómo se comporta cada cosa. ¿Podrías hacer el archivo con reducer,
> después sustituirlo con Redux Toolkit, y hacer commit de cada uno para ver las
> diferencias en la herramienta de source control?
>
> *Generate two simple examples, one with Redux Toolkit and one with a reducer,
> so I can evaluate each. Could you write the reducer version, then replace it
> with Redux Toolkit, and commit each one so I can see the differences in the
> source control view?*

**Outcome:** Commits `fcd23f4` (`useState` → `useReducer`) and `b20a232`
(`useReducer` → Redux Toolkit). I compared the two diffs side by side. That
comparison is why the design decisions table can say Redux Toolkit was tried.

### 1.8 Back to the simplest version before the refactor

**Tool:** Claude Code (VS Code extension), a new session on 19 September
**Prompt:**

> I'm about to give you a markdown file with all the instructions to refactor the
> app. We must not over-engineer, so remove the `useReducer` and Redux Toolkit
> things; let's start with the initial version of the app.

**Follow-up prompts in the same exchange:**

> So use `useState`, because for this app Redux Toolkit is over-engineering.

> Okay, fix it. Before committing the changes, let me see them in source control.

> What is that you made? Did you create a hook for the calculator, and for that
> we delete those files?

> Commit that revert, and afterward I'll send you the plan.

**Outcome:** My decision: the refactor starts from the simplest version. The
assistant first put the initial version on a side branch; I asked for the change
on `main`, staged, so I could read it before it was committed. It used a revert
rather than a reset, so both experiments stay in the history, and checked that
the tree was identical to `6fb5b17`. My question about the hook was answered
from the history: the file came back with the revert, it was not new code. This
is commit `1b273e2`, later tagged `pre-refactor`.

---

## 2. Architecture discussion (Claude, Cowork session)

Before refactoring, I discussed the architecture with Claude. The prompts are
informal; spelling and punctuation have been corrected, wording and intent are
unchanged.

### 2.1 Initial architecture question

**Prompt:**

> [pasted the full assignment text]
>
> Please, let's discuss this. I'm going to use Go for the backend, as the
> instructions say, but first I want to know how to implement it with a clean
> structure, which approach would be best for this app (SOLID, DRY, etc.), and
> how to set up the folders for a clear folder structure.

**Outcome:** Accepted the core recommendation: two layers per side (a pure
`calculator` domain package with no HTTP imports, and a thin `httpapi` transport
layer; on the frontend, one API client injected into one `useCalculator` hook).
Accepted the single `POST /api/v1/calculate` endpoint over per-operation endpoints.
Noted the explicit warning against over-engineering a 4-hour take-home.

### 2.2 State management

**Prompt:**

> For React, do we need to use Redux to simplify the state management?

**Outcome:** Accepted: no Redux. A calculator is a single-screen state machine, so
`useReducer` inside one hook is proportional. Kept the list of conditions under
which Redux, Zustand, or Context would become justified, for the README.

### 2.3 Request for a step-by-step plan

**Prompt:**

> Make a step-by-step plan in a markdown file. I already have an app ready, and I
> need to apply these changes to that app. So you need to include a step to
> analyze the current code and then apply the changes.

**Outcome:** Received `REFACTOR_PLAN.md` with an analysis-first Phase 0 and gated
phases. Used as the working plan for the refactor.

### 2.4 Pushback on scope

**Prompt:**

> Did you consider not over-engineering this?

**Outcome:** The plan had accumulated nice-to-haves (operations endpoint, graceful
shutdown, distroless image, operation chaining, keyboard mapping). I later checked
each one against the assignment (entries 3.4–3.7); none is required. Deferred the
operations-listing endpoint (nobody consumes it) and the CORS middleware (never
exercised: Vite proxies in development, nginx in Docker), and listed them under
"What I'd do with more time". Kept graceful shutdown: about 15 lines, idiomatic
for a Go server, and Docker stops containers with a terminate signal. Kept
operation chaining and keyboard mapping because the original app already had
them — removing them would be a regression. The image question was settled in
3.8–3.10: distroless for the backend after all.

### 2.5 Clarifying jargon

**Prompt:**

> What is an ops list?

**Outcome:** "ops" meant "operations". Led directly to the next rule.

### 2.6 Naming rule — no abbreviations

**Prompt:**

> Don't use shorthand in the app. Leave the variables with their full meaning —
> for example, ops = operations, keep all the letters. Implement that in the
> markdown.

**Outcome:** Added a Naming convention section to the plan: full words in every
identifier, with a short list of allowed acronyms and Go idioms, and a grep check
at every gate.

### 2.7 Naming rule — English only

**Prompt:**

> Also, change all the variables to English, because all the variables are in
> Spanish.

**Outcome:** The original code base used Spanish identifiers. Added an English-only
rule, a Spanish → English rename table produced in Phase 0, and the decision that
JSON field names change with it (a contract change, handled backend and frontend in
the same pull request).

### 2.8 This file

**Prompt:**

> One of the requirements is to share any prompts I used to build this app. Could
> you help me with that?

**Outcome:** This template, plus instructions on recovering prompt history.

### 2.9 Cleaning up this file

**Prompt:**

> Correct my spelling mistakes, from any prompt that I've sent.

**Outcome:** Prompts in this file were corrected for spelling, capitalization, and
punctuation only.

---

## 3. Refactor execution

One Claude Code session, from the analysis to the publication. The per-phase
prompts come from Appendix C of `REFACTOR_PLAN.md`.

### 3.1 Phase 0 — analysis

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Read REFACTOR_PLAN.md in full, including the Naming convention section. The
> code base currently uses Spanish identifiers; they will all be translated to
> English full words. Execute ONLY Phase 0. Do not modify any source file. Write
> your findings to docs/ANALYSIS.md following the structure in the plan, including
> the filled gap-analysis table, the backend and frontend rename tables (Spanish or
> abbreviated identifier → English full-word name), the list of Spanish JSON field
> names, and the strategy decision in 0.7. When Gate 0 is satisfied, stop and
> summarize what you found in five lines.

**Outcome:** Received `docs/ANALYSIS.md` and the `pre-refactor` tag on `1b273e2`;
no source file changed. Baseline: backend coverage 10.1%, no frontend tests.
Findings that changed the plan: the gate grep for Spanish words missed most of
this code base's vocabulary (extended grep added), single-letter identifiers were
invisible to the abbreviation grep (second grep added, `t *testing.T` allowed as
a Go idiom), and Appendix B said `sqrt` where Rule 2 requires `squareRoot`. The
strategy decisions proposed in section 0.7 of the analysis were confirmed or
changed one by one in entries 3.3 to 3.12.

### 3.2 Phase 0 — what is left before Phase 1

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Okay, so what do we need to do before the next step?

**Outcome:** A short checklist: add `REFACTOR_PLAN.md` and this file to the
repository root, confirm the 0.7 decisions, fold the Phase 0 findings into the
plan, branch, and commit Phase 0.

### 3.3 Phase 0 — scope confirmation

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Everything that is not in the current app, we will need to build it — for
> example power, square root, and percentage. Give me the path for saving
> REFACTOR_PLAN.md; I have the PROMPTS.md and I will put it in the same folder
> that you give me.

**Outcome:** My decision, recorded in `docs/ANALYSIS.md` (finding F2 and section
0.7): features the target needs and the current application lacks get built,
each with its tests in the phase that adds it. Narrowed in 3.4–3.6 after reading
the assignment again.

### 3.4 Scope check against the assignment

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> [attached the assignment text]
>
> Let's talk about 2.4, and check this against the assignment. If the assignment
> requires it, then do it; if not, just let me know.

**Outcome:** None of the five items in 2.4 is required. Two already existed in
the app (chaining, keyboard mapping) and stay. The answer also pointed out that
the CORS middleware would never run in this project, which I had not noticed.

### 3.5 Docker stays

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Although Docker is optional, I want to build it.

**Outcome:** My decision. Phase 5 stays in full; the backend image is `alpine`.

### 3.6 Advanced operations stay

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Also build the operations: square root, percentage, and power.

**Outcome:** My decision. With that, the rule became: build what the assignment
lists, even when optional; defer what it never mentions. Recorded in Appendix D
of `REFACTOR_PLAN.md`.

### 3.7 Final call on the three deferred items

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> And yes, remove the CORS middleware and the operations endpoint — nobody
> consumes them — and keep graceful shutdown.

**Outcome:** My decision. The assistant had deferred all three; I kept graceful
shutdown as the one exception to the rule in 3.6.

### 3.8 Questioning the base image

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Is alpine the best image for this approach?

**Outcome:** The assistant had picked `alpine` only because the compose health
check needs `wget`. The answer admitted it was not the best image in general,
which made me push further.

### 3.9 Distroless for the backend

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Could we do it with distroless?

**Outcome:** Yes: the binary performs its own health check through a
`healthcheck` subcommand, about 12 lines in its own file. Accepted — the
assistant reversed its own recommendation once the cost was on the table.

### 3.10 Distroless for the frontend

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> And would distroless fit well for the frontend too?

**Outcome:** No. Static files need a web server, and there is no official
distroless nginx image. The frontend stays on `nginx:alpine`; the asymmetry is
recorded as a design decision.

### 3.11 One container or two

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Question: does each part need its own container, or could they be together? I
> mean, we can do distroless for Go and alpine for the frontend, but if they
> could be together, isn't it a waste of resources to run two containers?

**Outcome:** Learned that a container is a process, not a virtual machine, so a
second one costs almost nothing. Got three layouts to compare: two containers;
one image where Go also serves the static files; both processes in one
container under a supervisor.

### 3.12 Decision: two containers

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Okay, go ahead with option A.

**Outcome:** My decision: two containers under `docker compose`. The single-image
alternative was smaller, but it would make the backend serve the frontend again,
which is what the refactor removes.

### 3.13 Phase 1 — extract the calculator domain

**Tool:** Claude Code (VS Code extension), same session as Phase 0 at my request
("Do it yourself, paste the prompt").
**Prompt:**

> Read REFACTOR_PLAN.md and docs/ANALYSIS.md. Execute Phase 1 only. Apply the
> Naming convention and the rename tables to every identifier you write or touch:
> English, full words, no abbreviations. Use rename-symbol, never plain text
> replace. Respect the scope guard. When Gate 1 passes (including both naming
> greps), commit with the message given in the plan, show me the diff summary,
> and stop.

**Outcome:** Commit `b399575`. New package `internal/calculator` with an
operations table, five sentinel errors, and the three new operations (`power`,
`squareRoot`, `percentage`); 32 table-driven cases, 100% statement coverage; no
`net/http` or `encoding/json` in its dependencies. The assistant kept the old
HTTP contract alive through a small bridge in `main.go` so the app still runs
between Phase 1 and Phase 2 — not in the plan, accepted because Gate 1 needs the
whole module to compile. It also renamed the Go module now rather than in
Phase 2, to avoid writing a Spanish import path in new code. One gate grep gave
a false positive on a `±` character in a comment; the comment was reworded.

### 3.14 Phases 2 to 7 — finish the plan

**Tool:** Claude Code (VS Code extension), same session, using its `/goal`
command so the agent keeps working until the condition holds.
**Prompt:**

> /goal finish the plan

**Outcome:** Phases 2 to 7 ran in one session, one commit per phase, every gate
run for real before its commit:

- Phase 2, `3a854f9` — `internal/httpapi` and `cmd/server`. Transport and domain
  at 100% coverage. The assistant added three error codes that were not in the
  plan (405, 404, 413) so that every response uses one envelope; accepted, and
  Appendix B was updated.
- Phase 3, `20fd251` — reducer, injected client, components. Started from the
  `useReducer` version in commit `fcd23f4`, as decided in Phase 0. Checking in a
  real browser found two things the code review had missed: two elements with
  the role `status`, and a panel that never filled a phone because the grid
  item was `#root`. My Phase 0 estimate of the key width was wrong; the
  analysis now says so.
- Phase 4, `34d436f` — 101 frontend tests, 99.26% statements.
- Phase 5, `472de61` — built from a fresh clone; both containers healthy;
  graceful shutdown confirmed with `docker compose stop` (exit 0 in one second).
- Phase 6, `c84477c` — README, followed literally from another fresh clone.
- Phase 7 — whole-repository review. The naming greps needed three corrections
  along the way, all false positives against English: `±` without a UTF-8
  locale, `border` and `indices`, and `restart`.

Rename-symbol was not used: `gopls` is not installed, and every file with
Spanish names was replaced by a new file rather than edited, so the compiler
and the tests did the checking. Not done by the assistant: pushing, which needs
a remote that I have to create.

### 3.15 Publishing

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> What is pending? I already made the repository
> https://github.com/GeraM94/full-stack-calculator.git

**Outcome:** The assistant checked the remote before pushing and found that
GitHub had created a `main` branch with its own README and an unrelated
history. It pushed only what could not overwrite anything — the branch
`refactor/architecture` and the tags `pre-refactor` and `v1.0` — and left the
decision about `main` to me, with two options: (A) make the refactor branch the
default branch, or (B) replace `main` and bring the refactor in through a pull
request. Decided in 3.18.

### 3.16 Antivirus false positives

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Should I deactivate Windows Defender?

**Outcome:** No. Defender had blocked `go build -o` output during the session, a
known false positive on unsigned Go binaries. The assistant had already worked
around it with `go run` and Docker, and no security setting was changed.

### 3.17 Backend tests

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Did we implement tests for the backend?

**Outcome:** Yes: table-driven tests for the domain and `httptest` tests for the
transport, both packages at 100% statement coverage. I asked for a second
opinion in a separate session (5.2).

### 3.18 Publishing decision, this file, and the README

**Tool:** Claude Code (VS Code extension)
**Prompt:**

> Do B. And for PROMPTS.md: one of the assignment's requirements says "Share any
> prompts that you used in your work" — are we accomplishing that? And yes, set
> up the README with all the instructions, as the assignment says.

**Outcome:** My decision on publishing: option B. GitHub's generated `main` was
replaced by the project history (a forced push guarded by a lease on the
expected commit), and the refactor came in through pull request #1, so the
default branch shows the final code and the pull request shows the whole
refactor.

On the prompts requirement the honest answer was "not yet": section 1 was an
empty template and so was the header. The assistant recovered the original-build
prompts from the Claude Code session history on my machine and filled section 1,
added the entries that were missing (3.16, 3.17, section 5), and replaced the
template's closing section with the list of decisions below.

The README already covered the four items the assignment lists. It gained a
table that maps every item of the assignment to its section, a Setup section
with the clone command, and separate run steps for the backend and the frontend.

While doing this the assistant noticed that two other sessions of mine were
working in the same folder, and coordinated with them so that no commit
collided.

---

## 4. Documentation

The README was written by the assistant in Phase 6 as part of entry 3.14, and
extended in 3.18; there was no separate prompt. In Phase 6 the assistant executed
the run instructions and the `curl` examples from a fresh clone, and did so again
after the changes in 3.18.

---

## 5. Verification in separate sessions

On the last day I opened two more Claude Code sessions next to the main one, to
have the result checked by an assistant that had not written it.

### 5.1 Are the container images ready?

**Tool:** Claude Code (VS Code extension), separate session
**Prompts:**

> Could you verify if the container images for deploying the backend and the
> frontend are ready?

> Okay, so I'm looking at the Docker app and I see 4 instances or builds. Check
> that and delete those we don't need.

> Okay, what are those builds for? How does it work?

> Do we accomplish this requirement with that: "Dockerfile to run frontend +
> backend together"?

> Yeah, I know that it's optional, but I still want to submit it.

**Outcome:** Both images built and the stack started: two healthy containers, the
backend at 23.2 MB on distroless as a non-root user, the frontend at 92.9 MB; a
calculation answered through the nginx proxy, and a division by zero returned
422. The four "builds" were BuildKit history records, two per run; the two oldest
were deleted and no image was touched. On the requirement: it describes a result
— one command that runs both parts — and `docker compose up --build` delivers
it. That session also proposed publishing by pushing the refactor branch straight
onto `main`; I kept the pull request route of 3.18. The sentence it drafted for
the README, pointing from "Run with Docker" to the design decision, was kept.

### 5.2 Are the backend tests any good?

**Tool:** Claude Code (VS Code extension), separate session
**Prompts:**

> Could you check the unit tests for the Go backend?

> What do I need to add to the PATH to check that? And yes, add the missing
> tests.

> Okay, we need to cover everything with tests, so do the test for `run()`. And
> yes, what do I need to add to the system variables?

**Outcome:** All green, and then a manual mutation test on a scratch copy: 16
deliberate defects, 14 caught. The two survivors were real gaps — nothing
asserted that the request-logging middleware logs, and the `Content-Type` of
error responses was never checked — and both now have tests. For the last prompt
the assistant extracted `run(ctx, listener, logger)` out of `main`, so that
serving and graceful shutdown are tested against a real listener, including a
shutdown that runs out of time and a listener that fails. Backend after this
session: 17 test functions, 75 cases, 88.5% of statements; only `func main` is
uncovered. The PATH questions were about `go test -race`, which needs a C
compiler that my Windows machine does not have; the answer was the MSYS2 package
and the folder to add to the PATH, or running the race detector inside the
official Go container instead. The main session reviewed these changes, ran every
gate of the plan on them, and committed them.

---

## Decisions that were mine

The assistant wrote the code; these are the points where I chose the direction,
overrode its recommendation, or asked the question that changed the result.

- **Start from the simplest version.** I had the Redux Toolkit and `useReducer`
  experiments reverted as over-engineering before the refactor began, and read
  the change in source control before it was committed (1.8). The plan later
  brought `useReducer` back for a concrete reason, the overlapping requests found
  in 1.4, not by default.
- **Question the plan itself.** "Did you consider not over-engineering this?"
  (2.4) led to checking every nice-to-have against the assignment (3.4).
- **Naming.** Full words, no abbreviations (2.6); English everywhere, including
  the JSON contract (2.7).
- **Scope rule.** Build what the assignment lists, even when optional — the
  advanced operations and Docker (3.5, 3.6); defer what it never mentions — the
  operations endpoint and CORS (3.7).
- **Keep graceful shutdown**, against the assistant's deferral (3.7).
- **Distroless backend image.** The assistant had settled on `alpine`; I kept
  asking until the cost of the alternative was on the table (3.8, 3.9).
- **Two containers**, not one image that makes the backend serve the frontend
  again (3.11, 3.12).
- **A second opinion.** Separate sessions to check the Docker images and the
  backend tests (section 5).
- **Publishing through a pull request** onto a replaced `main` (3.18).
